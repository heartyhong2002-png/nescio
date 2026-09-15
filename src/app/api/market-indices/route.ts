import { NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/krx";
import { fetchOverseasIndices } from "@/lib/kis";
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
  // 국내(KRX)와 해외(KIS)는 완전히 다른 공급자라 하나가 실패해도 나머지는 보여줘야 한다 —
  // fetchOverseasIndices 자체가 내부적으로 지수별 안전 처리를 하지만, 만에 하나 그 함수
  // 자체가 던지는 경우까지 대비해 여기서도 한 번 더 감싼다.
  const [domestic, overseas] = await Promise.all([
    getMarketIndices(),
    fetchOverseasIndices().catch(() => []),
  ]);
  const indices = [...domestic, ...overseas];
  // "쩐형" 코멘트는 국내 증시용으로 짜여 있다(market-comment.ts의 시스템 프롬프트가 "코스피·
  // 코스닥을 합쳐 국내 증시 분위기"로 못박아놨고, 근거 뉴스도 코스피/코스닥만 모은다) — 해외
  // 지수까지 프롬프트에 섞으면 지시문과 데이터가 안 맞아서 국내 지수만 넘긴다. 화면엔 그대로
  // 해외 지수도 같이 뜬다.
  const comment = await getMarketComment(domestic);
  cache = { data: indices, comment, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json({ indices, comment });
}
