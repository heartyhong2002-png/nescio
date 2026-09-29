import test from "node:test";
import assert from "node:assert/strict";

// In-flight deduplication & rate limiting test model
function createCostApiHandler({ rateLimitMax = 10, windowMs = 60000, ttlMs = 300000 } = {}) {
  const ipHits = new Map();
  const cache = new Map();
  const inFlightPromises = new Map();
  let providerCalls = 0;

  function rateLimit(ip) {
    const now = Date.now();
    const record = ipHits.get(ip);
    if (!record || now - record.start > windowMs) {
      ipHits.set(ip, { count: 1, start: now });
      return { ok: true, retryAfterMs: 0 };
    }
    if (record.count >= rateLimitMax) {
      const retryAfterMs = windowMs - (now - record.start);
      return { ok: false, retryAfterMs };
    }
    record.count++;
    return { ok: true, retryAfterMs: 0 };
  }

  async function mockProviderCall(ticker, currentPrice) {
    providerCalls++;
    // Simulate async network/LLM latency
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      ticker,
      currentPrice,
      summary: `Mock AI analysis for ${ticker}`,
    };
  }

  async function handleRequest({ ip = "127.0.0.1", ticker = "005930", currentPrice = 70000 } = {}) {
    // 1. Ticker validation
    if (!/^[a-zA-Z0-9]{1,10}$/.test(ticker)) {
      return { status: 400, body: { error: "올바르지 않은 종목 코드예요." } };
    }

    // 2. Rate limiting
    const { ok, retryAfterMs } = rateLimit(ip);
    if (!ok) {
      return {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        body: { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
      };
    }

    // 3. Cache check
    const roundedPrice = Math.round(currentPrice / 100) * 100;
    const cacheKey = `consensus:${ticker}:${roundedPrice}:v1`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { status: 200, body: cached.data, fromCache: true };
    }

    // 4. In-flight Promise deduplication
    if (inFlightPromises.has(cacheKey)) {
      try {
        const data = await inFlightPromises.get(cacheKey);
        return { status: 200, body: data, deduplicated: true };
      } catch {
        // Fallthrough
      }
    }

    const fetchPromise = (async () => {
      try {
        const data = await mockProviderCall(ticker, currentPrice);
        cache.set(cacheKey, { data, expiry: Date.now() + ttlMs });
        return data;
      } finally {
        inFlightPromises.delete(cacheKey);
      }
    })();

    inFlightPromises.set(cacheKey, fetchPromise);
    const data = await fetchPromise;
    return { status: 200, body: data, deduplicated: false };
  }

  return {
    handleRequest,
    getProviderCalls: () => providerCalls,
    resetProviderCalls: () => { providerCalls = 0; },
  };
}

test("P1: 비용 발생 API 인플라이트 중복 제거 & Rate limit 검증", async (t) => {
  await t.test("20개 동시 요청 시 provider mock 호출은 단 1회만 발생하고 모두 200 응답 반환", async () => {
    // Set rateLimitMax high enough for this specific concurrency test to isolate deduplication
    const api = createCostApiHandler({ rateLimitMax: 50 });

    const requests = Array.from({ length: 20 }, (_, i) =>
      api.handleRequest({ ip: `10.0.0.${i + 1}`, ticker: "005930", currentPrice: 70000 })
    );

    const responses = await Promise.all(requests);

    // All 20 requests should succeed
    for (const res of responses) {
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ticker, "005930");
    }

    // Provider call should have occurred exactly once!
    assert.strictEqual(api.getProviderCalls(), 1, "Provider should be called exactly once due to in-flight deduplication");
  });

  await t.test("동일 IP에서 분당 허용량(10회) 초과 시 429와 Retry-After 반환", async () => {
    const api = createCostApiHandler({ rateLimitMax: 10 });
    const ip = "192.168.1.100";

    // First 10 requests should succeed
    for (let i = 0; i < 10; i++) {
      const res = await api.handleRequest({ ip, ticker: "005930", currentPrice: 70000 });
      assert.strictEqual(res.status, 200);
    }

    // 11th request should be blocked with 429
    const blockedRes = await api.handleRequest({ ip, ticker: "005930", currentPrice: 70000 });
    assert.strictEqual(blockedRes.status, 429);
    assert.ok(blockedRes.headers?.["Retry-After"]);
    assert.strictEqual(blockedRes.body?.error, "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.");
  });

  await t.test("잘못된 형식의 ticker는 400 반환 (영숫자 1-10자리 검증)", async () => {
    const api = createCostApiHandler();
    const invalidTickers = ["", "005930;DROP TABLE", "INVALID_VERY_LONG_TICKER_NAME", "종목코드"];

    for (const ticker of invalidTickers) {
      const res = await api.handleRequest({ ticker });
      assert.strictEqual(res.status, 400, `Ticker "${ticker}" should be rejected with 400`);
    }

    const validTickers = ["005930", "035420", "AAPL", "TSLA"];
    for (const ticker of validTickers) {
      const res = await api.handleRequest({ ticker });
      assert.strictEqual(res.status, 200, `Ticker "${ticker}" should be accepted`);
    }
  });
});
