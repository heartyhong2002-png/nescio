import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { analyzeIpoWithAi } from "@/lib/ipo-analyzer";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { IpoInfo } from "@/lib/types";

// AI 분석 호출이라 /api/analyze와 동일 수준으로 IP당 분당 5회 제한.
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { ok, retryAfterMs } = rateLimit(`ipos-analyze:${clientIp(req)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
    if (!ok) {
      return NextResponse.json(
        { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    const auth = await requireAuth();
    if (auth.response) return auth.response;

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
