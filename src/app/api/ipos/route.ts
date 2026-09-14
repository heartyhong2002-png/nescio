import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { fetchUpcomingIpos } from "@/lib/dart";
import { IpoInfo } from "@/lib/types";

// market-indices/route.ts와 동일한 패턴 — 공모주 청약일정은 분 단위로 바뀌는 게 아니라서
// 서버리스 인스턴스 안에서 30분 정도 캐시해도 충분하고, DART 호출 횟수(공시목록 1회 +
// 후보 종목마다 상세 1회)를 아낄 수 있다.
type Cache = { data: IpoInfo[]; expiresAt: number };
let cache: Cache | null = null;
const CACHE_TTL_MS = 30 * 60_000;

export async function GET() {
  const key = serverEnv("DART_API_KEY");
  if (!key) return NextResponse.json({ error: "DART_API_KEY를 설정하세요." }, { status: 500 });

  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ ipos: cache.data });
  }

  try {
    const ipos = await fetchUpcomingIpos();
    cache = { data: ipos, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json({ ipos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "공모주 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
