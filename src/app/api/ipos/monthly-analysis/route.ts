import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { fetchNewListings } from "@/lib/ipo-listings";
import { analyzeMonthlyIpoTrend } from "@/lib/ipo-monthly-analyzer";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// AI 월별 분석 호출 — /api/analyze와 동일 수준으로 IP당 분당 5회 제한.
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function checkRateLimit(req: Request) {
  const { ok, retryAfterMs } = rateLimit(`ipos-monthly:${clientIp(req)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!ok) {
    return NextResponse.json(
      { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }
  return null;
}

export async function POST(req: Request) {
  const blocked = checkRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const month = (body?.month as string) || "ALL";

    const listingsData = await fetchNewListings();
    const allItems = [...listingsData.upcoming, ...listingsData.history];

    const targetItems =
      month === "ALL"
        ? allItems
        : allItems.filter((x) => x.listingDate.replace(/\//g, "-").startsWith(month));

    const analysis = await analyzeMonthlyIpoTrend(month, targetItems);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[api/ipos/monthly-analysis] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "월별 분석 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const blocked = checkRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || "ALL";

    const listingsData = await fetchNewListings();
    const allItems = [...listingsData.upcoming, ...listingsData.history];

    const targetItems =
      month === "ALL"
        ? allItems
        : allItems.filter((x) => x.listingDate.replace(/\//g, "-").startsWith(month));

    const analysis = await analyzeMonthlyIpoTrend(month, targetItems);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[api/ipos/monthly-analysis GET] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "월별 분석 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
