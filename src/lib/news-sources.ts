import { serverEnv } from "./server-env";
import { NewsItem } from "./types";

/**
 * 뉴스 소스 다중화.
 *
 * 이전 버전은 "네이버 -> 한국경제 RSS -> 아시아경제 RSS" 순으로 첫 번째 성공한 소스 하나만
 * 썼다(폴백 체인). 이번 버전은 시도 가능한 소스를 전부 병렬로 호출해서 결과를 합치는
 * "집계(aggregation)" 방식으로 바꿨다 — 국내 소스 하나가 막혀도 다른 소스로 계속 커버되고,
 * 여러 소스의 관점이 같이 들어가 원인 분석(1단계 LLM)의 근거가 더 풍부해진다.
 *
 * 국내 소스: 네이버 뉴스 API, 한국경제 증권 RSS, 아시아경제 증권 RSS(제목에 종목명이 들어간
 * 것만 필터링, 최후 보조용).
 * 해외 소스: Google News RSS(API 키 불필요) — 한국어 쿼리로 한 번, 종목의 영문명이
 * GLOBAL_NAME_MAP에 있으면 영어 쿼리로 한 번 더 돌려서 "SK Hynix", "Micron", "Nvidia" 같은
 * 해외 반도체 업계 동향까지 잡는다. 매핑이 없는 종목은 영문 쿼리를 건너뛴다(무리하게 한글
 * 종목명을 영어 로케일로 검색해봐야 관련 없는 결과만 나옴).
 *
 * 소스 하나가 실패해도(Promise.allSettled) 나머지로 계속 진행하고, 전부 실패하면 빈 배열을
 * 돌려준다 — 뉴스가 없어도 브리핑 자체는 계속 진행되게(환율/국제금리와 동일한 방어 패턴).
 *
 * 주의(아시아경제): RSS 안내 페이지에 "비상업적 이용만 허용"이라는 문구가 있다 — 최후 보조로만
 * 쓴다. 주의(Google News RSS): 공개 피드이지만 Google의 이용약관 범위를 벗어나는 대량/상업적
 * 스크래핑은 별도 검토가 필요하다 — 서비스가 커지면 정식 뉴스 API(Alpha Vantage, Finnhub 등)로
 * 교체하거나 Google에 별도 문의하는 게 안전하다.
 */

const NAVER_URL = "https://openapi.naver.com/v1/search/news.json";
const HANKYUNG_FINANCE_RSS = "https://www.hankyung.com/feed/finance"; // 한국경제 증권 섹션
const ASIAE_STOCK_RSS = "https://view.asiae.co.kr/rss/stock.htm"; // 아시아경제 증권 섹션 — 비상업 용도 한정, 최후 보조 전용
const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

// 전체 소스를 합친 뒤 최종적으로 자르는 개수 — 너무 많으면 1단계 LLM 프롬프트가 길어지고
// 비용도 늘어난다. 합치기 전 소스별 개수는 각 fetch 함수 안에서 개별적으로 제한한다.
const MAX_MERGED_NEWS = 18;

// 종목의 해외 보도를 찾기 위한 영문명 매핑. 여기 없는 종목은 영문 Google News 쿼리를
// 건너뛴다(매핑 없이 한글 종목명으로 영어 로케일 검색을 하면 관련 없는 결과만 나옴).
// 커버리지를 넓히려면 이 표에 항목을 추가하면 된다.
const GLOBAL_NAME_MAP: Record<string, string> = {
  "000660": "SK Hynix",
  "005930": "Samsung Electronics",
  "035420": "Naver Corporation",
  "035720": "Kakao Corp",
  "373220": "LG Energy Solution",
  "005380": "Hyundai Motor",
  "000270": "Kia Corporation",
  "051910": "LG Chem",
  "006400": "Samsung SDI",
  "207940": "Samsung Biologics",
};

function clean(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function getNewsFromNaver(query: string): Promise<NewsItem[]> {
  const clientId = serverEnv("NAVER_CLIENT_ID");
  const clientSecret = serverEnv("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 .env에 설정하세요.");
  const response = await fetch(`${NAVER_URL}?query=${encodeURIComponent(query)}&display=10&sort=date`, {
    headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`네이버 뉴스 API 오류 (${response.status})`);
  const items = (await response.json()).items ?? [];
  return items.map((item: { title: string; description: string; link: string; pubDate: string }) => ({
    title: clean(item.title),
    description: clean(item.description),
    link: item.link,
    pubDate: item.pubDate,
    // 네이버 검색 API 응답에는 언론사명이 직접 없다. 링크가 n.news.naver.com으로 가는
    // 경우가 많아 도메인만으로는 원 언론사를 알 수 없고, 정확한 매핑을 하려면 네이버의
    // 언론사 코드 표를 공식 문서로 확인해야 한다(추측으로 채우면 오귀속 위험이 있어 보류) —
    // 그래서 일단 "네이버뉴스"로 표시한다.
    source: "네이버뉴스",
    language: "ko" as const,
  }));
}

type RssItem = { title: string; link: string; pubDate: string; description: string; source?: string };

/**
 * 외부 RSS 파싱 라이브러리 없이 정규식으로 최소 파싱한다 — title/link/pubDate/description
 * (+ Google News의 <source> 태그) 정도만 있으면 되고, 언론사 RSS는 포맷이 비교적 안정적이라
 * 이걸로 충분하다.
 */
function parseRssItems(xml: string): RssItem[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return itemMatches.map((raw) => {
    const pick = (tag: string) => {
      const cdata = raw.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`));
      if (cdata) return cdata[1];
      const plain = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return plain ? plain[1] : "";
    };
    const sourceTag = pick("source").trim();
    return {
      title: clean(pick("title")),
      link: pick("link").trim(),
      pubDate: pick("pubDate").trim(),
      description: clean(pick("description")),
      source: sourceTag || undefined,
    };
  });
}

async function fetchRssFeed(url: string): Promise<RssItem[]> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { ...FETCH_HEADERS, Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!response.ok) throw new Error(`RSS 피드 오류 (${response.status}): ${url}`);
  const xml = await response.text();
  return parseRssItems(xml);
}

/** 증권 섹션 전체 피드에서 종목명이 제목에 들어간 기사만 골라낸다. */
function filterByName(items: RssItem[], name: string, limit: number, source: string, language: "ko" | "en"): NewsItem[] {
  return items
    .filter((item) => item.title.includes(name))
    .slice(0, limit)
    .map((item) => ({ title: item.title, description: item.description, link: item.link, pubDate: item.pubDate, source, language }));
}

async function getNewsFromHankyung(name: string): Promise<NewsItem[]> {
  const items = await fetchRssFeed(HANKYUNG_FINANCE_RSS);
  return filterByName(items, name, 5, "한국경제", "ko");
}

async function getNewsFromAsiae(name: string): Promise<NewsItem[]> {
  const items = await fetchRssFeed(ASIAE_STOCK_RSS);
  return filterByName(items, name, 5, "아시아경제", "ko");
}

/**
 * Google News RSS 검색. API 키가 필요 없고, 결과 각 항목에 <source> 태그로 실제 언론사명이
 * 들어있어 정확한 출처 표시가 된다. hl/gl/ceid로 언어·국가 로케일을 지정한다 — 한국어
 * 로케일로는 국내 언론사 중심, 영어 로케일 + 영문 종목명으로는 해외 언론사 중심 결과가 나온다.
 *
 * 검증 상태: 이 파싱 로직(<source> 태그, "헤드라인 - 언론사명" 제목 형식)은 Google News RSS의
 * 알려진 공개 포맷을 기준으로 작성했다. 이 세션은 조직 네트워크 정책상 news.google.com에 직접
 * 접속해 실제 응답으로 확인하지 못했다(egress 프록시가 차단) — KIS 현재가 연동 때와 동일한
 * 제약. `npm run dev`로 실행한 뒤 아무 종목이나 분석해서 응답의 news 배열에 구글뉴스 항목의
 * title이 " - 언론사명"으로 안 잘리고 깔끔한지, source가 채워지는지 직접 확인해 달라. 포맷이
 * 다르면 이 함수의 <source> 파싱/제목 자르기 로직만 손보면 된다.
 */
async function getNewsFromGoogleNews(query: string, language: "ko" | "en", limit: number): Promise<NewsItem[]> {
  const locale = language === "ko" ? { hl: "ko", gl: "KR", ceid: "KR:ko" } : { hl: "en-US", gl: "US", ceid: "US:en" };
  const url = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(query)}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`;
  const items = await fetchRssFeed(url);
  return items.slice(0, limit).map((item) => {
    // Google News 제목은 보통 "실제 헤드라인 - 언론사명" 형태로 나온다. <source> 태그에서
    // 언론사명을 이미 뽑았으니, 제목 끝에 중복으로 붙은 " - 언론사명"은 잘라낸다.
    const source = item.source || undefined;
    const title = source && item.title.endsWith(` - ${source}`) ? item.title.slice(0, -(source.length + 3)) : item.title;
    return { title, description: item.description, link: item.link, pubDate: item.pubDate, source, language };
  });
}

/** 두 뉴스 항목이 사실상 같은 기사(제목이 거의 동일)인지 — 소스 간 중복 제거용. */
function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

function dedupeAndSort(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort((a, b) => {
    const bTime = new Date(b.pubDate).getTime();
    const aTime = new Date(a.pubDate).getTime();
    // 날짜 파싱 실패(NaN)는 맨 뒤로 보낸다.
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
}

/**
 * 시도 가능한 모든 뉴스 소스를 병렬로 호출해 합친다. ticker가 GLOBAL_NAME_MAP에 있으면
 * 해외(영문) Google News 쿼리도 같이 돌려서 결과에 섞는다.
 */
export async function getNewsMultiSource(name: string, ticker?: string): Promise<NewsItem[]> {
  const englishName = ticker ? GLOBAL_NAME_MAP[ticker] : undefined;

  const tasks: Promise<NewsItem[]>[] = [
    getNewsFromNaver(name),
    getNewsFromGoogleNews(name, "ko", 8),
    getNewsFromHankyung(name),
    getNewsFromAsiae(name),
  ];
  if (englishName) {
    tasks.push(getNewsFromGoogleNews(englishName, "en", 6));
  }

  const results = await Promise.allSettled(tasks);
  const merged: NewsItem[] = [];
  const labels = ["네이버", "구글뉴스(국내)", "한국경제 RSS", "아시아경제 RSS", "구글뉴스(해외)"];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      console.warn(`[news] ${labels[index] ?? "소스"} 실패:`, result.reason);
    }
  });

  return dedupeAndSort(merged).slice(0, MAX_MERGED_NEWS);
}
