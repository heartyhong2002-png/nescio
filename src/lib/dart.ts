import { serverEnv } from "./server-env";
import { IpoInfo } from "./types";

/**
 * 금융감독원 OpenDART(opendart.fss.or.kr) — 공모주(IPO) 청약 정보 조회.
 *
 * DART엔 "공모주 캘린더" 같은 완성된 API가 없어서, krx.ts와 똑같은 "목록 조회 -> 종목별 상세
 * 조회" 2단계 패턴으로 직접 조립한다:
 *
 *  1. 공시검색(list.json) — pblntf_ty=C(증권신고서) & pblntf_detail_ty=C001(지분증권)로 최근
 *     접수된 공시 목록을 받는다. 신규상장(IPO)과 이미 상장된 회사의 유상증자가 같은 공시
 *     유형(C001)에 섞여 있어서, stock_code가 빈 값인 것(=아직 상장 안 된 회사)만 골라 IPO
 *     후보로 취급한다 — 이건 DART 공식 문서로 보장된 규칙이 아니라 응답 구조를 보고 추정한
 *     규칙이라, 실제 데이터로 어긋나는 사례가 보이면 report_nm 텍스트 매칭 등 보조 규칙을
 *     추가해야 한다.
 *  2. 지분증권 상세(estkRs.json) — 후보 각각의 corp_code로 청약기일/공모가/주관사 등을 받는다.
 *
 * 상장(예정)일은 이 공시 시점엔 아직 KRX가 확정하기 전이라 DART 어디에도 없다 — "청약종료일 +
 * 2영업일"로 추정해서 estimatedListingDate에 담는다. 화면에서 반드시 "예상" 라벨을 붙여야 한다.
 */

const DART_BASE_URL = "https://opendart.fss.or.kr/api";

type DartListItem = {
  corp_code?: string;
  corp_name?: string;
  stock_code?: string;
  report_nm?: string;
  rcept_no?: string;
  rcept_dt?: string;
};

type DartListResponse = {
  status?: string;
  message?: string;
  page_no?: number;
  total_page?: number;
  list?: DartListItem[];
};

// 지분증권 상세(estkRs.json) 응답 필드 — DART 개발가이드(DS006/2020054)에서 확인한 실제 라벨.
//  sbd=청약기일, pymd=납입기일, sband=청약공고일, asand=배정공고일, asstd=배정기준일,
//  stksen=증권의종류, stkcnt=증권수량, slprc=모집(매출)가액, slta=모집(매출)총액,
//  actsen=인수인구분, actnmn=인수인명, udtamt=인수금액.
// 그룹별로 배열이 따로 오는지, 한 레코드에 다 섞여서 오는지는 실제 응답을 봐야 확정되므로,
// 모든 그룹을 한 번에 뒤져서 필드를 찾는 방어적인 방식으로 파싱한다.
type DartEstkRow = Record<string, string | undefined>;
type DartEstkResponse = {
  status?: string;
  message?: string;
  group?: { title?: string; list?: DartEstkRow[] }[];
  // 혹시 group 없이 평평하게 올 수도 있어 대비.
  list?: DartEstkRow[];
};

function dartUrl(path: string, params: Record<string, string>) {
  const key = serverEnv("DART_API_KEY");
  const query = new URLSearchParams({ crtfc_key: key ?? "", ...params });
  return `${DART_BASE_URL}/${path}?${query.toString()}`;
}

async function dartGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = serverEnv("DART_API_KEY");
  if (!key) throw new Error("DART_API_KEY가 설정되지 않았어요.");
  const response = await fetch(dartUrl(path, params), { cache: "no-store" });
  if (!response.ok) throw new Error(`DART API 오류 (${response.status})`);
  const data = (await response.json()) as T & { status?: string; message?: string };
  // DART는 "013"(조회된 데이터가 없음)을 정상 응답으로 준다 — 에러 취급하면 안 되고, 나머지
  // 000이 아닌 코드만 진짜 오류로 취급한다.
  if (data.status && data.status !== "000" && data.status !== "013") {
    throw new Error(`DART API 오류 (${data.status}): ${data.message ?? "알 수 없는 오류"}`);
  }
  return data;
}

/** YYYYMMDD -> YYYY-MM-DD. 형식이 아니면 null. */
function toIsoDate(value: string | undefined): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

/**
 * "청약기일" 필드(sbd)는 시작~종료가 한 문자열에 같이 온다. 실측(2026-09-14, 빅웨이브로보틱스)
 * 결과 실제 포맷은 "2026년 09월 15일 ~ 2026년 09월 16일"처럼 "YYYY년 MM월 DD일" 한글 표기였다
 * — 기존엔 "2026.09.15" 같은 구분자 포맷만 매칭해서 날짜를 하나도 못 찾고 조용히 걸러지는
 * 버그가 있었다. "년"/"월"도 구분자로 같이 인식하게 고치고, 혹시 모를 "."/"-"/"/" 포맷도 계속
 * 방어적으로 처리한다. 날짜 두 개를 못 찾으면 null을 반환해 화면에서 조용히 숨기게 한다.
 */
function parseSubscriptionRange(raw: string | undefined): { start: string | null; end: string | null } {
  if (!raw) return { start: null, end: null };
  const dates = [...raw.matchAll(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g)].map(
    ([, y, m, d]) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
  );
  if (dates.length === 0) return { start: null, end: null };
  if (dates.length === 1) return { start: dates[0], end: dates[0] };
  return { start: dates[0], end: dates[dates.length - 1] };
}

/** "10,000" / "10000원" 같은 문자열에서 숫자만 뽑는다. */
function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 영업일(주말 제외) n일 뒤 날짜를 YYYY-MM-DD로. 공휴일은 고려 안 함(추정치라 한계 명시). */
function addBusinessDays(isoDate: string, days: number): string | null {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function flattenEstkRows(data: DartEstkResponse): DartEstkRow[] {
  if (data.list && data.list.length > 0) return data.list;
  return (data.group ?? []).flatMap((g) => g.list ?? []);
}

/**
 * 그룹 제목(부분 일치)으로 그 그룹의 행만 뽑는다. estkRs.json은 "exprc"/"expd" 같은 필드명이
 * "일반사항" 그룹(용도 불명, 실측상 공모가와 우연히 같은 값)과 "일반청약자환매청구권" 그룹(풋백
 * 옵션 행사가/행사기간)에 이름만 같고 뜻이 다르게 중복돼서 나온다 — 전체를 한 번에 뒤지는
 * findField로는 엉뚱한 그룹의 값을 집어올 수 있어서, 이런 충돌 필드는 반드시 그룹을 지정해서
 * 읽어야 한다.
 */
function findGroupRows(data: DartEstkResponse, titleIncludes: string): DartEstkRow[] {
  return (data.group ?? []).find((g) => g.title?.includes(titleIncludes))?.list ?? [];
}

/** 여러 행에 흩어져 있을 수 있는 필드를 처음 발견되는 값으로 찾는다. */
function findField(rows: DartEstkRow[], ...keys: string[]) {
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== "") return value;
    }
  }
  return undefined;
}

/** "인수인정보" 그룹의 대표/공동 주관사를 전부 모아 "유진증권(대표) · 미래에셋증권(공동)" 형태로. */
function collectUnderwriters(rows: DartEstkRow[]): string | null {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const row of rows) {
    const name = row["actnmn"];
    if (!name || !name.trim() || seen.has(name)) continue;
    seen.add(name);
    const role = row["actsen"];
    parts.push(role ? `${name}(${role})` : name);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "일반청약자환매청구권"(풋백옵션) 그룹을 사람이 읽을 수 있는 한 줄 요약으로. 없으면 null. */
function summarizePutback(rows: DartEstkRow[]): string | null {
  const exprc = findField(rows, "exprc");
  const expd = findField(rows, "expd");
  const grtrs = findField(rows, "grtrs");
  if (!exprc && !expd) return null;
  const parts: string[] = [];
  if (expd) parts.push(`행사기간 ${expd.replace(/\n/g, " ")}`);
  if (exprc) parts.push(`행사가 ${exprc}원`);
  if (grtrs) parts.push(`사유: ${grtrs}`);
  return `일반청약자 환매청구권(풋백옵션) — ${parts.join(", ")}`;
}

const SUBSCRIPTION_TO_LISTING_BUSINESS_DAYS = 2;

// 실측(2026-09-14) 결과 pblntf_detail_ty=C001을 넘겨도 채무증권/파생결합증권/투자설명서 등
// 발행공시(C) 전체가 그대로 섞여 나오는 게 확인됐다 — 이 파라미터는 사실상 필터로 안 먹는다.
// 그래서 report_nm 텍스트에 "증권신고서"와 "지분증권"이 둘 다 있는 것만 후보로 남기는 방식으로
// 클라이언트 쪽에서 직접 거른다(초기 신고/[정정]/[발행조건확정] 전부 이 두 단어를 포함하는 걸
// 실측으로 확인함). 필터가 서버에서 안 걸러주니 대상 집합이 커져서(하루 발행공시만 100건 넘게
// 나올 때도 있음) 60일 치를 다 보려면 페이지 상한도 크게 잡아야 한다.
const MAX_LIST_PAGES = 60; // page_count=100 기준 최대 6,000건 — 60일 치 발행공시(C) 전체를 커버

function isEquityRegistrationTitle(reportNm: string | undefined) {
  return !!reportNm && reportNm.includes("증권신고서") && reportNm.includes("지분증권");
}

/**
 * 공시검색: 최근 접수된 "증권신고(지분증권)" 목록에서 아직 상장 안 된 회사(=IPO 후보)만 추린다.
 * 한 회사가 초기 신고 -> [정정] -> [발행조건확정]까지 같은 지분증권 건으로 여러 번 공시를
 * 내는 게 정상이라, 그대로 두면 화면에 같은 회사가 카드 여러 개로 중복 표시된다 — corp_code당
 * 가장 최근 접수(rcept_no가 가장 큰 것) 한 건만 남기고 나머지는 버린다.
 */
export async function searchIpoCandidates(bgnDe: string, endDe: string): Promise<DartListItem[]> {
  const byCorp = new Map<string, DartListItem>();
  let page = 1;
  for (; page <= MAX_LIST_PAGES; page += 1) {
    const data = await dartGet<DartListResponse>("list.json", {
      pblntf_ty: "C",
      pblntf_detail_ty: "C001",
      bgn_de: bgnDe,
      end_de: endDe,
      page_no: String(page),
      page_count: "100",
    });
    const list = data.list ?? [];
    for (const item of list) {
      const isUnlisted = !item.stock_code || item.stock_code.trim() === "";
      if (!isUnlisted || !isEquityRegistrationTitle(item.report_nm) || !item.corp_code) continue;
      const existing = byCorp.get(item.corp_code);
      // rcept_no는 "20260914000379"처럼 접수일+일련번호라 같은 자릿수 문자열 비교로 최신순 판단 가능.
      if (!existing || (item.rcept_no ?? "") > (existing.rcept_no ?? "")) byCorp.set(item.corp_code, item);
    }
    if (!data.total_page || page >= data.total_page) break;
  }
  return [...byCorp.values()];
}

/** 지분증권 상세를 IpoInfo로 정규화. 실패하거나 데이터가 없으면 null(krx.ts의 safe 패턴과 동일). */
export async function fetchIpoDetail(item: DartListItem, bgnDe: string, endDe: string): Promise<IpoInfo | null> {
  if (!item.corp_code || !item.corp_name) return null;
  try {
    const data = await dartGet<DartEstkResponse>("estkRs.json", {
      corp_code: item.corp_code,
      bgn_de: bgnDe,
      end_de: endDe,
    });
    const rows = flattenEstkRows(data);
    if (rows.length === 0) return null;

    const { start, end } = parseSubscriptionRange(findField(rows, "sbd"));
    const offerPrice = toNumber(findField(rows, "slprc"));
    const offerAmount = toNumber(findField(rows, "slta"));
    const totalShares = toNumber(findField(rows, "stkcnt"));
    const leadUnderwriter = collectUnderwriters(findGroupRows(data, "인수인정보"));
    const lockupNote = summarizePutback(findGroupRows(data, "환매청구권"));
    const receiptDate = toIsoDate(item.rcept_dt) ?? bgnDe;

    return {
      corpCode: item.corp_code,
      corpName: item.corp_name,
      subscriptionStart: start,
      subscriptionEnd: end,
      // slprc가 "10,000 ~ 12,000"처럼 범위로 올 수도, 확정 단일값으로 올 수도 있어 보인다 —
      // 범위 파싱은 parseSubscriptionRange처럼 별도로 처리하지 않고 우선 단일값으로 다룬다.
      offerPriceMin: offerPrice,
      offerPriceMax: offerPrice,
      estimatedListingDate: end ? addBusinessDays(end, SUBSCRIPTION_TO_LISTING_BUSINESS_DAYS) : null,
      leadUnderwriter,
      totalShares,
      offerAmount,
      lockupNote,
      receiptDate,
    };
  } catch (error) {
    console.warn(`[dart] ${item.corp_name}(${item.corp_code}) 상세 조회 실패, 건너뜀:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** 최근 60일 접수분 중 아직 청약이 끝나지 않은 공모주를 청약임박순으로 반환. */
export async function fetchUpcomingIpos(): Promise<IpoInfo[]> {
  const now = new Date();
  const end = now.toISOString().slice(0, 10).replaceAll("-", "");
  const begin = new Date(now);
  begin.setUTCDate(begin.getUTCDate() - 60);
  const bgnDe = begin.toISOString().slice(0, 10).replaceAll("-", "");

  // estkRs.json(상세)은 list.json(목록)과 같은 날짜 기준으로 안 걸린다 — 실측(빅웨이브로보틱스,
  // 목록엔 9/14 접수 [발행조건확정] 공시로 잡히는데도) 60일 창(7/17~9/15)으로 상세를 조회하면
  // "013(데이터 없음)"이 나오고, 훨씬 넓은 창으로 물어봐야 실제 데이터(최초 신고 9/3자)가
  // 나왔다. 즉 상세는 "이 지분증권 건이 최초로 접수된 시점" 근방을 찾는 것으로 보이는데, 그게
  // 정정/발행조건확정 공시일보다 몇 주~몇 달 더 과거일 수 있다. 그래서 상세 조회는 목록 조회보다
  // 훨씬 넓은 창(2년)을 따로 써서, 진짜 존재하는 공모주가 좁은 창 때문에 조용히 빠지는 걸 막는다.
  const detailBegin = new Date(now);
  detailBegin.setUTCDate(detailBegin.getUTCDate() - 730);
  const detailBgnDe = detailBegin.toISOString().slice(0, 10).replaceAll("-", "");

  const candidates = await searchIpoCandidates(bgnDe, end);
  const details = await Promise.allSettled(candidates.map((item) => fetchIpoDetail(item, detailBgnDe, end)));

  const today = now.toISOString().slice(0, 10);
  const ipos = details
    .filter((r): r is PromiseFulfilledResult<IpoInfo | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((ipo): ipo is IpoInfo => ipo !== null)
    // 청약종료일 정보가 없는 건 화면에 정렬 기준을 못 잡으니 제외하고, 청약이 이미 끝난(오늘보다
    // 전인) 건도 제외한다 — 진행 중이거나 앞으로 시작할 공모주만 보여달라는 요청 반영.
    .filter((ipo) => ipo.subscriptionEnd !== null && Date.parse(ipo.subscriptionEnd) >= Date.parse(today))
    .sort((a, b) => (a.subscriptionEnd ?? "").localeCompare(b.subscriptionEnd ?? ""));

  return ipos;
}
