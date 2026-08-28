import fs from "node:fs";
import path from "node:path";
import { serverEnv } from "./server-env";
import { PricePoint } from "./krx";
import { Valuation } from "./types";

/**
 * 한국투자증권(KIS) Open API 클라이언트.
 *
 * KRX Open API 키는 일별 스냅샷 엔드포인트만 허용돼서(HANDOFF 참고) 분봉·기간별 차트나
 * PER/PBR 같은 밸류에이션 지표를 못 가져온다. KIS는 공식 인증 API로 이 둘을 모두 제공한다.
 *  - 분봉:        /uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice (FHKST03010200)
 *  - 기간별 시세:  /uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice (FHKST03010100)
 *  - 현재가·지표:  /uapi/domestic-stock/v1/quotations/inquire-price (FHKST01010100)
 */

const KIS_BASE_URL = serverEnv("KIS_BASE_URL") || "https://openapi.koreainvestment.com:9443";

// 토큰은 24시간 유효하고 발급은 "1분당 1회"로 제한된다. 프로세스 메모리 + 파일 + 추가 안전장치로 캐시한다.
const TOKEN_CACHE_PATH = path.join(process.cwd(), ".kis_token_cache.json");

type TokenCache = { appKey: string; accessToken: string; expiresAt: number };

let memoryToken: TokenCache | null = null;
let inFlight: Promise<string> | null = null;
let lastIssuedAt = 0; // 토큰 발급 시각을 기록해 1분 이내 재발급 방지

function readTokenFile(appKey: string): TokenCache | null {
  try {
    const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, "utf8")) as TokenCache;
    if (cache.appKey === appKey && cache.accessToken && Date.now() < cache.expiresAt) return cache;
  } catch {
    /* 캐시 없음/손상 — 새로 발급 */
  }
  return null;
}

function writeTokenFile(cache: TokenCache) {
  try {
    fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(cache), "utf8");
  } catch {
    /* 읽기 전용 FS(예: 서버리스)면 메모리 캐시로만 동작 */
  }
}

async function issueToken(appKey: string, appSecret: string): Promise<string> {
  const cached = readTokenFile(appKey);
  if (cached) {
    memoryToken = cached;
    return cached.accessToken;
  }

  const response = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", appkey: appKey, appsecret: appSecret }),
    cache: "no-store",
  });
  const data = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`KIS 토큰 발급 오류 (${response.status}): ${data.error_description ?? "알 수 없는 오류"}`);
  }

  const cache: TokenCache = {
    appKey,
    accessToken: data.access_token,
    // 만료 5분 전에 갱신
    expiresAt: Date.now() + (data.expires_in ?? 86400) * 1000 - 5 * 60 * 1000,
  };
  memoryToken = cache;
  writeTokenFile(cache);
  return cache.accessToken;
}

async function accessToken(): Promise<string> {
  const appKey = serverEnv("KIS_APP_KEY");
  const appSecret = serverEnv("KIS_APP_SECRET");
  if (!appKey || !appSecret) throw new Error("KIS_APP_KEY와 KIS_APP_SECRET을 .env에 설정하세요.");

  if (memoryToken && memoryToken.appKey === appKey && Date.now() < memoryToken.expiresAt) {
    return memoryToken.accessToken;
  }
  // 동시 요청이 토큰을 각자 발급하지 않도록 직렬화한다.
  if (!inFlight) {
    inFlight = issueToken(appKey, appSecret).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

type KisRow = Record<string, string>;
type KisResponse = {
  rt_cd: string;
  msg1?: string;
  output?: KisRow;
  output1?: KisRow | KisRow[];
  output2?: KisRow[];
};

function asRows(value: KisRow | KisRow[] | undefined): KisRow[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// KIS는 appkey 단위로 "초당 거래건수"를 빡빡하게 제한한다(EGW00201). 모든 호출을 최소 간격으로 직렬화한다.
// 서버리스(Vercel)에서는 인스턴스마다 이 큐가 따로 돌아서 합산 트래픽이 순간적으로 몰릴 수 있으니
// 간격을 넉넉히 잡고, 실제 초과가 나면 kisGet에서 지수 백오프로 재시도한다.
const MIN_CALL_GAP_MS = 360;
let lastCallAt = 0;
let callQueue: Promise<unknown> = Promise.resolve();

function throttle<T>(task: () => Promise<T>): Promise<T> {
  const run = callQueue.then(async () => {
    // 약간의 지터를 섞어 여러 인스턴스가 같은 박자로 KIS를 때리는 상황을 흩뜨린다.
    const wait = lastCallAt + MIN_CALL_GAP_MS - Date.now() + Math.floor(Math.random() * 60);
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    return task();
  });
  callQueue = run.catch(() => {});
  return run;
}

async function kisGetOnce(apiPath: string, trId: string, params: Record<string, string>): Promise<KisResponse> {
  const appKey = serverEnv("KIS_APP_KEY")!;
  const appSecret = serverEnv("KIS_APP_SECRET")!;
  const token = await accessToken();
  const url = `${KIS_BASE_URL}${apiPath}?${new URLSearchParams(params).toString()}`;

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      appkey: appKey,
      appsecret: appSecret,
      tr_id: trId,
      custtype: "P",
      "content-type": "application/json; charset=utf-8",
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as KisResponse & { msg_cd?: string };
  if (!response.ok || data.rt_cd !== "0") {
    const error = new Error(`KIS API 오류 (${response.status}): ${data.msg1 ?? apiPath}`) as Error & {
      code?: string;
      status?: number;
    };
    error.code = data.msg_cd;
    error.status = response.status;
    throw error;
  }
  return data;
}

// 일시적인 장애로 보고 재시도해야 하는 경우:
//  - EGW00201: 초당 거래건수 초과   - EGW00133: 토큰 발급 제한
//  - HTTP 429 / 5xx: KIS 게이트웨이 순간 오류
function isRetryable(error: unknown): boolean {
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (code === "EGW00201" || code === "EGW00133") return true;
  return status === 429 || (typeof status === "number" && status >= 500);
}

async function kisGet(apiPath: string, trId: string, params: Record<string, string>): Promise<KisResponse> {
  const MAX_ATTEMPTS = 5;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await throttle(() => kisGetOnce(apiPath, trId, params));
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS - 1) break;
      // 지수 백오프 + 지터: 0.6s, 1.2s, 2.4s, 4.8s (+최대 0.4s)
      const backoff = 600 * 2 ** attempt + Math.floor(Math.random() * 400);
      await sleep(backoff);
    }
  }
  throw lastError;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// 분봉 (오늘)
// ---------------------------------------------------------------------------

/** 하루치 1분봉을 09:00~15:30 구간에 대해 120분 단위 앵커 4번으로 모은다 (호출당 최대 120건). */
async function fetchIntradayForDate(ticker: string, date: string): Promise<PricePoint[]> {
  const anchors = ["110000", "130000", "150000", "153000"];
  // 한 앵커가 레이트리밋 등으로 끝내 실패해도 나머지 구간이라도 그리는 게 낫다.
  // 전부 실패했을 때만 에러를 던져 상위(폴백/재시도)로 넘긴다.
  const settled = await Promise.allSettled(
    anchors.map((hour) =>
      kisGet("/uapi/domestic-stock/v1/quotations/inquire-time-dailychartprice", "FHKST03010230", {
        FID_COND_MRKT_DIV_CODE: "J",
        FID_INPUT_ISCD: ticker,
        FID_INPUT_HOUR_1: hour,
        FID_INPUT_DATE_1: date,
        FID_PW_DATA_INCU_YN: "Y",
        FID_FAKE_TICK_INCU_YN: "N",
      }).then((data) => data.output2 ?? []),
    ),
  );

  const ok = settled.filter((r): r is PromiseFulfilledResult<KisRow[]> => r.status === "fulfilled");
  if (ok.length === 0) {
    throw settled.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason ?? new Error("분봉 조회 실패");
  }

  const byTime = new Map<string, number>();
  for (const row of ok.flatMap((r) => r.value)) {
    const hour = row.stck_cntg_hour; // HHMMSS
    const close = toNumber(row.stck_prpr);
    if (!hour || close === null) continue;
    byTime.set(hour.slice(0, 4), close); // "HHMM"
  }

  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, close]) => ({ date: time, close }));
}

/**
 * 가장 최근 거래일의 1분봉을 반환한다.
 * inquire-time-dailychartprice는 과거 분봉(최대 1년 보관)도 주므로, 오늘 데이터가 없으면
 * (휴장일/장 시작 전) 최대 5일 뒤로 물러나며 직전 거래일 분봉을 찾는다.
 */
export async function fetchIntradayHistory(ticker: string): Promise<PricePoint[]> {
  for (let back = 0; back < 5; back += 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - back);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue; // 주말 스킵
    const points = await fetchIntradayForDate(ticker, yyyymmdd(day));
    if (points.length > 0) return points;
  }
  return [];
}

// ---------------------------------------------------------------------------
// 기간별 시세 (일/주/월)
// ---------------------------------------------------------------------------

const RANGE_CONFIG: Record<string, { periodDivCode: "D" | "W" | "M"; calendarDays: number }> = {
  "1주": { periodDivCode: "D", calendarDays: 10 },
  "1개월": { periodDivCode: "D", calendarDays: 35 },
  // 1년: 일봉은 호출당 100건 제한이라 주봉(약 52건)으로 받는다.
  "1년": { periodDivCode: "W", calendarDays: 380 },
};

export async function fetchDailyHistory(ticker: string, range: string): Promise<PricePoint[]> {
  const config = RANGE_CONFIG[range];
  if (!config) return [];

  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - config.calendarDays);

  const data = await kisGet(
    "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
    "FHKST03010100",
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: ticker,
      FID_INPUT_DATE_1: yyyymmdd(start),
      FID_INPUT_DATE_2: yyyymmdd(end),
      FID_PERIOD_DIV_CODE: config.periodDivCode,
      FID_ORG_ADJ_PRC: "0", // 수정주가
    },
  );

  return (data.output2 ?? [])
    .map((row) => ({ date: row.stck_bsop_date, close: toNumber(row.stck_clpr) }))
    .filter((point): point is PricePoint => !!point.date && point.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 같은 종목을 여러 사용자가 조회할 때 KIS 호출을 아끼고 응답을 빠르게 하기 위한 짧은 인메모리 캐시.
//  - 진행 중인 요청(promise)을 공유해 동시 호출이 KIS를 중복으로 때리지 않게 한다
//    (한 종목 페이지가 데스크톱/모바일 레이아웃을 둘 다 마운트하면 요청이 두 번 온다).
//  - 마지막으로 성공한 값을 lastGood에 보관해, 갱신이 레이트리밋으로 실패하면
//    잠깐(STALE_TTL) 그 값을 대신 돌려준다 — 차트가 통째로 비는 것보다 낫다.
type CacheEntry<T = unknown> = { value?: T; promise?: Promise<T>; expiresAt: number; lastGood?: T };
const responseCache = new Map<string, CacheEntry>();
const STALE_TTL_MS = 20_000;

async function cached<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T> {
  const hit = responseCache.get(key) as CacheEntry<T> | undefined;
  if (hit) {
    if (hit.value !== undefined && Date.now() < hit.expiresAt) return hit.value;
    if (hit.promise) return hit.promise; // 진행 중인 요청에 합류
  }
  const lastGood = hit?.lastGood ?? hit?.value;

  const promise = produce()
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + ttlMs, lastGood: value });
      return value;
    })
    .catch((error: unknown) => {
      if (lastGood !== undefined) {
        // 직전 성공값으로 잠깐 버틴다. STALE_TTL 동안은 재시도하지 않아 KIS 부담도 던다.
        responseCache.set(key, { value: lastGood, expiresAt: Date.now() + STALE_TTL_MS, lastGood });
        return lastGood;
      }
      responseCache.delete(key);
      throw error;
    });

  responseCache.set(key, { promise, expiresAt: Date.now() + ttlMs, lastGood });
  return promise;
}

export async function fetchKisPriceHistory(ticker: string, range: string): Promise<PricePoint[]> {
  return cached(`history:${ticker}:${range}`, 60_000, () =>
    range === "1일" ? fetchIntradayHistory(ticker) : fetchDailyHistory(ticker, range),
  );
}

// ---------------------------------------------------------------------------
// 밸류에이션 지표 (PER/PBR/EPS/BPS/시가총액/배당수익률)
// ---------------------------------------------------------------------------

export function fetchValuation(ticker: string): Promise<Valuation> {
  return cached(`valuation:${ticker}`, 10 * 60_000, () => fetchValuationUncached(ticker));
}

async function fetchValuationUncached(ticker: string): Promise<Valuation> {
  const data = await kisGet("/uapi/domestic-stock/v1/quotations/inquire-price", "FHKST01010100", {
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: ticker,
  });
  const output = data.output ?? {};

  // 존재하지 않는 종목이어도 KIS는 rt_cd 0에 값만 0/빈칸으로 준다 — 0은 "데이터 없음"으로 취급.
  const positive = (value: number | null) => (value !== null && value > 0 ? value : null);
  const htsAvls = positive(toNumber(output.hts_avls)); // 억 원 단위
  const price = positive(toNumber(output.stck_prpr));

  return {
    per: positive(toNumber(output.per)),
    pbr: positive(toNumber(output.pbr)),
    eps: positive(toNumber(output.eps)),
    bps: positive(toNumber(output.bps)),
    marketCap: htsAvls !== null ? htsAvls * 1e8 : null,
    dividendYield: await fetchDividendYield(ticker, price).catch(() => null),
  };
}

/**
 * 배당수익률(= 최근 1년간 지급된 주당 현금배당금 합계 / 현재가). inquire-price에는 배당 정보가
 * 없어서 예탁원 배당일정(ksdinfo/dividend)에서 최근 배당 내역을 받아 직접 계산한다.
 * - KIS가 주는 "배당률"은 액면가 기준이라 쓰지 않고 시가 기준 수익률로 환산한다.
 * - 지급일(divi_pay_dt)이 최근 12개월인 건만 합산 → 금액 미확정(0원, 지급일 공백) 예고 행은 제외.
 */
async function fetchDividendYield(ticker: string, price: number | null): Promise<number | null> {
  if (!price) return null;

  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 500); // 기준일(record date)은 지급일보다 1~3개월 앞서므로 넉넉히

  const data = await kisGet("/uapi/domestic-stock/v1/ksdinfo/dividend", "HHKDB669102C0", {
    CTS: "",
    GB1: "0", // 배당 전체(결산+중간+분기)
    F_DT: yyyymmdd(start),
    T_DT: yyyymmdd(end),
    SHT_CD: ticker,
    HIGH_GB: "",
  });

  const twelveMonthsAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const paidWithinYear = (payDate: string | undefined) => {
    const digits = (payDate ?? "").replace(/\D/g, ""); // "2026/06/30" -> "20260630"
    if (digits.length !== 8) return false;
    const time = Date.parse(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`);
    return Number.isFinite(time) && time >= twelveMonthsAgo;
  };

  const annualDividendPerShare = asRows(data.output1)
    .filter((row) => row.sht_cd === ticker && paidWithinYear(row.divi_pay_dt))
    .reduce((sum, row) => sum + (toNumber(row.per_sto_divi_amt) ?? 0), 0);

  if (annualDividendPerShare <= 0) return null;
  return (annualDividendPerShare / price) * 100;
}
