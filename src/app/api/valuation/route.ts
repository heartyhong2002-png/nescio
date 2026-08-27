import { NextResponse } from "next/server";
import { fetchValuation } from "@/lib/kis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  if (!ticker) return NextResponse.json({ error: "종목 코드가 필요합니다." }, { status: 400 });

  try {
    const valuation = await fetchValuation(ticker);
    return NextResponse.json({ valuation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "재무 지표를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
