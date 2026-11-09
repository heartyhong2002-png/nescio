import type { IpoDemandForecast } from "./types";

/**
 * 38커뮤니케이션(38.co.kr) 공모주 데이터 크롤러 / 보강 모듈.
 *
 * 금융감독원 OpenDART 구조화 API(estkRs.json)에는 "수요예측 결과(기관 경쟁률, 의무보유확약 비율,
 * 참여기관 수, 상단 이상 주문 비율)", "증권사별 실제 일반청약자 배정 주식수 & 최고 청약한도",
 * "청약 경쟁률", "연도별 재무제표·유통가능물량·동종 비교기업" 등이 들어있지 않아서,
 * 국내 공모주 포털인 38커뮤니케이션 상세 페이지에서 해당 정보들을 정밀 수집하여 합성한다.
 */

export type ScrapedUnderwriter = {
  name: string; // 증권사명 (예: "IBK투자증권", "유진투자증권")
  shares: number | null; // 일반청약자 배정 주식수 (예: 300000)
  sharesText: string | null; // 원문 (예: "300,000 주")
  limit: string | null; // 최고 청약 한도 (예: "15,000~18,000 주")
  role: string | null; // 대표주관 / 공동주관 / 인수
};

export type ScrapedIpoData = {
  no: string; // 38 종목 번호
  rawName: string; // 원문 기업명 (예: "덕산넵코어스(구.넵코어스)")
  name: string; // 정규화된 기업명 (예: "덕산넵코어스")
  subscriptionStart: string | null; // YYYY-MM-DD
  subscriptionEnd: string | null; // YYYY-MM-DD
  refundDate: string | null; // YYYY-MM-DD
  paymentDate: string | null; // YYYY-MM-DD
  listingDate: string | null; // YYYY-MM-DD (상장일 확정/예정)
  demandForecastDate: string | null; // 수요예측 기간 (예: "2026-12-02 ~ 2026-12-08")
  hopePriceBand: string | null; // 희망공모가 밴드 (예: "16,500 ~ 19,500원")
  confirmedPrice: number | null; // 확정 공모가 (원)
  offerAmount: number | null; // 공모금액 (원)
  institutionCompetitionRate: string | null; // 기관 경쟁률 (예: "1187.74:1")
  lockupRatio: string | null; // 의무보유확약 비율 (예: "21.75%")
  subscriptionCompetitionRate: string | null; // 일반 청약 경쟁률 (예: "1375.34:1")
  demandForecast: IpoDemandForecast | null; // 수요예측 세부 지표 (참여건수, 상단이상 비율 등)
  totalShares: number | null; // 총 공모주식수
  minShares: number | null; // 최소 청약 단위
  underwriters: ScrapedUnderwriter[]; // 증권사별 배정 & 한도
  sector: string | null; // 업종
  ceo: string | null; // 대표자명
  companySize: string | null; // 기업구분
  homepage: string | null; // 홈페이지 URL
  phone: string | null; // 대표전화
  address: string | null; // 본사 소재지
  revenue: string | null; // 최근 매출액
  profit: string | null; // 순이익 또는 세전계속사업이익
  capital: string | null; // 자본금
  summary: string | null; // 1.사업현황 기반 기업 개요
  products: string | null; // 주력 제품/서비스 요약
  financialHistory: Array<{
    year: string;
    revenue: string | null;
    operatingProfit: string | null;
    netProfit: string | null;
  }>;
  executiveHoldings: Array<{
    name: string;
    role: string | null;
    shares: string | null;
    ownershipRate: string | null;
  }>;
  offeringUse: string | null; // 공모구조(신주/구주) 및 자금조달 요약
  correctionNotice: string | null; // 최근 증권신고서 정정/확정 공시 이력
  peerCompanies: string | null; // 비교 기업 (Peer Group)
  tradableShares: string | null; // 상장 직후 유통가능물량 요약
  marketCapEstimate: string | null; // 예상 시가총액 요약
};

type CacheEntry = {
  data: Map<string, ScrapedIpoData>;
  expiresAt: number;
};

let memoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000;

async function fetchEucKr(url: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const buf = await res.arrayBuffer();
      return new TextDecoder("euc-kr").decode(buf);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`38커뮤니케이션 요청 실패: ${url}`);
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function firstHref(html: string): string | null {
  const match = html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1]?.trim() || null;
}

export function normalizeCorpName(name: string): string {
  return name
    .replace(/\(주\)/g, "")
    .replace(/\(구\..*?\)/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function normalizeBrokerName(name: string): string {
  return normalizeCorpName(name)
    .replace(/아이비케이/g, "IBK")
    .replace(/케이비/g, "KB")
    .replace(/에스케이/g, "SK")
    .replace(/엔에이치/g, "NH")
    .replace(/비엔케이/g, "BNK")
    .replace(/디비/g, "DB")
    .replace(/투자증권|증권|투자/g, "")
    .trim();
}

function toNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseShares(str: string | null | undefined): number | null {
  if (!str) return null;
  const rangeMatch = str.match(/([\d,]+)\s*~\s*([\d,]+)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1].replace(/[^\d]/g, ""));
    const max = Number(rangeMatch[2].replace(/[^\d]/g, ""));
    return Number.isFinite(max) && max > 0 ? max : Number.isFinite(min) ? min : null;
  }
  return toNumber(str);
}

/** 희망공모가 밴드("19,000 ~ 23,000 원")에서 최소·최대 금액 추출 */
export function parsePriceBand(band: string | null | undefined): { min: number | null; max: number | null } {
  if (!band) return { min: null, max: null };
  const rangeMatch = band.match(/([\d,]+)\s*~\s*([\d,]+)/);
  if (rangeMatch) {
    const min = toNumber(rangeMatch[1]);
    const max = toNumber(rangeMatch[2]);
    return { min, max };
  }
  const single = toNumber(band);
  return { min: single, max: single };
}

function parseDates(dateStr: string): { start: string | null; end: string | null } {
  const m = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(?:(\d{4})\.)?(\d{2})\.(\d{2})/);
  if (!m) return { start: null, end: null };
  const y = m[1];
  const start = `${y}-${m[2]}-${m[3]}`;
  const endY = m[4] || y;
  const end = `${endY}-${m[5]}-${m[6]}`;
  return { start, end };
}

function parseSingleIsoDate(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === "-" || raw.trim() === "") return null;
  const m = raw.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function formatFinancialUnit(rawVal: string | null | undefined): string | null {
  if (!rawVal || rawVal === "-" || rawVal === "N/A") return null;
  const num = toNumber(rawVal);
  if (num === null) return rawVal;
  const abs = Math.abs(num);
  // 원 단위(예: 14,984,562,642) 또는 천원 단위(예: 19,561,365)를 백만원 단위로 보기 좋게 변환
  if (abs >= 100_000_000) {
    const inMillions = Math.round(num / 1_000_000);
    return `${inMillions.toLocaleString()}백만원`;
  }
  if (abs >= 500_000) {
    const inMillions = Math.round(num / 1_000);
    return `${inMillions.toLocaleString()}백만원`;
  }
  return `${num.toLocaleString()}백만원`;
}

function formatKoreanWonEstimate(amountWon: number): string {
  const eok = Math.round(amountWon / 100_000_000);
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const remEok = eok % 10000;
    return remEok > 0 ? `약 ${jo}조 ${remEok.toLocaleString()}억 원` : `약 ${jo}조 원`;
  }
  return `약 ${eok.toLocaleString()}억 원`;
}

/** 38 공모주 상세 페이지(o=v&no=...)에서 상세 배정, 수요예측, 재무, 주주, 동종기업 등 전수 파싱 */
async function scrape38Detail(no: string): Promise<{
  institutionCompetitionRate: string | null;
  lockupRatio: string | null;
  subscriptionCompetitionRate: string | null;
  band: string | null;
  confirmedPrice: number | null;
  offerAmount: number | null;
  refundDate: string | null;
  paymentDate: string | null;
  listingDate: string | null;
  demandForecastDate: string | null;
  demandForecast: IpoDemandForecast | null;
  totalShares: number | null;
  minShares: number | null;
  underwriters: ScrapedUnderwriter[];
  sector: string | null;
  ceo: string | null;
  companySize: string | null;
  homepage: string | null;
  phone: string | null;
  address: string | null;
  revenue: string | null;
  profit: string | null;
  capital: string | null;
  summary: string | null;
  products: string | null;
  financialHistory: ScrapedIpoData["financialHistory"];
  executiveHoldings: ScrapedIpoData["executiveHoldings"];
  offeringUse: string | null;
  correctionNotice: string | null;
  peerCompanies: string | null;
  tradableShares: string | null;
  marketCapEstimate: string | null;
}> {
  try {
    const html = await fetchEucKr(`http://www.38.co.kr/html/fund/?o=v&no=${no}`);
    const trMatches = [...html.matchAll(/<tr\b[^>]*>((?:(?!<tr\b)[\s\S])*?)<\/tr>/gi)];

    let institutionCompetitionRate: string | null = null;
    let lockupRatio: string | null = null;
    let subscriptionCompetitionRate: string | null = null;
    let band: string | null = null;
    let confirmedPrice: number | null = null;
    let offerAmount: number | null = null;
    let refundDate: string | null = null;
    let paymentDate: string | null = null;
    let listingDate: string | null = null;
    let demandForecastDate: string | null = null;
    let totalShares: number | null = null;
    let minShares: number | null = null;

    let sector: string | null = null;
    let ceo: string | null = null;
    let companySize: string | null = null;
    let homepage: string | null = null;
    let phone: string | null = null;
    let address: string | null = null;
    let revenue: string | null = null;
    let preTaxProfit: string | null = null;
    let profit: string | null = null;
    let capital: string | null = null;

    let offeringStructure: string | null = null;
    let tradableShares: string | null = null;
    let postIpoTotalShares: number | null = null;
    let peerCompanies: string | null = null;
    let correctionNotice: string | null = null;

    // 수요예측 세부 테이블용 상태
    let institutionParticipationCount: number | null = null;
    let upperBandCount = 0;
    let hasUpperBandCount = false;
    let upperBandRatioSum = 0;
    let hasUpperBandRatio = false;
    let lockupSharesSum: string | null = null;
    let lockupTableRatio: string | null = null;
    let lockupCommittedCount = 0;
    let hasLockupCommittedCount = false;

    let nextRowIsParticipation = false;
    let inPriceDistTable = false;
    let inLockupTable = false;

    const minMatch = html.match(/(?:최소\s*청약\s*(?:단위|수량|주식수)?|청약단위)\s*[:：]?\s*([0-9,]+)\s*주/i);
    if (minMatch) {
      minShares = toNumber(minMatch[1]);
    }

    const leadRowBrokers: string[] = [];
    let leadRowShares: number | null = null;
    let leadRowSharesText: string | null = null;
    let leadRowLimit: string | null = null;
    const syndicateUnderwriters: ScrapedUnderwriter[] = [];
    let inUnderwriterTable = false;

    const nonNestedRows: string[][] = [];

    for (const tr of trMatches) {
      const tds = [...tr[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((m) => cleanText(m[1]));
      if (tds.length === 0) continue;
      if (!tr[1].includes("<table") && !tr[1].includes("<TABLE")) {
        nonNestedRows.push(tds);
      }
      const rowStr = tds.join(" | ");

      // 기업 개요 정보 추출
      if (tds[0] === "업종" && tds[1]) {
        sector = tds[1] !== "-" ? tds[1] : null;
      }

      if (tds[0] === "본점소재지" && tds[1] && tds[1] !== "-") {
        address = tds[1];
      }

      if (tds[0] === "대표자") {
        if (tds[1] && tds[1] !== "-") ceo = tds[1];
        if (tds[2] === "기업구분" && tds[3] && tds[3] !== "-") companySize = tds[3];
      } else if (tds[0] === "기업구분" && tds[1] && tds[1] !== "-") {
        companySize = tds[1];
      }

      if (tds[0] === "홈페이지") {
        const homepageCell = [...tr[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)][1]?.[1] ?? tr[1];
        const homepageHref = firstHref(homepageCell);
        if ((tds[1] && tds[1] !== "-" && tds[1] !== "") || homepageHref) {
          let hp = homepageHref ?? tds[1];
          if (!hp.startsWith("http://") && !hp.startsWith("https://")) {
            hp = `https://${hp}`;
          }
          homepage = hp;
        }
        if (tds[2] === "대표전화" && tds[3] && tds[3] !== "-") phone = tds[3];
      }

      if (tds[0] === "매출액") {
        if (!revenue && tds[1] && tds[1] !== "-") revenue = tds[1];
        if (!preTaxProfit && tds[2]?.includes("이익") && tds[3] && tds[3] !== "-") {
          preTaxProfit = tds[3];
          if (!profit) profit = tds[3];
        }
      }

      if (tds[0] === "순이익") {
        if (!profit && tds[1] && tds[1] !== "-") profit = tds[1];
        if (!capital && tds[2] === "자본금" && tds[3] && tds[3] !== "-") capital = tds[3];
      } else if (tds[0] === "자본금" && !capital && tds[1] && tds[1] !== "-") {
        capital = tds[1];
      }

      if (tds[0] === "상장공모" && tds[1] && tds[1] !== "-") {
        offeringStructure = tds[1];
      }

      // 일정 및 공모금액 추출
      for (let i = 0; i < tds.length - 1; i++) {
        if (tds[i] === "수요예측일" && tds[i + 1] && tds[i + 1] !== "-") {
          const parsedRange = parseDates(tds[i + 1]);
          demandForecastDate =
            parsedRange.start && parsedRange.end ? `${parsedRange.start} ~ ${parsedRange.end}` : tds[i + 1];
        }
        if (tds[i] === "납입일" && tds[i + 1]) {
          paymentDate = parseSingleIsoDate(tds[i + 1]) ?? paymentDate;
        }
        if (tds[i] === "환불일" && tds[i + 1]) {
          refundDate = parseSingleIsoDate(tds[i + 1]) ?? refundDate;
        }
        if ((tds[i] === "상장일" || tds[i] === "신규상장일") && tds[i + 1]) {
          listingDate = parseSingleIsoDate(tds[i + 1]) ?? listingDate;
        }
        if (tds[i] === "공모금액" && tds[i + 1] && tds[i + 1] !== "-") {
          const rawAmt = toNumber(tds[i + 1]);
          if (rawAmt !== null && rawAmt > 0) {
            offerAmount = tds[i + 1].includes("백만원") ? rawAmt * 1_000_000 : rawAmt;
          }
        }
      }

      // 1. 수요예측결과 (기관경쟁률 / 의무보유확약)
      if (rowStr.includes("수요예측결과") && tds.length >= 4) {
        for (let i = 0; i < tds.length; i++) {
          if (tds[i] === "기관경쟁률" && tds[i + 1] && tds[i + 1] !== "-") {
            institutionCompetitionRate = tds[i + 1];
          }
          if (tds[i] === "의무보유확약" && tds[i + 1] && tds[i + 1] !== "-" && tds[i + 1] !== "0.00%") {
            lockupRatio = tds[i + 1];
          }
        }
      }

      // 2. 희망공모가액 및 청약경쟁률
      if (tds[0] === "희망공모가액") {
        if (tds[1] && tds[1] !== "-") band = tds[1];
        if (tds[2] === "청약경쟁률" && tds[3] && tds[3] !== "-") {
          subscriptionCompetitionRate = tds[3];
        }
      }

      // 3. 확정공모가
      if (tds[0] === "확정공모가" || tds[0] === "확정공모가액") {
        const cp = toNumber(tds[1]);
        if (cp !== null && cp > 0) confirmedPrice = cp;
      }

      // 4. 총공모주식수
      if (tds[0] === "총공모주식수") {
        totalShares = toNumber(tds[1]);
      }

      // 5. 복수 주관사 테이블 ("인수회사" 헤더 아래)
      if (tds[0] === "인수회사" && tds[1] === "주식수") {
        inUnderwriterTable = true;
        continue;
      }

      if (inUnderwriterTable) {
        if (tds.length >= 3 && (tds[0].includes("증권") || tds[0].includes("투자") || tds[0].includes("은행"))) {
          syndicateUnderwriters.push({
            name: tds[0].trim(),
            shares: parseShares(tds[1]),
            sharesText: tds[1] || null,
            limit: tds[2] && tds[2] !== "-" ? tds[2] : null,
            role: tds[3]
              ? tds[3].includes("대표")
                ? "대표주관"
                : tds[3].includes("공동")
                ? "공동주관"
                : tds[3]
              : "인수회사",
          });
        } else {
          inUnderwriterTable = false;
        }
      }

      // 6. 단일/복수 주관사 요약 행 ("주간사" row)
      if (tds[0] === "주간사") {
        const rawNames = tds[1] ? tds[1].split(/[,/·]/).map((s) => s.trim()).filter(Boolean) : [];
        for (const rn of rawNames) {
          if (!leadRowBrokers.includes(rn)) leadRowBrokers.push(rn);
        }
        const mShares = tds[2]?.match(/주식수:\s*([\d, ~]+)\s*주/);
        const mLimit = tds[2]?.match(/청약한도:\s*([^\/]+주)/);
        if (mShares) {
          leadRowShares = parseShares(mShares[1]);
          leadRowSharesText = `${mShares[1].trim()} 주`;
        }
        if (mLimit && !mLimit[1].includes("-")) {
          leadRowLimit = mLimit[1].trim();
        }
      }
    }

    // nonNestedRows 순회하며 수요예측 세부표, 유통가능물량, 주주현황, 동종기업, 최근공시 추출
    const executiveHoldings: ScrapedIpoData["executiveHoldings"] = [];
    const financialHistory: ScrapedIpoData["financialHistory"] = [];

    for (let rIdx = 0; rIdx < nonNestedRows.length; rIdx++) {
      const tds = nonNestedRows[rIdx];

      // (A) 수요예측 참여건수 표
      if (tds[0]?.includes("참여건수") && tds[1]?.includes("신청주식수") && tds[2]?.includes("단순경쟁")) {
        nextRowIsParticipation = true;
        continue;
      }
      if (nextRowIsParticipation) {
        nextRowIsParticipation = false;
        const cnt = toNumber(tds[0]);
        if (cnt !== null && cnt > 0) institutionParticipationCount = cnt;
      }

      // (B) 수요예측 신청가격 분포표
      if (tds[0] === "구분" && tds[1]?.includes("참여건수") && tds[3]?.includes("비율")) {
        inPriceDistTable = true;
        continue;
      }
      if (inPriceDistTable) {
        if (tds[0] === "합계" || tds.length < 4) {
          inPriceDistTable = false;
        } else {
          const label = tds[0];
          if (label.includes("상단") && !label.includes("미만")) {
            const c = toNumber(tds[1]);
            const ratio = toNumber(tds[3]);
            if (c !== null) {
              upperBandCount += c;
              hasUpperBandCount = true;
            }
            if (ratio !== null) {
              upperBandRatioSum += ratio;
              hasUpperBandRatio = true;
            }
          }
        }
      }

      // (C) 의무보유확약 신청수량 표
      if (tds[0] === "구분" && tds[1]?.includes("신청수량")) {
        inLockupTable = true;
        continue;
      }
      if (inLockupTable) {
        if (tds[0]?.includes("비율") && tds[1]) {
          if (tds[1] !== "0.00%" && tds[1] !== "-") lockupTableRatio = tds[1];
          inLockupTable = false;
        } else if (tds[0] === "합계" && tds[1]) {
          const sumNum = toNumber(tds[1]);
          if (sumNum !== null && sumNum > 0) {
            lockupSharesSum = `${sumNum.toLocaleString()}주`;
          }
          if (tds.length >= 3) {
            const instCnt = toNumber(tds[2]);
            if (instCnt !== null && instCnt > 0) {
              lockupCommittedCount = instCnt;
              hasLockupCommittedCount = true;
            }
          }
        }
      }

      // (D) 공모후 유통가능물량 총계 행
      if (tds[0] === "총계" && tds.length >= 7) {
        const postSharesNum = toNumber(tds[3]);
        if (postSharesNum && postSharesNum > 0) {
          postIpoTotalShares = postSharesNum;
        }
        // 컬럼 순서는 보통 [총계, 공모전주식수, 지분율, 공모후주식수, 지분율, 유통가능/제한, 지분율, 제한/유통, 지분율]
        const col5 = tds[5];
        const col6 = tds[6];
        const col8 = tds[8];
        if (col5 && col6 && (col6.includes("%") || !Number.isNaN(Number(col6)))) {
          const pct1 = col6.includes("%") ? col6 : `${col6}%`;
          const pct2 = col8 ? (col8.includes("%") ? col8 : `${col8}%`) : null;
          tradableShares = `공모후 총 ${ tds[3] }주 중 ${col5}주 (${pct1})` + (pct2 && pct2 !== "-%" ? ` · 잔여 ${pct2}` : "");
        }
      }

      // (E) 최대주주 및 임원 지분 현황
      if (tds[0] === "최대주주등" && tds.length >= 6 && executiveHoldings.length < 5) {
        const name = tds[1];
        if (name && name !== "소계" && name !== "합계") {
          const hasRelation = !/^[\d,]+$/.test(tds[2] || "");
          const role = hasRelation ? tds[2] : "최대주주등";
          const postShares = hasRelation ? tds[5] : tds[4];
          const postRatio = hasRelation ? tds[6] : tds[5];
          const lockPeriod = tds[tds.length - 1];
          if (postShares && postShares !== "-") {
            executiveHoldings.push({
              name,
              role: lockPeriod && lockPeriod.includes("상장일") ? `${role} (${lockPeriod})` : role,
              shares: `${postShares}주`,
              ownershipRate: postRatio?.includes("%") ? postRatio : postRatio ? `${postRatio}%` : null,
            });
          }
        }
      }

      // (F) 동종업체(Peer Group) 비교
      if ((tds[0] === "구분" || tds[0] === "구 분") && tds[1]?.includes("동사") && tds.length >= 3) {
        const peers = tds
          .slice(2)
          .map((s) => s.replace(/\(.*?\)/g, "").trim())
          .filter((s) => s && s !== "-" && !s.includes("평균"));
        if (peers.length > 0) peerCompanies = peers.join(", ");
      }

      // (G) 최근 증권신고서 공시 이력
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(tds[0] || "") && tds[1]?.includes("증권신고서") && !correctionNotice) {
        correctionNotice = `${tds[0].replace(/\//g, "-")} ${tds[1]}`;
      }
    }

    // (H) 연도별 재무 이력 파싱
    for (let rIdx = 0; rIdx < nonNestedRows.length; rIdx++) {
      const tds = nonNestedRows[rIdx];
      if ((tds[0] === "구분" || tds[0] === "구 분") && tds.slice(1).some((c) => /202\d/.test(c))) {
        const years = tds.slice(1).filter((c) => /202\d/.test(c) && !c.includes("평균"));
        if (years.length >= 2 && financialHistory.length === 0) {
          const revMap: Record<string, string | null> = {};
          const opMap: Record<string, string | null> = {};
          const netMap: Record<string, string | null> = {};
          for (let sub = rIdx + 1; sub < Math.min(rIdx + 12, nonNestedRows.length); sub++) {
            const sRow = nonNestedRows[sub];
            if (sRow[0]?.startsWith("매출액") && !sRow[0].includes("성장") && !sRow[0].includes("증가")) {
              years.forEach((yr, idx) => (revMap[yr] = formatFinancialUnit(sRow[idx + 1])));
            } else if (sRow[0]?.startsWith("영업이익") && !sRow[0].includes("률") && !sRow[0].includes("증가")) {
              years.forEach((yr, idx) => (opMap[yr] = formatFinancialUnit(sRow[idx + 1])));
            } else if ((sRow[0]?.startsWith("당기순이익") || sRow[0] === "순이익") && !sRow[0].includes("률")) {
              years.forEach((yr, idx) => (netMap[yr] = formatFinancialUnit(sRow[idx + 1])));
            }
          }
          if (Object.keys(revMap).length > 0) {
            for (const yr of years) {
              financialHistory.push({
                year: yr.replace(/\(.*?\)/g, "").trim(),
                revenue: revMap[yr] ?? null,
                operatingProfit: opMap[yr] ?? null,
                netProfit: netMap[yr] ?? null,
              });
            }
          }
        }
      }
    }

    // 만약 상세 손익계산서 테이블이 아직 안 올라온 초기 종목이면 상단 기본 재무 수치로 최신 결산 재무행 구성
    if (financialHistory.length === 0 && (revenue || preTaxProfit || profit)) {
      financialHistory.push({
        year: "최근 결산",
        revenue: revenue,
        operatingProfit: preTaxProfit,
        netProfit: profit,
      });
    }

    // (I) 1.사업현황 원문에서 기업 개요 및 주력 제품 추출
    let summary: string | null = null;
    let products: string | null = null;
    const fullText = cleanText(html);
    const bizMatch = fullText.match(/1\.\s*사업현황\s*([\s\S]{20,2500}?)(?:2\.\s*매출현황|3\.\s*재무현황)/);
    if (bizMatch) {
      const rawBiz = bizMatch[1]
        .replace(/^[-·\s]+/, "")
        .replace(/ShowSubMenu\([^)]*\);?/g, "")
        .trim();
      summary = rawBiz.length > 360 ? `${rawBiz.slice(0, 360).trim()}...` : rawBiz;
      products = summary;
    }

    // (J) 예상 시가총액 및 공모 구조 요약
    const parsedBand = parsePriceBand(band);
    const refPrice = confirmedPrice ?? parsedBand.max ?? parsedBand.min;
    let marketCapEstimate: string | null = null;
    if (postIpoTotalShares && refPrice) {
      marketCapEstimate = `${formatKoreanWonEstimate(postIpoTotalShares * refPrice)} (${confirmedPrice ? "확정공모가" : "희망밴드 상단"} 기준)`;
    } else if (offerAmount) {
      marketCapEstimate = `공모규모 ${formatKoreanWonEstimate(offerAmount)}`;
    }

    const offeringUseParts: string[] = [];
    if (offeringStructure) offeringUseParts.push(offeringStructure);
    if (offerAmount) offeringUseParts.push(`공모총액 ${formatKoreanWonEstimate(offerAmount)}`);
    if (tradableShares) offeringUseParts.push(tradableShares);
    const offeringUse = offeringUseParts.length > 0 ? offeringUseParts.join(" · ") : null;

    // (K) 수요예측 세부 결과 객체 조립
    const finalLockupRatio = lockupRatio ?? lockupTableRatio;
    const hasDemandDetails =
      institutionParticipationCount !== null ||
      hasUpperBandCount ||
      hasUpperBandRatio ||
      lockupSharesSum !== null ||
      finalLockupRatio !== null;

    const demandForecast: IpoDemandForecast | null = hasDemandDetails
      ? {
          institutionParticipationCount,
          upperBandOrAboveOrderRatio: hasUpperBandRatio ? `${upperBandRatioSum.toFixed(2)}%` : null,
          upperBandOrAboveInstitutionCount: hasUpperBandCount ? upperBandCount : null,
          lockupCompetitionRate: lockupSharesSum
            ? `${lockupSharesSum}${finalLockupRatio ? ` (${finalLockupRatio})` : ""}`
            : finalLockupRatio,
          lockupInstitutionCount: hasLockupCommittedCount ? lockupCommittedCount : null,
          lockupInstitutionRatio: finalLockupRatio,
        }
      : null;

    // 주관사 전체 병합
    const underwriters: ScrapedUnderwriter[] = [];
    if (syndicateUnderwriters.length > 0) {
      underwriters.push(...syndicateUnderwriters);
      for (const b of leadRowBrokers) {
        const exists = underwriters.some((u) => u.name.includes(b) || b.includes(u.name));
        if (!exists) {
          underwriters.push({
            name: b,
            shares: null,
            sharesText: null,
            limit: null,
            role: "주관",
          });
        }
      }
    } else {
      for (let idx = 0; idx < leadRowBrokers.length; idx++) {
        const b = leadRowBrokers[idx];
        underwriters.push({
          name: b,
          shares: leadRowBrokers.length === 1 ? leadRowShares : null,
          sharesText: leadRowBrokers.length === 1 ? leadRowSharesText : null,
          limit: leadRowBrokers.length === 1 ? leadRowLimit : null,
          role: idx === 0 ? "대표주관" : "공동주관",
        });
      }
    }

    return {
      institutionCompetitionRate,
      lockupRatio: finalLockupRatio,
      subscriptionCompetitionRate,
      band,
      confirmedPrice,
      offerAmount,
      refundDate,
      paymentDate,
      listingDate,
      demandForecastDate,
      demandForecast,
      totalShares,
      minShares: minShares ?? 10,
      underwriters,
      sector,
      ceo,
      companySize,
      homepage,
      phone,
      address,
      revenue,
      profit,
      capital,
      summary,
      products,
      financialHistory,
      executiveHoldings,
      offeringUse,
      correctionNotice,
      peerCompanies,
      tradableShares,
      marketCapEstimate,
    };
  } catch (err) {
    console.warn(`[ipo-scraper] detail for no=${no} failed:`, err instanceof Error ? err.message : err);
    return {
      institutionCompetitionRate: null,
      lockupRatio: null,
      subscriptionCompetitionRate: null,
      band: null,
      confirmedPrice: null,
      offerAmount: null,
      refundDate: null,
      paymentDate: null,
      listingDate: null,
      demandForecastDate: null,
      demandForecast: null,
      totalShares: null,
      minShares: 10,
      underwriters: [],
      sector: null,
      ceo: null,
      companySize: null,
      homepage: null,
      phone: null,
      address: null,
      revenue: null,
      profit: null,
      capital: null,
      summary: null,
      products: null,
      financialHistory: [],
      executiveHoldings: [],
      offeringUse: null,
      correctionNotice: null,
      peerCompanies: null,
      tradableShares: null,
      marketCapEstimate: null,
    };
  }
}

/** 38커뮤니케이션에서 최근 공모주 청약 목록과 수요예측 결과를 가져와 Map으로 반환 */
export async function fetch38IpoData(): Promise<Map<string, ScrapedIpoData>> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    return memoryCache.data;
  }

  try {
    const [htmlK, htmlR1] = await Promise.all([
      fetchEucKr("http://www.38.co.kr/html/fund/index.htm?o=k"),
      fetchEucKr("http://www.38.co.kr/html/fund/index.htm?o=r1"),
    ]);
    const rawItems: {
      no: string;
      rawName: string;
      name: string;
      subDates: string;
      confirmedPriceStr: string | null;
      band: string | null;
      subComp: string | null;
      lead: string;
    }[] = [];

    const trMatchesK = [...htmlK.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const tr of trMatchesK) {
      const linkMatch = tr[1].match(
        /href=['"](?:\.\/|\/html\/fund\/)?(?:\?|index\.htm\?)o=v&(?:amp;)?no=(\d+)[^'"]*['"][^>]*>([\s\S]*?)<\/a>/i,
      );
      if (!linkMatch) continue;
      const no = linkMatch[1];
      const rawName = cleanText(linkMatch[2]);
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cleanText(m[1]));
      if (tds.length >= 6) {
        rawItems.push({
          no,
          rawName,
          name: normalizeCorpName(rawName),
          subDates: tds[1],
          confirmedPriceStr: tds[2] !== "-" ? tds[2] : null,
          band: tds[3] !== "-" ? tds[3] : null,
          subComp: tds[4] && tds[4] !== "-" ? tds[4] : null,
          lead: tds[5],
        });
      }
    }

    // 2. 수요예측 결과 목록(o=r1)
    const forecastMap = new Map<
      string,
      {
        institutionCompetitionRate: string | null;
        lockupRatio: string | null;
        confirmedPrice: number | null;
      }
    >();

    const trMatchesR1 = [...htmlR1.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const tr of trMatchesR1) {
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cleanText(m[1]));
      if (tds.length >= 7 && tds[0] && !tds[0].includes("비상장")) {
        const name = normalizeCorpName(tds[0]);
        forecastMap.set(name, {
          institutionCompetitionRate: tds[5] !== "-" && tds[5] ? tds[5] : null,
          lockupRatio: tds[6] !== "-" && tds[6] && tds[6] !== "0.00%" ? tds[6] : null,
          confirmedPrice: toNumber(tds[3]),
        });
      }
    }

    const resultMap = new Map<string, ScrapedIpoData>();
    const targets = rawItems.filter((item, index) => index < 25 || forecastMap.has(item.name));

    const batchSize = 6;
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          const detail = await scrape38Detail(item.no);
          const forecast = forecastMap.get(item.name);
          const { start, end } = parseDates(item.subDates);

          const institutionCompetitionRate =
            forecast?.institutionCompetitionRate ?? detail.institutionCompetitionRate;
          const lockupRatio = forecast?.lockupRatio ?? detail.lockupRatio;
          const confirmedPrice =
            toNumber(item.confirmedPriceStr) ?? forecast?.confirmedPrice ?? detail.confirmedPrice;
          const hopePriceBand = detail.band ?? item.band;
          const subscriptionCompetitionRate =
            detail.subscriptionCompetitionRate ?? item.subComp;

          const scraped: ScrapedIpoData = {
            no: item.no,
            rawName: item.rawName,
            name: item.name,
            subscriptionStart: start,
            subscriptionEnd: end,
            refundDate: detail.refundDate,
            paymentDate: detail.paymentDate,
            listingDate: detail.listingDate,
            demandForecastDate: detail.demandForecastDate,
            hopePriceBand,
            confirmedPrice,
            offerAmount: detail.offerAmount,
            institutionCompetitionRate,
            lockupRatio,
            subscriptionCompetitionRate,
            demandForecast: detail.demandForecast,
            totalShares: detail.totalShares,
            minShares: detail.minShares,
            underwriters: detail.underwriters,
            sector: detail.sector,
            ceo: detail.ceo,
            companySize: detail.companySize,
            homepage: detail.homepage,
            phone: detail.phone,
            address: detail.address,
            revenue: detail.revenue,
            profit: detail.profit,
            capital: detail.capital,
            summary: detail.summary,
            products: detail.products,
            financialHistory: detail.financialHistory,
            executiveHoldings: detail.executiveHoldings,
            offeringUse: detail.offeringUse,
            correctionNotice: detail.correctionNotice,
            peerCompanies: detail.peerCompanies,
            tradableShares: detail.tradableShares,
            marketCapEstimate: detail.marketCapEstimate,
          };

          resultMap.set(item.name, scraped);
        }),
      );
    }

    memoryCache = { data: resultMap, expiresAt: Date.now() + CACHE_TTL_MS };
    return resultMap;
  } catch (error) {
    console.error("[ipo-scraper] fetch38IpoData failed:", error);
    return memoryCache ? memoryCache.data : new Map();
  }
}
