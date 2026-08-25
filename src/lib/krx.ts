import { serverEnv } from "./server-env";
import { Market, Stock } from "./types";

type KrxRow = {
  ISU_CD?: string;
  ISU_NM?: string;
  TDD_CLSPRC?: string;
  FLUC_RT?: string;
};

const KRX_BASE_URL = "https://data-dbg.krx.co.kr/svc/apis/sto";
const MARKET_CODE: Record<Market, "stk" | "ksq"> = { KOSPI: "stk", KOSDAQ: "ksq" };

function dateString(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function fetchRows(market: Market, basDd: string, key: string): Promise<KrxRow[]> {
  const response = await fetch(
    `${KRX_BASE_URL}/${MARKET_CODE[market]}_bydd_trd?AUTH_KEY=${encodeURIComponent(key)}&basDd=${basDd}`,
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
  if (!row) return { close: null, changeRate: null };
  return {
    close: Number(String(row.TDD_CLSPRC).replaceAll(",", "")),
    changeRate: Number(String(row.FLUC_RT).replaceAll(",", "")),
  };
}

/** Looks up the latest close/changeRate for a single ticker, trying both markets. */
export async function getPriceForTicker(ticker: string) {
  const key = serverEnv("KRX_AUTH_KEY");
  if (!key || !ticker) return { close: null, changeRate: null };
  for (const market of ["KOSPI", "KOSDAQ"] as Market[]) {
    const rows = await fetchLatestMarketRows(market, key);
    const row = rows.find((item) => item.ISU_CD === ticker);
    if (row) return rowToPrice(row);
  }
  return { close: null, changeRate: null };
}

/** Batched lookup for multiple tickers — fetches each market's snapshot once, not once per ticker. */
export async function getPricesForTickers(tickers: string[]) {
  const key = serverEnv("KRX_AUTH_KEY");
  const result = new Map<string, { close: number | null; changeRate: number | null }>();
  if (!key || tickers.length === 0) return result;

  const wanted = new Set(tickers);
  const [kospiRows, kosdaqRows] = await Promise.all([
    fetchLatestMarketRows("KOSPI", key),
    fetchLatestMarketRows("KOSDAQ", key),
  ]);
  for (const row of [...kospiRows, ...kosdaqRows]) {
    if (row.ISU_CD && wanted.has(row.ISU_CD)) result.set(row.ISU_CD, rowToPrice(row));
  }
  return result;
}
