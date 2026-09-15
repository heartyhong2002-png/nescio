import { NextRequest, NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/krx";
import { fetchOverseasIndicesDebug } from "@/lib/kis";
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

export async function GET(request: NextRequest) {
  // 임시 디버그 통로 — 해외지수(니케이/상해/심천/항셍)가 0/0.00%로 깨지는 원인을 찾으려고
  // KIS 원본 응답을 그대로 보고 싶을 때 /api/market-indices?debug=1 로 호출한다. 원인
  // 확인되면 이 분기와 kis.ts의 fetchOverseasIndicesDebug는 지워도 된다.
  if (request.nextUrl.searchParams.get("debug") === "1") {
    const debug = await fetchOverseasIndicesDebug();
    return NextResponse.json({ debug });
  }
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ indices: cache.data, comment: cache.comment });
  }
  // 해외지수(니케이/상해/심천/항셍)는 당분간 뺀다 — KIS의 FHKST03030200(지수분봉조회)가
  // 이 4개 지수에 대해 모든 필드를 "0.00"으로 반환한다(?debug=1로 실측 확인 완료). 다른
  // 개발자 사례를 보면 이 TR 자체가 미국 지수 전용일 가능성이 있어 코드값을 바꿔도 안 될
  // 수 있다 — 아시아 지수를 다시 켜려면 fetchOverseasIndicesDebug로 실측하면서 제대로 된
  // 엔드포인트/코드를 찾아야 한다. 코스피/코스닥은 KRX 데이터라 이 이슈와 무관하게 정상.
  const domestic = await getMarketIndices();
  const indices = domestic;
  const comment = await getMarketComment(domestic);
  cache = { data: indices, comment, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json({ indices, comment });
}
