import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { listMarketStocks } from "@/lib/krx";
import { getNewListingStocks } from "@/lib/ipo-listings";
import { Market, Stock } from "@/lib/types";

const MARKETS: Market[] = ["KOSPI", "KOSDAQ", "KONEX", "ETF", "ETN", "WARRANT"];

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET() {
  const key = serverEnv("KRX_AUTH_KEY");
  if (!key) return NextResponse.json({ error: "KRX_AUTH_KEY를 .env.local에 설정하세요." }, { status: 500 });

  try {
    const [krxResults, newListingStocks] = await Promise.all([
      Promise.allSettled(MARKETS.map((market) => listMarketStocks(market, key))),
      getNewListingStocks(),
    ]);

    const stockMap = new Map<string, Stock>();

    // 1. KRX 전 영업일 거래 종목들 추가
    for (const result of krxResults) {
      if (result.status === "fulfilled") {
        for (const stock of result.value) {
          stockMap.set(stock.ticker, stock);
        }
      }
    }

    // 2. 당일/최근 신규상장 공모주 추가 (KRX에 아직 안 잡혔더라도 즉시 반영!)
    for (const newStock of newListingStocks) {
      if (!stockMap.has(newStock.ticker)) {
        stockMap.set(newStock.ticker, newStock);
      }
    }

    const stocks = Array.from(stockMap.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));

    const unavailableMarkets = krxResults
      .map((result, index) => (result.status === "rejected" ? MARKETS[index] : null))
      .filter((market): market is Market => market !== null);

    return NextResponse.json({
      stocks,
      count: stocks.length,
      newListings: newListingStocks,
      unavailableMarkets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "종목 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
