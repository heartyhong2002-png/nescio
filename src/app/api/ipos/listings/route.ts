import { NextResponse } from "next/server";
import { fetchNewListings } from "@/lib/ipo-listings";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchNewListings();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/ipos/listings] Failed to fetch listing data:", error);
    return NextResponse.json(
      {
        upcoming: [],
        history: [],
        stats: {
          totalCount: 0,
          avgOpenReturn: "+0.0%",
          avgFirstDayReturn: "+0.0%",
          tripleCount: 0,
          doubleCount: 0,
          lossCount: 0,
        },
        error: error instanceof Error ? error.message : "신규상장 정보를 불러오지 못했습니다.",
      },
      { status: 200 },
    );
  }
}
