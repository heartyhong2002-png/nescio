import { serverEnv } from "./server-env";
import { NewsItem } from "./types";

/**
 * 뉴스 소스 다중화 — 네이버 뉴스 API 하나에만 의존하면 그 API가 막히는 순간(인증키 만료,
 * 일일 한도 초과, 네이버 쪽 장애 등) 브리핑 전체가 뉴스 없이 나가게 된다. 그래서
 * 네이버 -> 한국경제 증권 RSS -> 아시아경제 증권 RSS 순서로 폴백 체인을 둔다.
 *
 * RSS 두 곳은 종목별 전용 피드가 아니라 "증권" 섹션 전체 피드라, 기사 제목에 종목명이
 * 들어간 것만 걸러서 쓴다(그래서 티커가 아니라 한글 종목명으로 필터링).
 *
 * 주의(아시아경제): RSS 안내 페이지에 "비상업적 이용만 허용"이라는 문구가 있다 — 그래서
 * 이 소스는 최후 폴백으로만 쓴다. 서비스가 커지면 이 소스는 빼거나 아시아경제 쪽에 정식으로
 * 이용 문의를 하는 게 안전하다.
 */

const NAVER_URL = "https://openapi.naver.com/v1/search/news.json";
const HANKYUNG_FINANCE_RSS = "https://www.hankyung.com/feed/finance"; // 한국경제 증권 섹션
const ASIAE_STOCK_RSS = "https://view.asiae.co.kr/rss/stock.htm"; // 아시아경제 증권 섹션 — 비상업 용도 한정, 최후 폴백 전용

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

function clean(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
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
  }));
}

type RssItem = { title: string; link: string; pubDate: string; description: string };

/**
 * 외부 RSS 파싱 라이브러리 없이 정규식으로 최소 파싱한다 — title/link/pubDate/description
 * 4개 필드만 있으면 되고, 언론사 RSS는 포맷이 비교적 안정적이라 이걸로 충분하다.
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
    return {
      title: clean(pick("title")),
      link: pick("link").trim(),
      pubDate: pick("pubDate").trim(),
      description: clean(pick("description")),
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
function filterByName(items: RssItem[], name: string, limit: number): NewsItem[] {
  return items
    .filter((item) => item.title.includes(name))
    .slice(0, limit)
    .map((item) => ({ title: item.title, description: item.description, link: item.link, pubDate: item.pubDate }));
}

async function getNewsFromHankyung(name: string): Promise<NewsItem[]> {
  const items = await fetchRssFeed(HANKYUNG_FINANCE_RSS);
  return filterByName(items, name, 5);
}

async function getNewsFromAsiae(name: string): Promise<NewsItem[]> {
  const items = await fetchRssFeed(ASIAE_STOCK_RSS);
  return filterByName(items, name, 5);
}

/**
 * 네이버 -> 한국경제 증권 RSS -> 아시아경제 증권 RSS 순으로 시도해서 첫 번째로 결과가
 * 나오는 소스를 쓴다. 세 소스 모두 실패해도 예외를 던지지 않고 빈 배열을 돌려준다 —
 * 뉴스가 없어도 브리핑 자체는 계속 진행되게(환율/국제금리와 동일한 방어 패턴).
 */
export async function getNewsMultiSource(name: string): Promise<NewsItem[]> {
  try {
    const naver = await getNewsFromNaver(name);
    if (naver.length > 0) return naver;
  } catch (error) {
    console.warn("[news] 네이버 뉴스 실패, 한국경제 RSS로 전환:", error);
  }

  try {
    const hankyung = await getNewsFromHankyung(name);
    if (hankyung.length > 0) return hankyung;
  } catch (error) {
    console.warn("[news] 한국경제 RSS 실패, 아시아경제 RSS로 전환:", error);
  }

  try {
    return await getNewsFromAsiae(name);
  } catch (error) {
    console.warn("[news] 아시아경제 RSS도 실패, 뉴스 없이 진행:", error);
    return [];
  }
}
