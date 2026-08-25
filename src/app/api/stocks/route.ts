import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { listMarketStocks } from "@/lib/krx";

export async function GET() {
  const key = serverEnv("KRX_AUTH_KEY");
  if (!key) return NextResponse.json({ error: "KRX_AUTH_KEY를 .env.local에 설정하세요." }, { status: 500 });

  try {
    const results = await Promise.allSettled([
      listMarketStocks("KOSPI", key),
      listMarketStocks("KOSDAQ", key),
    ]);
    const kospi = results[0].status === "fulfilled" ? results[0].value : [];
    const kosdaq = results[1].status === "fulfilled" ? results[1].value : [];
    const stocks = [...kospi, ...kosdaq].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const unavailableMarkets = [
      results[0].status === "rejected" ? "KOSPI" : null,
      results[1].status === "rejected" ? "KOSDAQ" : null,
    ].filter((market): market is string => market !== null);
    return NextResponse.json({ stocks, count: stocks.length, unavailableMarkets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "종목 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
