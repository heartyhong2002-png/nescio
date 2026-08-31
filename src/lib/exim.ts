import { serverEnv } from "./server-env";
import { ExchangeRate } from "./types";
import { MAJOR_CURRENCY_CODES_CLIENT } from "./exchange-rate-constants";

/**
 * 한국수출입은행 Open API — 환율정보 (매매기준율 등).
 * https://oapi.koreaexim.go.kr — 무료, authkey 발급 필요, 일일 1000회 제한.
 * KRX/KIS처럼 영업일에만 데이터가 나온다(주말·공휴일은 빈 배열) — 그래서 최근 영업일까지
 * 며칠 거슬러 올라가며 값이 있는 날을 찾는 패턴을 그대로 재사용한다.
 *
 * 이 API가 제공하는 통화는 약 40개(주요국 + 아시아·중동·아프리카 일부 지역통화)로, 이게 "공식
 * 무료 API로 받을 수 있는 사실상 전체 범위"다 — 전 세계 모든 나라(약 190개) 통화를 다 주는
 * 무료 공식 소스는 없다시피 해서, 이 API가 커버하는 목록이 최대치라고 보면 된다.
 *
 * 주의: 요청 도메인이 www.koreaexim.go.kr에서 oapi.koreaexim.go.kr로 바뀌었다(구 도메인
 * 병행 가동은 2026.4.30 종료 — 한국수출입은행 홈페이지 공지사항 확인). 배포 환경에서 구 도메인으로
 * 호출했을 때 ECONNRESET/인증서 체인 오류가 오락가락했던 게 바로 이 때문이었다 — 퇴역 중인
 * 구 도메인이라 TLS/방화벽이 API 트래픽을 제대로 처리하지 못하고 있었던 것으로 보인다.
 * 신규 도메인으로 바꾸면서 별도의 인증서 검증 우회 없이 표준 fetch를 그대로 쓴다.
 */

type EximRow = {
  result: number;
  cur_unit?: string; // "USD", "JPY(100)"처럼 100단위 통화는 괄호로 표시됨
  cur_nm?: string; // 한글 통화명
  ttb?: string; // 전신환 매입율
  tts?: string; // 전신환 매도율
  deal_bas_r?: string; // 매매기준율
};

// result 코드(공지사항 기준): 1=성공, 2=데이터코드 오류, 3=인증키 오류(개인정보 보유기간 만료로
// 파기된 키일 가능성 높음 — 재발급 필요), 4=일일 호출 한도(1000회) 초과.
const RESULT_MESSAGES: Record<number, string> = {
  2: "EXIM_AUTH_KEY 요청이 올바르지 않아요. 발급받은 키를 다시 확인해주세요.",
  3: "EXIM_AUTH_KEY가 유효하지 않아요. 개인정보 보유기간(2년) 만료로 키가 파기됐을 수 있어요 — koreaexim.go.kr에서 재발급받아 EXIM_AUTH_KEY를 갱신해주세요.",
  4: "한국수출입은행 환율 API 일일 호출 한도(1,000회)를 초과했어요. 내일 다시 시도해주세요.",
};

const EXIM_BASE_URL = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON";

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "JPY(100)" -> { code: "JPY", unit: 100 }, "USD" -> { code: "USD", unit: 1 } */
function parseCurUnit(curUnit: string): { code: string; unit: number } {
  const match = curUnit.match(/^([A-Z]+)(?:\((\d+)\))?/);
  if (!match) return { code: curUnit, unit: 1 };
  return { code: match[1], unit: match[2] ? Number(match[2]) : 1 };
}

function dateString(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function fetchRatesForDate(basDd: string, key: string): Promise<ExchangeRate[]> {
  const url = `${EXIM_BASE_URL}?authkey=${encodeURIComponent(key)}&searchdate=${basDd}&data=AP01`;
  // 일부 공공기관 서버는 User-Agent가 없는 요청(자동화 도구로 의심)을 방화벽 단에서
  // 끊어버리는 경우가 있어, 브라우저처럼 보이는 User-Agent를 명시적으로 보낸다.
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });
  if (!response.ok) throw new Error(`수출입은행 환율 API 오류 (${response.status})`);
  const rows = ((await response.json()) ?? []) as EximRow[];

  // 키 오류(2/3)나 호출 한도 초과(4)는 그날 영업일 여부와 무관하게 모든 row가 동일한
  // result 코드로 오므로, 첫 row에서 바로 판별해 구체적인 원인을 알려준다. 이걸 안 하면
  // "그날은 데이터 없음"으로 오인해 8일치를 다 헛돌고 나서야 빈 결과를 반환하게 된다.
  if (rows.length > 0 && rows[0].result !== 1 && RESULT_MESSAGES[rows[0].result]) {
    throw new Error(RESULT_MESSAGES[rows[0].result]);
  }

  return rows
    .filter((row) => row.result === 1 && row.cur_unit && row.cur_nm && row.deal_bas_r)
    .map((row) => {
      const { code, unit } = parseCurUnit(row.cur_unit!);
      return {
        code,
        name: row.cur_nm!,
        unit,
        rate: toNumber(row.deal_bas_r) ?? 0,
        ttb: toNumber(row.ttb),
        tts: toNumber(row.tts),
      };
    })
    .filter((rate) => rate.rate > 0);
}

// 짧은 인메모리 캐시 — 환율은 하루 한 번만 바뀌므로 요청마다 새로 부를 필요가 없다.
let cache: { date: string; rates: ExchangeRate[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60_000; // 30분

/** 최근 영업일(최대 8일 전까지)의 환율 스냅샷을 반환한다. */
export async function fetchLatestExchangeRates(): Promise<{ date: string; rates: ExchangeRate[] }> {
  if (cache && Date.now() < cache.expiresAt) return { date: cache.date, rates: cache.rates };

  const key = serverEnv("EXIM_AUTH_KEY");
  if (!key) throw new Error("EXIM_AUTH_KEY를 .env에 설정하세요.");

  for (let offset = 0; offset < 8; offset += 1) {
    const basDd = dateString(offset);
    const rates = await fetchRatesForDate(basDd, key);
    if (rates.length > 0) {
      cache = { date: basDd, rates, expiresAt: Date.now() + CACHE_TTL_MS };
      return { date: basDd, rates };
    }
  }
  return { date: "", rates: [] };
}

/** AI 브리핑 프롬프트에 넣을 짧은 텍스트 한 줄. 실패해도 브리핑 자체는 죽지 않도록 호출부에서 try/catch로 감싸 쓴다. */
export async function fetchMajorRatesSummary(): Promise<string> {
  const { rates } = await fetchLatestExchangeRates();
  const seen = new Set<string>();
  // 위안화는 중국 본토가 공식 역내환율(CNY)을 직접 공급하지 않아 수출입은행도 역외위안화(CNH)로
  // 표기하는데, 혹시 API가 CNY로 줄 수도 있어 둘 다 후보에 넣어둔다(먼저 매칭되는 쪽 사용).
  const majors = MAJOR_CURRENCY_CODES_CLIENT.map((code) => rates.find((rate) => rate.code === code)).filter(
    (rate): rate is ExchangeRate => {
      if (!rate || seen.has(rate.code)) return false;
      seen.add(rate.code);
      return true;
    },
  );
  if (majors.length === 0) return "";
  return majors
    .map((rate) => `${rate.code}${rate.unit > 1 ? `(${rate.unit})` : ""} ${rate.rate.toLocaleString("ko-KR")}원`)
    .join(", ");
}
