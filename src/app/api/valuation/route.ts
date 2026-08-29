import { NextResponse } from "next/server";
import { fetchValuation, isRetryableKisMessage } from "@/lib/kis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  if (!ticker) return NextResponse.json({ error: "종목 코드가 필요합니다." }, { status: 400 });

  try {
    const valuation = await fetchValuation(ticker);
    return NextResponse.json({ valuation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "재무 지표를 불러오지 못했습니다.";
    // 레이트리밋 등 일시적 오류면 200 + retryable로 알려서 클라이언트가 잠시 뒤 다시 부르게 한다
    // (price-history와 동일한 패턴). 서버리스 라우트별로 KIS 토큰 캐시가 공유되지 않아 페이지 첫
    // 로드 때 다른 KIS 라우트와 토큰 발급이 겹치는 경우가 흔해서, 이게 없으면 지표가 그냥 조용히 비어버린다.
    const retryable = isRetryableKisMessage(message);
    return NextResponse.json({ valuation: null, retryable, error: message }, { status: retryable ? 200 : 500 });
  }
}
