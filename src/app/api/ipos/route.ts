import { NextResponse } from "next/server";
import { fetchUpcomingIpos } from "@/lib/dart";
import { IpoInfo } from "@/lib/types";

// market-indices/route.ts와 동일한 패턴 — 공모주 청약일정은 분 단위로 바뀌는 게 아니라서
// 서버리스 인스턴스 안에서 30분 정도 캐시해도 충분하고, DART 호출 횟수(공시목록 1회 +
// 후보 종목마다 상세 1회)를 아낄 수 있다.
type Cache = { data: IpoInfo[]; expiresAt: number };
let cache: Cache | null = null;
let inFlight: Promise<IpoInfo[]> | null = null;
// 청약·수요예측 결과는 장중에도 빠르게 정정될 수 있다. 수집기와 같은 3분 창을 쓰되,
// 만료 직후의 동시 요청은 하나의 수집 작업에 합류시켜 DART/38커뮤니케이션을 중복 호출하지 않는다.
const CACHE_TTL_MS = 3 * 60_000;

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function loadIpos(): Promise<IpoInfo[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  if (inFlight) return inFlight;

  inFlight = fetchUpcomingIpos()
    .then((ipos) => {
      cache = { data: ipos, expiresAt: Date.now() + CACHE_TTL_MS };
      return ipos;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export async function GET() {
  try {
    const ipos = await loadIpos();
    // 브라우저·CDN이 서버의 3분 캐시보다 오래된 응답을 다시 쓰지 않도록 한다.
    return NextResponse.json({ ipos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ipos] 공모주 목록 조회 실패:", error);
    const message = error instanceof Error ? error.message : "공모주 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message, ipos: [] }, { status: 200 });
  }
}
