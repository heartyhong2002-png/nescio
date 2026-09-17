import { NextResponse } from "next/server";
import { analyzeIpoWithAi } from "@/lib/ipo-analyzer";
import { IpoInfo } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ipo = body?.ipo as IpoInfo;
    if (!ipo || !ipo.corpName) {
      return NextResponse.json({ error: "IPO 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const analysis = await analyzeIpoWithAi(ipo);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[api/ipos/analyze] Failed to analyze IPO:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "분석 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
