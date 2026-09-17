import { NextResponse } from "next/server";
import { fetchNewListings } from "@/lib/ipo-listings";
import { analyzeMonthlyIpoTrend } from "@/lib/ipo-monthly-analyzer";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
