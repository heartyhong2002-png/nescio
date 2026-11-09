import { NextResponse } from "next/server";
import { fetchUpcomingIpos } from "@/lib/dart";
import { IpoInfo } from "@/lib/types";

type Cache = { data: IpoInfo[]; expiresAt: number };
let cache: Cache | null = null;
let lastGoodData: IpoInfo[] = [];
let inFlight: Promise<IpoInfo[]> | null = null;

// 정상 TTL 5분, 만료되어도 이전 데이터를 즉시 서빙(SWR)하여 체감 지연 0초 달성
const CACHE_TTL_MS = 5 * 60_000;

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function refreshIpos(): Promise<IpoInfo[]> {
  if (inFlight) return inFlight;

  inFlight = fetchUpcomingIpos()
    .then((ipos) => {
      if (ipos && ipos.length > 0) {
        cache = { data: ipos, expiresAt: Date.now() + CACHE_TTL_MS };
        lastGoodData = ipos;
      }
      return ipos;
    })
    .catch((err) => {
      console.warn("[api/ipos] 백그라운드 갱신 실패 (기존 데이터 유지):", err);
      // 실패 시에도 기존 정상 데이터가 있으면 반환
      return lastGoodData;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

async function loadIpos(): Promise<IpoInfo[]> {
  // 1. 유효한 캐시가 있으면 즉시 반환
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  // 2. 만료된 캐시라도 이전 성공 데이터가 있으면 즉시 반환하고 백그라운드에서 갱신 (SWR 패턴)
  if (lastGoodData.length > 0) {
    void refreshIpos(); // 백그라운드 비동기 갱신
    return lastGoodData;
  }

  // 3. 콜드 스타트 최초 요청 시 직접 대기하여 반환
  return refreshIpos();
}

export async function GET() {
  try {
    const ipos = await loadIpos();
    const finalIpos = ipos && ipos.length > 0 ? ipos : lastGoodData;
    return NextResponse.json({ ipos: finalIpos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ipos] 공모주 목록 조회 실패:", error);
    // 에러 발생 시에도 이전 정상 데이터가 있으면 무중단 반환
    if (lastGoodData.length > 0) {
      return NextResponse.json({ ipos: lastGoodData }, { headers: { "Cache-Control": "no-store" } });
    }
    const message = error instanceof Error ? error.message : "공모주 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message, ipos: [] }, { status: 200 });
  }
}
