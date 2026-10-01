import YahooFinance from "yahoo-finance2";
import { MarketIndex } from "./types";

const yahooFinance = new YahooFinance();

// Yahoo Finance는 각 거래소의 대표지수를 같은 형식으로 제공한다. 중국은 상해·심천을 함께
// 보여줘 본토 시장의 양 축을 구분하고, 대만은 가권(TAIEX)을 사용한다.
const ASIA_INDEXES: Array<{ name: Extract<MarketIndex["name"], "니케이225" | "상해종합" | "심천종합" | "대만가권">; ticker: string }> = [
  { name: "니케이225", ticker: "^N225" },
  { name: "상해종합", ticker: "000001.SS" },
  { name: "심천종합", ticker: "399001.SZ" },
  { name: "대만가권", ticker: "^TWII" },
];

const REQUEST_TIMEOUT_MS = 4_500;
const CACHE_TTL_MS = 3 * 60_000;
const STALE_TTL_MS = 15 * 60_000;

type CacheEntry = {
  data: MarketIndex[];
  expiresAt: number;
  staleUntil: number;
};

let cache: CacheEntry | null = null;
let inFlight: Promise<MarketIndex[]> | null = null;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} 조회 시간 초과`)), REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchIndex({ name, ticker }: (typeof ASIA_INDEXES)[number]): Promise<MarketIndex | null> {
  const quote = await withTimeout(yahooFinance.quote(ticker), `${name} 시세`);
  const close = numberOrNull(quote.regularMarketPrice);
  const reportedChangeRate = numberOrNull(quote.regularMarketChangePercent);
  const previousClose = numberOrNull(quote.regularMarketPreviousClose);
  const changeRate = reportedChangeRate ?? (close !== null && previousClose && previousClose > 0
    ? ((close - previousClose) / previousClose) * 100
    : null);

  // 휴장 중인 지수는 직전 종가가 올 수 있지만, 가격이나 비교 기준이 없으면 의미 있는 카드가
  // 아니므로 생략한다. 다른 시장의 응답에는 영향을 주지 않는다.
  if (close === null || close <= 0 || changeRate === null) return null;
  return {
    name,
    close,
    changeRate,
    asOf: quote.regularMarketTime ? new Date(quote.regularMarketTime).toISOString() : undefined,
    source: "Yahoo",
  };
}

async function fetchAsiaIndicesUncached(): Promise<MarketIndex[]> {
  const settled = await Promise.allSettled(ASIA_INDEXES.map(fetchIndex));
  return settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value ? [result.value] : [];
    console.warn(`[overseas-indices] ${ASIA_INDEXES[index].name} 조회 실패:`, result.reason instanceof Error ? result.reason.message : result.reason);
    return [];
  });
}

/**
 * 일본·중국·대만 대표지수를 병렬 조회한다. 새로고침 중 공급자가 지연되거나 실패하면
 * 최근 정상 스냅샷을 최대 15분간 사용해 홈의 국내 지수 카드까지 비는 일을 막는다.
 */
export async function fetchAsiaIndices(): Promise<MarketIndex[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  if (inFlight) return inFlight;

  const previous = cache;
  inFlight = fetchAsiaIndicesUncached()
    .then((data) => {
      if (data.length === 0) {
        if (previous && previous.staleUntil > Date.now()) return previous.data;
        return [];
      }
      cache = { data, expiresAt: Date.now() + CACHE_TTL_MS, staleUntil: Date.now() + STALE_TTL_MS };
      return data;
    })
    .catch((error) => {
      console.warn("[overseas-indices] 아시아 지수 조회 실패:", error instanceof Error ? error.message : error);
      if (previous && previous.staleUntil > Date.now()) return previous.data;
      return [];
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
