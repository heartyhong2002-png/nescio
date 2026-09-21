import { AnalystReport } from "./consensus-types";

// 인메모리 캐시 (TTL 30분)
const SCRAPER_CACHE = new Map<string, { reports: AnalystReport[]; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cleanString(str: string | undefined | null): string {
  if (!str) return "";
  // HTML 태그 제거 및 불필요한 공백 치환
  return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 네이버 증권 리서치 V2 JSON API를 호출하여 종목의 최신 애널리스트 리포트를 가져온다.
 */
export async function scrapeAnalystReports(ticker: string, count: number = 5): Promise<AnalystReport[]> {
  const now = Date.now();
  const cached = SCRAPER_CACHE.get(ticker);
  if (cached && now < cached.expiresAt) {
    return cached.reports;
  }

  try {
    const url = `https://stock.naver.com/api/stockSecurity/researches/v2/company?itemCodes=${ticker}&size=${count}`;
    const res = await fetch(url, {
      headers: {
        // 실제 브라우저처럼 보이게 헤더 설정
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://stock.naver.com/research/company",
        "Accept": "application/json",
      },
      // Vercel 환경 등에 따라 적절한 revalidate 주기를 줄 수도 있지만,
      // API 자체 차단이나 지연을 방지하기 위해 코드 단 인메모리 캐시(Map)도 유지
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      console.warn(`Failed to fetch consensus reports for ${ticker}. Status: ${res.status}`);
      return [];
    }

    const data = await res.json();
    // V2 API는 여러 itemCodes를 지원하므로 객체 형태 { "005930": [...] } 또는 배열 형태로 내려옴
    // 구조체 체크
    let rawList: any[] = [];
    if (data.items) rawList = data.items;
    else if (data.researches) rawList = data.researches;
    else if (data[ticker]) rawList = data[ticker];

    if (!Array.isArray(rawList)) {
      return [];
    }

    const reports: AnalystReport[] = rawList.map((item: any) => {
      return {
        nid: item.nid || "",
        title: item.title || "",
        content: cleanString(item.content),
        brokerName: item.brokerName || item.broker || "알수없음",
        targetPrice: item.goalPrice ? Number(item.goalPrice) : null,
        prevTargetPrice: item.prevGoalPrice ? Number(item.prevGoalPrice) : null,
        opinion: item.opinionText || item.opinion || "N/A",
        writeDate: item.writeDate || item.date || "",
        attachUrl: item.attachUrl || item.fileUrl || item.pdfUrl || null,
      };
    }).filter(r => r.title && r.writeDate);

    // 캐시 저장
    SCRAPER_CACHE.set(ticker, { reports, expiresAt: now + CACHE_TTL_MS });
    return reports;
  } catch (error) {
    console.error(`Error scraping analyst reports for ${ticker}:`, error);
    return [];
  }
}
