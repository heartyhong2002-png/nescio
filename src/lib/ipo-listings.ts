import { IpoListingItem, IpoListingsData, IpoMarketStats, Stock } from "./types";

/**
 * 38커뮤니케이션 신규상장(o=nw) 페이지 크롤러.
 * 2026년에 신규 상장된 공모주들의 상장 첫날 시초가, 첫날 종가, 공모가 대비 수익률 및
 * 현재 상장 예정인 공모주 목록과 시장 종합 통계를 수집·산출한다.
 */

type CacheEntry = {
  data: IpoListingsData;
  expiresAt: number;
};

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분 캐시

async function fetchEucKr(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("euc-kr").decode(buf);
}

function cleanText(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function toNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export async function fetchNewListings(): Promise<IpoListingsData> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  try {
    const rawItems: IpoListingItem[] = [];

    // 최근 1~3페이지(2026년 전수) 병렬 조회
    const pages = [1, 2, 3];
    const htmls = await Promise.all(
      pages.map(async (p) => {
        try {
          return await fetchEucKr(`http://www.38.co.kr/html/fund/index.htm?o=nw&page=${p}`);
        } catch (err) {
          console.warn(`[ipo-listings] page ${p} fetch failed:`, err);
          return "";
        }
      }),
    );

    for (const html of htmls) {
      if (!html) continue;
      const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const tr of trs) {
        const tds = [...tr[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((m) =>
          cleanText(m[1]),
        );
        // 컬럼: [기업명, 신규상장일, 현재가, 전일비, 공모가, 공모가대비등락률, 시초가, 시초/공모, 첫날종가]
        if (tds.length >= 9 && tds[1] && (tds[1].startsWith("2026/") || tds[1].startsWith("2025/"))) {
          const name = tds[0];
          const listingDate = tds[1];
          const currentPrice = toNumber(tds[2]);
          const changeRate = tds[3] !== "%" && tds[3] ? tds[3] : null;
          const offerPrice = toNumber(tds[4]);
          const openPrice = toNumber(tds[6]);
          const firstDayClose = toNumber(tds[8]);
          const isUpcoming = tds[8] === "예정" || tds[6] === "-" || !firstDayClose;

          // 차트 링크에서 6자리 단축 종목코드(티커) 추출 (예: code=0161M0, code=386380)
          const codeMatch = tr[1].match(/code=([0-9A-Za-z]{6})/i);
          const ticker = codeMatch ? codeMatch[1].toUpperCase() : undefined;

          // 시초가 대비 공모가 수익률
          let openReturnRate: string | null = null;
          if (tds[7] && tds[7] !== "%") {
            const cleanRate = tds[7].replace("%", "").trim();
            const num = Number(cleanRate);
            if (!Number.isNaN(num)) {
              openReturnRate = num > 0 ? `+${num}%` : `${num}%`;
            }
          } else if (offerPrice && openPrice) {
            const rate = ((openPrice - offerPrice) / offerPrice) * 100;
            openReturnRate = rate > 0 ? `+${rate.toFixed(1)}%` : `${rate.toFixed(1)}%`;
          }

          // 첫날 종가 대비 공모가 수익률
          let firstDayReturnRate: string | null = null;
          let badge: IpoListingItem["badge"] = isUpcoming ? "UPCOMING" : undefined;

          if (!isUpcoming && offerPrice && firstDayClose) {
            const ret = ((firstDayClose - offerPrice) / offerPrice) * 100;
            firstDayReturnRate = ret > 0 ? `+${ret.toFixed(1)}%` : `${ret.toFixed(1)}%`;

            if (ret >= 295) {
              badge = "TRIPLE"; // 따따블 (+300%)
            } else if (ret >= 95) {
              badge = "DOUBLE"; // 따블 (+100% 이상)
            } else if (ret >= 0) {
              badge = "PROFIT";
            } else {
              badge = "LOSS"; // 공모가 하회 손실
            }
          }

          rawItems.push({
            name,
            listingDate,
            currentPrice,
            changeRate,
            offerPrice,
            openPrice,
            openReturnRate,
            firstDayClose,
            firstDayReturnRate,
            isUpcoming,
            badge,
            ticker,
          });
        }
      }
    }

    const upcoming = rawItems.filter((item) => item.isUpcoming);
    const history = rawItems.filter((item) => !item.isUpcoming);

    // 통계 계산
    let openSum = 0;
    let openCount = 0;
    let closeSum = 0;
    let closeCount = 0;
    let tripleCount = 0;
    let doubleCount = 0;
    let lossCount = 0;

    for (const h of history) {
      if (h.openReturnRate) {
        const num = parseFloat(h.openReturnRate.replace(/[+%]/g, ""));
        if (!Number.isNaN(num)) {
          openSum += num;
          openCount++;
        }
      }
      if (h.firstDayReturnRate) {
        const num = parseFloat(h.firstDayReturnRate.replace(/[+%]/g, ""));
        if (!Number.isNaN(num)) {
          closeSum += num;
          closeCount++;
          if (num >= 295) tripleCount++;
          else if (num >= 95) doubleCount++;
          else if (num < 0) lossCount++;
        }
      }
    }

    const stats: IpoMarketStats = {
      totalCount: history.length,
      avgOpenReturn: openCount > 0 ? `+${(openSum / openCount).toFixed(1)}%` : "+0.0%",
      avgFirstDayReturn: closeCount > 0 ? `+${(closeSum / closeCount).toFixed(1)}%` : "+0.0%",
      tripleCount,
      doubleCount: doubleCount + tripleCount, // 100% 이상 전체 (따블+따따블)
      lossCount,
    };

    const result: IpoListingsData = {
      upcoming,
      history,
      stats,
    };

    cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch (error) {
    console.error("[ipo-listings] fetchNewListings failed:", error);
    return (
      cache?.data ?? {
        upcoming: [],
        history: [],
        stats: {
          totalCount: 0,
          avgOpenReturn: "+0.0%",
          avgFirstDayReturn: "+0.0%",
          tripleCount: 0,
          doubleCount: 0,
          lossCount: 0,
        },
      }
    );
  }
}

/**
 * 오늘 및 최근 신규 상장된 공모주들 중 유효한 단축코드(6자리)가 있는 종목들을
 * Stock 객체 목록으로 변환하여 반환한다.
 * KRX 일별 거래 실적(전 영업일 기준)에 미처 반영되지 않은 당일 신규상장주를 즉시 보완한다.
 */
export async function getNewListingStocks(): Promise<Stock[]> {
  try {
    const data = await fetchNewListings();
    const all = [...data.upcoming, ...data.history];
    const stocks: Stock[] = [];
    const seen = new Set<string>();

    for (const item of all) {
      if (item.ticker && !seen.has(item.ticker)) {
        seen.add(item.ticker);
        // 정규화된 종목명 (접두사/접미사 정리)
        const cleanName = item.name.replace(/\(구\.[^)]+\)/, "").trim();
        stocks.push({
          ticker: item.ticker,
          name: cleanName,
          market: cleanName.includes("스팩") ? "KOSDAQ" : "KOSDAQ",
        });
      }
    }
    return stocks;
  } catch (error) {
    console.warn("[ipo-listings] getNewListingStocks failed:", error);
    return [];
  }
}
