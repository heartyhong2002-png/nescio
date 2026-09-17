/**
 * 38커뮤니케이션(38.co.kr) 공모주 데이터 크롤러 / 보강 모듈.
 *
 * 금융감독원 OpenDART 구조화 API(estkRs.json)에는 "수요예측 결과(기관 경쟁률, 의무보유확약 비율)",
 * "증권사별 실제 일반청약자 배정 주식수 & 최고 청약한도", "청약 경쟁률"이 들어있지 않아서,
 * 국내 공모주 포털인 38커뮤니케이션에서 해당 부가 정보들을 수집하여 DART 공시 데이터와 합성한다.
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
  hopePriceBand: string | null; // 희망공모가 밴드 (예: "16,500 ~ 19,500원")
  confirmedPrice: number | null; // 확정 공모가 (원)
  institutionCompetitionRate: string | null; // 기관 경쟁률 (예: "1187.74:1")
  lockupRatio: string | null; // 의무보유확약 비율 (예: "21.75%")
  subscriptionCompetitionRate: string | null; // 일반 청약 경쟁률 (예: "1375.34:1")
  totalShares: number | null; // 총 공모주식수
  underwriters: ScrapedUnderwriter[]; // 증권사별 배정 & 한도
};

type CacheEntry = {
  data: Map<string, ScrapedIpoData>;
  expiresAt: number;
};

let memoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분 캐시

async function fetchEucKr(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("euc-kr").decode(buf);
}

function cleanText(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 종목명 정규화:
 * "덕산넵코어스(구.넵코어스)" -> "덕산넵코어스"
 * "(주)브릴스" -> "브릴스"
 * "디티에스(구.동양티에스)" -> "디티에스"
 */
export function normalizeCorpName(name: string): string {
  return name
    .replace(/\(주\)/g, "")
    .replace(/\(구\..*?\)/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function toNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseDates(dateStr: string): { start: string | null; end: string | null } {
  // "2026.09.17~09.18" or "2026.11.02~11.03"
  const m = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(?:(\d{4})\.)?(\d{2})\.(\d{2})/);
  if (!m) return { start: null, end: null };
  const y = m[1];
  const start = `${y}-${m[2]}-${m[3]}`;
  const endY = m[4] || y;
  const end = `${endY}-${m[5]}-${m[6]}`;
  return { start, end };
}

/** 38 공모주 상세 페이지(o=v&no=...)에서 상세 배정 및 수요예측 결과 파싱 */
async function scrape38Detail(no: string): Promise<{
  institutionCompetitionRate: string | null;
  lockupRatio: string | null;
  subscriptionCompetitionRate: string | null;
  band: string | null;
  confirmedPrice: number | null;
  totalShares: number | null;
  underwriters: ScrapedUnderwriter[];
}> {
  try {
    const html = await fetchEucKr(`http://www.38.co.kr/html/fund/?o=v&no=${no}`);
    const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

    let institutionCompetitionRate: string | null = null;
    let lockupRatio: string | null = null;
    let subscriptionCompetitionRate: string | null = null;
    let band: string | null = null;
    let confirmedPrice: number | null = null;
    let totalShares: number | null = null;
    const underwriters: ScrapedUnderwriter[] = [];

    let inUnderwriterTable = false;

    for (const tr of trMatches) {
      const tds = [...tr[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((m) => cleanText(m[1]));
      const rowStr = tds.join(" | ");

      // 1. 수요예측결과 (기관경쟁률 / 의무보유확약)
      if (rowStr.includes("수요예측결과") && tds.length >= 4) {
        for (let i = 0; i < tds.length; i++) {
          if (tds[i] === "기관경쟁률" && tds[i + 1] && tds[i + 1] !== "-") {
            institutionCompetitionRate = tds[i + 1];
          }
          if (tds[i] === "의무보유확약" && tds[i + 1] && tds[i + 1] !== "-") {
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
        confirmedPrice = toNumber(tds[1]);
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
        if (tds.length >= 3 && (tds[0].includes("증권") || tds[0].includes("투자"))) {
          underwriters.push({
            name: tds[0],
            shares: toNumber(tds[1]),
            sharesText: tds[1] || null,
            limit: tds[2] && tds[2] !== "-" ? tds[2] : null,
            role: tds[3] || null,
          });
        } else {
          inUnderwriterTable = false;
        }
      }

      // 6. 단일 주관사 행 ("주간사" row)
      if (tds[0] === "주간사" && underwriters.length === 0) {
        const leadName = tds[1];
        const mShares = tds[2]?.match(/주식수:\s*([\d,]+)\s*주/);
        const mLimit = tds[2]?.match(/청약한도:\s*([^\/]+주)/);
        if (leadName) {
          underwriters.push({
            name: leadName,
            shares: mShares ? toNumber(mShares[1]) : null,
            sharesText: mShares ? `${mShares[1]} 주` : null,
            limit: mLimit ? mLimit[1].trim() : null,
            role: "대표주관",
          });
        }
      }
    }

    return {
      institutionCompetitionRate,
      lockupRatio,
      subscriptionCompetitionRate,
      band,
      confirmedPrice,
      totalShares,
      underwriters,
    };
  } catch (err) {
    console.warn(`[ipo-scraper] detail for no=${no} failed:`, err instanceof Error ? err.message : err);
    return {
      institutionCompetitionRate: null,
      lockupRatio: null,
      subscriptionCompetitionRate: null,
      band: null,
      confirmedPrice: null,
      totalShares: null,
      underwriters: [],
    };
  }
}

/** 38커뮤니케이션에서 최근 공모주 청약 목록과 수요예측 결과를 가져와 Map으로 반환 */
export async function fetch38IpoData(): Promise<Map<string, ScrapedIpoData>> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    return memoryCache.data;
  }

  try {
    // 1. 공모청약 일정 목록(o=k)
    const htmlK = await fetchEucKr("http://www.38.co.kr/html/fund/index.htm?o=k");
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
    const htmlR1 = await fetchEucKr("http://www.38.co.kr/html/fund/index.htm?o=r1");
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
          lockupRatio: tds[6] !== "-" && tds[6] ? tds[6] : null,
          confirmedPrice: toNumber(tds[3]),
        });
      }
    }

    // 3. 최근 20개 종목에 대해 상세 페이지 병렬 조회 (한 번에 5개씩 배치 처리)
    const resultMap = new Map<string, ScrapedIpoData>();
    const targets = rawItems.slice(0, 20);

    const batchSize = 5;
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
            hopePriceBand,
            confirmedPrice,
            institutionCompetitionRate,
            lockupRatio,
            subscriptionCompetitionRate,
            totalShares: detail.totalShares,
            underwriters: detail.underwriters,
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
