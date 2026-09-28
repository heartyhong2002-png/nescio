import { NextRequest, NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/krx";
import { fetchDomesticIndices, fetchOverseasIndicesDebug } from "@/lib/kis";
import { getMarketComment } from "@/lib/market-comment";
import { MarketIndex } from "@/lib/types";

// 장중 시장 방향과 뉴스가 어긋나지 않도록 짧게 캐시한다. 지수와 AI 코멘트를 같은 스냅샷으로
// 묶어, 화면 숫자와 멘트가 서로 다른 시점을 설명하지 않게 한다.
type Cache = {
  data: MarketIndex[];
  comment: string | null;
  expiresAt: number;
};
let cache: Cache | null = null;
const CACHE_TTL_MS = 3 * 60_000;

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
  // 엔드포인트/코드를 찾아야 한다.
  // 국내 지수는 KIS 장중 현재지수를 우선하고, KIS 장애 때만 KRX 최근 거래일 종가로 폴백한다.
  let domestic: MarketIndex[];
  try {
    domestic = await fetchDomesticIndices();
    if (domestic.length !== 2) throw new Error("KIS 국내지수 일부가 비어 있습니다.");
  } catch (error) {
    console.warn("[market-indices] KIS 국내지수 실패 → KRX 일별 종가 폴백:", error);
    domestic = await getMarketIndices();
  }
  const indices = domestic;
  const comment = await getMarketComment(domestic);
  cache = { data: indices, comment, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json({ indices, comment });
}
