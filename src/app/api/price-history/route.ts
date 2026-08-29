import { NextResponse } from "next/server";
import { fetchPriceHistory } from "@/lib/krx";
import { fetchKisPriceHistory, isRetryableKisMessage } from "@/lib/kis";

// Calendar-day lookback per range for the KRX fallback, generous enough to cover market holidays.
const RANGE_CALENDAR_DAYS: Record<string, number> = {
  "1주": 10,
  "1개월": 35,
  "1년": 380,
};

const VALID_RANGES = new Set(["1일", "1주", "1개월", "1년"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const range = searchParams.get("range") ?? "";

  if (!ticker || !VALID_RANGES.has(range)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 1차: KIS (분봉 + 기간별 시세를 한 번의 호출로). 실패 시 KRX 일별 스냅샷으로 폴백(분봉 제외).
  try {
    const points = await fetchKisPriceHistory(ticker, range);
    if (points.length > 0 || range === "1일") return NextResponse.json({ points });
  } catch (error) {
    if (range === "1일") {
      // 분봉은 KRX 폴백이 없다. 레이트리밋 같은 일시적 오류면 클라이언트가 잠시 뒤 다시 부르도록
      // 200 + retryable 플래그로 알려준다(하드 500은 그대로 에러 화면에 박제된다).
      const message = error instanceof Error ? error.message : "분봉을 불러오지 못했습니다.";
      const retryable = isRetryableKisMessage(message);
      return NextResponse.json({ points: [], retryable, error: message }, { status: retryable ? 200 : 500 });
    }
    // 일/주/월봉은 아래 KRX 폴백을 시도한다.
  }

  try {
    const points = await fetchPriceHistory(ticker, RANGE_CALENDAR_DAYS[range]);
    return NextResponse.json({ points });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격 이력을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
