import { NextResponse } from "next/server";
import { getPriceForTicker } from "@/lib/krx";

// 종목 상세 페이지의 헤더/차트/재무지표를 AI 브리핑(느린 2단계 LLM 파이프라인)보다
// 먼저 그릴 수 있도록, 시세만 빠르게 돌려주는 전용 엔드포인트.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const name = searchParams.get("name") ?? "";
  if (!ticker) return NextResponse.json({ error: "종목 코드가 필요합니다." }, { status: 400 });

  try {
    const price = await getPriceForTicker(ticker);
    return NextResponse.json({ stock: { name, ticker }, price });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
