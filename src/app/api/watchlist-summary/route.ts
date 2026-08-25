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

export async function POST(request: Request) {
  try {
    const { stocks } = (await request.json()) as { stocks: Stock[] };
    if (!Array.isArray(stocks) || stocks.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const clientId = serverEnv("NAVER_CLIENT_ID");
    const clientSecret = serverEnv("NAVER_CLIENT_SECRET");
    const prices = await getPricesForTickers(stocks.map((stock) => stock.ticker));

    const items = await Promise.all(
      stocks.map(async (stock) => {
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
