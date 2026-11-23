import { NextResponse } from "next/server";
import { fetchStockMultiSignals } from "@/lib/stock-signals";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await context.params;
    if (!ticker || !/^[A-Za-z0-9]{6}$/.test(ticker)) {
      return NextResponse.json({ error: "유효하지 않은 종목코드입니다." }, { status: 400 });
    }

    const signals = await fetchStockMultiSignals(ticker);
    return NextResponse.json({ signals }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/stock/signals] 조회 실패:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "종목 시그널을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
