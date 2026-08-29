import { serverEnv } from "./server-env";
import { Market, Stock } from "./types";

type KrxRow = {
  ISU_CD?: string;
  ISU_NM?: string;
  TDD_CLSPRC?: string;
  FLUC_RT?: string;
  MKTCAP?: string;
};

const KRX_BASE_URL = "https://data-dbg.krx.co.kr/svc/apis";
const MARKET_CODE: Record<Market, "stk" | "ksq"> = { KOSPI: "stk", KOSDAQ: "ksq" };

function dateString(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function fetchRows(market: Market, basDd: string, key: string): Promise<KrxRow[]> {
  const response = await fetch(
    `${KRX_BASE_URL}/sto/${MARKET_CODE[market]}_bydd_trd?AUTH_KEY=${encodeURIComponent(key)}&basDd=${basDd}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`KRX ${market} 종목 API 오류 (${response.status})`);
  return ((await response.json()).OutBlock_1 ?? []) as KrxRow[];
}

/** Finds the most recent trading day (within the last 8 days) with data for a market, and returns its rows. */
export async function fetchLatestMarketRows(market: Market, key: string): Promise<KrxRow[]> {
  for (let offset = 0; offset < 8; offset += 1) {
    const rows = await fetchRows(market, dateString(offset), key);
    if (rows.length > 0) return rows;
  }
  return [];
}

export async function listMarketStocks(market: Market, key: string): Promise<Stock[]> {
  const rows = await fetchLatestMarketRows(market, key);
  return rows
    .filter((row) => row.ISU_CD && row.ISU_NM)
    .map((row) => ({ ticker: row.ISU_CD!, name: row.ISU_NM!, market }));
}

function rowToPrice(row: KrxRow | undefined) {
  if (!row) return { close: null, changeRate: null, marketCap: null };
  return {
    close: Number(String(row.TDD_CLSPRC).replaceAll(",", "")),
    changeRate: Number(String(row.FLUC_RT).replaceAll(",", "")),
    marketCap: row.MKTCAP ? Number(String(row.MKTCAP).replaceAll(",", "")) : null,
  };
}

// 일반 종목이 대다수라 KOSPI/KOSDAQ을 먼저 찾고, 못 찾았을 때만 ETF를 조회해 불필요한 지연을 줄인다.
const MARKETS_BY_LOOKUP_PRIORITY: Market[] = ["KOSPI", "KOSDAQ"];

/** Looks up the latest close/changeRate for a single ticker, trying every market. */
export async function getPriceForTicker(ticker: string) {
  const key = serverEnv("KRX_AUTH_KEY");
  if (!key || !ticker) return { close: null, changeRate: null, marketCap: null };
  for (const market of MARKETS_BY_LOOKUP_PRIORITY) {
    const rows = await fetchLatestMarketRows(market, key);
    const row = rows.find((item) => item.ISU_CD === ticker);
    if (row) return rowToPrice(row);
  }
  return { close: null, changeRate: null, marketCap: null };
}

/** Batched lookup for multiple tickers — fetches each market's snapshot once, not once per ticker. */
export async function getPricesForTickers(tickers: string[]) {
  const key = serverEnv("KRX_AUTH_KEY");
  const result = new Map<string, { close: number | null; changeRate: number | null; marketCap: number | null }>();
  if (!key || tickers.length === 0) return result;

  const wanted = new Set(tickers);
  const rowsByMarket = await Promise.all(
    MARKETS_BY_LOOKUP_PRIORITY.map((market) => fetchLatestMarketRows(market, key)),
  );
  for (const row of rowsByMarket.flat()) {
    if (row.ISU_CD && wanted.has(row.ISU_CD)) result.set(row.ISU_CD, rowToPrice(row));
  }
  return result;
}

export type PricePoint = { date: string; close: number };

async function resolveMarket(ticker: string, key: string): Promise<Market | null> {
  for (const market of MARKETS_BY_LOOKUP_PRIORITY) {
    const rows = await fetchLatestMarketRows(market, key);
    if (rows.some((row) => row.ISU_CD === ticker)) return market;
  }
  return null;
}

/** Weekday-only calendar dates for the last `calendarDays` days (oldest first), skipping Sat/Sun to cut wasted KRX calls. */
function weekdayDates(calendarDays: number): string[] {
  const dates: string[] = [];
  for (let offset = 0; offset < calendarDays; offset += 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(date.toISOString().slice(0, 10).replaceAll("-", ""));
  }
  return dates.reverse();
}

const HISTORY_CONCURRENCY = 8;

/**
 * Builds a close-price history by calling the single-day `stk_bydd_trd` snapshot once per weekday
 * in range (this KRX key isn't authorized for a proper date-range endpoint — see HANDOFF.md).
 * Requests run in small parallel batches; still O(calendarDays) KRX calls, so the "1년" range is slow.
 */
export async function fetchPriceHistory(ticker: string, calendarDays: number): Promise<PricePoint[]> {
  const key = serverEnv("KRX_AUTH_KEY");
  if (!key || !ticker) return [];

  const market = await resolveMarket(ticker, key);
  if (!market) return [];

  const dates = weekdayDates(calendarDays);
  const points: PricePoint[] = [];
  for (let i = 0; i < dates.length; i += HISTORY_CONCURRENCY) {
    const batch = dates.slice(i, i + HISTORY_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (basDd) => {
        const rows = await fetchRows(market, basDd, key);
        return { basDd, row: rows.find((row) => row.ISU_CD === ticker) };
      }),
    );
    for (const { basDd, row } of results) {
      if (row?.TDD_CLSPRC) points.push({ date: basDd, close: Number(String(row.TDD_CLSPRC).replaceAll(",", "")) });
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}
