import { NextResponse } from "next/server";
import { fetchPriceHistory } from "@/lib/krx";

// Calendar-day lookback per range, generous enough to cover market holidays.
const RANGE_CALENDAR_DAYS: Record<string, number> = {
  "1주": 10,
  "1개월": 35,
  "1년": 380,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const range = searchParams.get("range") ?? "";
  const calendarDays = RANGE_CALENDAR_DAYS[range];

  if (!ticker || !calendarDays) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  try {
    const points = await fetchPriceHistory(ticker, calendarDays);
    return NextResponse.json({ points });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격 이력을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
