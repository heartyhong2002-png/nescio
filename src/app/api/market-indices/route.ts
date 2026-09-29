import { NextRequest, NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/krx";
import { fetchDomesticIndices, fetchOverseasIndicesDebug } from "@/lib/kis";
import { getMarketComment } from "@/lib/market-comment";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { MarketIndex } from "@/lib/types";

// 지수는 AI 멘트를 기다리지 않고 먼저 반환한다. 두 단계는 같은 짧은 캐시 스냅샷을
// 공유하므로 뒤늦게 도착한 멘트도 화면에 표시된 지수를 설명한다.
type IndexCache = { data: MarketIndex[]; expiresAt: number };
type CommentCache = { indices: MarketIndex[]; comment: string | null; expiresAt: number };
let indexCache: IndexCache | null = null;
let indexRequest: Promise<MarketIndex[]> | null = null;
let commentCache: CommentCache | null = null;
let commentRequest: Promise<string | null> | null = null;
const CACHE_TTL_MS = 3 * 60_000;

async function loadIndices(): Promise<MarketIndex[]> {
  if (indexCache && indexCache.expiresAt > Date.now()) return indexCache.data;
  if (indexRequest) return indexRequest;
  indexRequest = (async () => {
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
    indexCache = { data: domestic, expiresAt: Date.now() + CACHE_TTL_MS };
    return domestic;
  })().finally(() => { indexRequest = null; });
  return indexRequest;
}

async function loadComment(indices: MarketIndex[]): Promise<string | null> {
  if (commentCache?.indices === indices && commentCache.expiresAt > Date.now()) return commentCache.comment;
  if (commentRequest) return commentRequest;
  commentRequest = getMarketComment(indices)
    .then((comment) => {
      commentCache = { indices, comment, expiresAt: Date.now() + CACHE_TTL_MS };
      return comment;
    })
    .finally(() => { commentRequest = null; });
  return commentRequest;
}

export async function GET(request: NextRequest) {
  const { ok, retryAfterMs } = rateLimit(`market-indices:${clientIp(request)}`, 30, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  // 기존 디버그 경로와 기본 { indices, comment } 응답은 유지한다.
  if (request.nextUrl.searchParams.get("debug") === "1") {
    const debug = await fetchOverseasIndicesDebug();
    return NextResponse.json({ debug });
  }
  const indices = await loadIndices();
  const phase = request.nextUrl.searchParams.get("phase");
  if (phase === "indices") return NextResponse.json({ indices });
  const comment = await loadComment(indices);
  if (phase === "comment") return NextResponse.json({ comment });
  return NextResponse.json({ indices, comment });
}
