import { NextResponse } from "next/server";
import { fetchLatestExchangeRates } from "@/lib/exim";

export async function GET() {
  try {
    const { date, rates } = await fetchLatestExchangeRates();
    const sorted = [...rates].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return NextResponse.json({ date, rates: sorted, count: sorted.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "환율 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
