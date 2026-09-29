import test from "node:test";
import assert from "node:assert/strict";

// Mirror of valuation interpret cacheKey logic
function buildValuationCacheKey(ticker, name, metrics, close, changeRate, model = "qwen2.5:7b-instruct") {
  const roundedClose = close !== null ? Math.round(close / 100) * 100 : "null";
  return [
    ticker,
    name.trim().toLowerCase(),
    metrics.per,
    metrics.pbr,
    metrics.dividend,
    metrics.marketCap,
    roundedClose,
    changeRate,
    model,
  ].join("|");
}

// Mock valuation interpret service
function createValuationService() {
  const cache = new Map();
  const userHistories = new Map(); // userId -> list of saved interpretations

  async function interpret({ userId, ticker, name, metrics, close, changeRate }) {
    const key = buildValuationCacheKey(ticker, name, metrics, close, changeRate);

    let interpretation;
    if (cache.has(key)) {
      interpretation = cache.get(key);
    } else {
      // Generate new interpretation based on price and metrics
      interpretation = {
        per: `PER ${metrics.per}x at price ${close}`,
        summary: `${name}(${ticker}) valuation analysis with change rate ${changeRate}%`,
      };
      cache.set(key, interpretation);
    }

    // Save history per user (Snapshot includes currentPrice and metrics)
    if (userId) {
      if (!userHistories.has(userId)) {
        userHistories.set(userId, []);
      }
      userHistories.get(userId).push({
        ticker,
        stock_name: name,
        metrics: { ...metrics, currentPrice: { close, changeRate } },
        interpretation,
        saved_at: new Date().toISOString(),
      });
    }

    return interpretation;
  }

  return {
    interpret,
    getHistory: (userId) => userHistories.get(userId) || [],
  };
}

test("P2: Valuation 지표 해석 캐시 키 격리 및 사용자별 히스토리 검증", async (t) => {
  await t.test("서로 다른 현재가(close, changeRate)는 서로 다른 캐시 키를 생성", () => {
    const metrics = { per: 15.2, pbr: 1.1, dividend: 2.5, marketCap: 400000000000 };
    const key1 = buildValuationCacheKey("005930", "삼성전자", metrics, 70000, 1.5);
    const key2 = buildValuationCacheKey("005930", "삼성전자", metrics, 75000, 3.2);

    assert.notStrictEqual(key1, key2, "Different prices must generate distinct cache keys");
  });

  await t.test("두 사용자가 서로 다른 시점에 서로 다른 현재가로 요청했을 때 결과와 저장이 섞이지 않음", async () => {
    const service = createValuationService();
    const metrics = { per: 15.2, pbr: 1.1, dividend: 2.5, marketCap: 400000000000 };

    // User A requests at price 70,000 (+1.5%)
    const resA = await service.interpret({
      userId: "user-a-uuid",
      ticker: "005930",
      name: "삼성전자",
      metrics,
      close: 70000,
      changeRate: 1.5,
    });

    // User B requests at price 75,000 (+3.2%)
    const resB = await service.interpret({
      userId: "user-b-uuid",
      ticker: "005930",
      name: "삼성전자",
      metrics,
      close: 75000,
      changeRate: 3.2,
    });

    // Responses should reflect their respective prices
    assert.match(resA.per, /70000/);
    assert.match(resB.per, /75000/);

    // User A history must contain only User A's snapshot
    const historyA = service.getHistory("user-a-uuid");
    assert.strictEqual(historyA.length, 1);
    assert.strictEqual(historyA[0].metrics.currentPrice.close, 70000);
    assert.strictEqual(historyA[0].metrics.currentPrice.changeRate, 1.5);

    // User B history must contain only User B's snapshot
    const historyB = service.getHistory("user-b-uuid");
    assert.strictEqual(historyB.length, 1);
    assert.strictEqual(historyB[0].metrics.currentPrice.close, 75000);
    assert.strictEqual(historyB[0].metrics.currentPrice.changeRate, 3.2);
  });
});
