import { NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/krx";
import { getMarketComment } from "@/lib/market-comment";

// 지수는 실시간 급변을 다루는 화면이 아니라서 서버리스 인스턴스 안에서 30분 정도는
// 캐시해도 충분하다 — 관심종목 요약(watchlist-summary)만큼 자주 부를 필요가 없다.
// "쩐형" 시장 분위기 코멘트(comment)도 지수와 같은 주기로만 갱신하면 충분해서 같은
// 캐시에 얹는다 — LLM 호출은 지수 조회보다 느리고 비용도 있으니 30분에 한 번이면 된다.
type Cache = {
  data: Awaited<ReturnType<typeof getMarketIndices>>;
  comment: string | null;
  expiresAt: number;
};
let cache: Cache | null = null;
const CACHE_TTL_MS = 30 * 60_000;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ indices: cache.data, comment: cache.comment });
  }
  const indices = await getMarketIndices();
  const comment = await getMarketComment(indices);
  cache = { data: indices, comment, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json({ indices, comment });
}
