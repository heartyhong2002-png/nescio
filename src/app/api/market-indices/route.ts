import { NextRequest, NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/krx";
import { fetchDomesticIndices, fetchOverseasIndicesDebug } from "@/lib/kis";
import { getMarketComment } from "@/lib/market-comment";
import { fetchAsiaIndices } from "@/lib/overseas-indices";
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
    // KIS 해외지수 TR은 아시아 지수에 0을 반환해 실제 서비스 공급원으로 쓰지 않는다.
    // 국내·해외 조회는 독립적이므로 병렬로 시작하고, 해외 실패는 국내 카드에 영향을 주지 않는다.
    const domesticPromise = fetchDomesticIndices()
      .then((data) => {
        if (data.length !== 2) throw new Error("KIS 국내지수 일부가 비어 있습니다.");
        return data;
      })
      .catch(async (error) => {
        console.warn("[market-indices] KIS 국내지수 실패 → KRX 일별 종가 폴백:", error);
        return getMarketIndices();
      });
    const asiaPromise = fetchAsiaIndices().catch((error) => {
      console.warn("[market-indices] 아시아 지수 실패, 국내 지수만 반환:", error);
      return [] as MarketIndex[];
    });
    const [domestic, asia] = await Promise.all([domesticPromise, asiaPromise]);
    const data = [...domestic, ...asia];
    indexCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
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
