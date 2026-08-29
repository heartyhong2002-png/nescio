import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { listMarketStocks } from "@/lib/krx";
import { Market } from "@/lib/types";

const MARKETS: Market[] = ["KOSPI", "KOSDAQ", "ETF"];

export async function GET() {
  const key = serverEnv("KRX_AUTH_KEY");
  if (!key) return NextResponse.json({ error: "KRX_AUTH_KEY를 .env.local에 설정하세요." }, { status: 500 });

  try {
    const results = await Promise.allSettled(MARKETS.map((market) => listMarketStocks(market, key)));
    const stocks = results
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const unavailableMarkets = results
      .map((result, index) => (result.status === "rejected" ? MARKETS[index] : null))
      .filter((market): market is Market => market !== null);
    return NextResponse.json({ stocks, count: stocks.length, unavailableMarkets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "종목 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
