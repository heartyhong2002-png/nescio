import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { getPricesForTickers } from "@/lib/krx";
import { Stock } from "@/lib/types";

const NAVER_URL = "https://openapi.naver.com/v1/search/news.json";

// Naver's `total` field is the all-time match count across its whole index (often
// in the millions), not "today's articles" — so we fetch recent items and count how
// many were actually published in the last 24h instead of trusting `total`.
async function getNewsCount(query: string, clientId: string, clientSecret: string) {
  const response = await fetch(`${NAVER_URL}?query=${encodeURIComponent(query)}&display=20&sort=date`, {
    headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const items = ((await response.json()).items ?? []) as { pubDate: string }[];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.pubDate).getTime() >= dayAgo).length;
}

// 관심종목 하나당 네이버 뉴스 API 호출이 1건씩 나간다. 요청 본문은 클라이언트(localStorage)가
// 그대로 보내는 값이라, 조작된 요청이 수백 개짜리 배열을 보내 네이버 API 쿼터를 태우는 걸
// 막기 위해 개수를 상식적인 선으로 자른다 — 실제 UI에서 이만큼 담을 일은 없다.
const MAX_WATCHLIST_ITEMS = 50;

export async function POST(request: Request) {
  try {
    const { stocks } = (await request.json()) as { stocks: Stock[] };
    if (!Array.isArray(stocks) || stocks.length === 0) {
      return NextResponse.json({ items: [] });
    }
    const capped = stocks
      .filter((stock) => stock && typeof stock.ticker === "string" && typeof stock.name === "string")
      .slice(0, MAX_WATCHLIST_ITEMS);

    const clientId = serverEnv("NAVER_CLIENT_ID");
    const clientSecret = serverEnv("NAVER_CLIENT_SECRET");
    const prices = await getPricesForTickers(capped.map((stock) => stock.ticker));

    const items = await Promise.all(
      capped.map(async (stock) => {
        const price = prices.get(stock.ticker) ?? { close: null, changeRate: null, marketCap: null };
        const newsCount =
          clientId && clientSecret ? await getNewsCount(stock.name, clientId, clientSecret) : null;
        return { ...stock, ...price, newsCount };
      }),
    );

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "관심종목 요약을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
