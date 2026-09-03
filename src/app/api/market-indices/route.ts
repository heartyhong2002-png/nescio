import { NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/krx";

// 지수는 실시간 급변을 다루는 화면이 아니라서 서버리스 인스턴스 안에서 30분 정도는
// 캐시해도 충분하다 — 관심종목 요약(watchlist-summary)만큼 자주 부를 필요가 없다.
type Cache = { data: Awaited<ReturnType<typeof getMarketIndices>>; expiresAt: number };
let cache: Cache | null = null;
const CACHE_TTL_MS = 30 * 60_000;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ indices: cache.data });
  }
  const indices = await getMarketIndices();
  cache = { data: indices, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json({ indices });
}
