import { NextResponse } from "next/server";
import { scrapeAnalystReports } from "@/lib/consensus-scraper";
import { analyzeConsensus } from "@/lib/consensus-analyzer";
import { fetchCurrentPrice } from "@/lib/kis";
import { StockConsensus } from "@/lib/consensus-types";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// 30분 동안 Vercel Edge Cache (ISR 방식) 적용
export const revalidate = 1800;

// Note: In-memory caching and rate limiting doesn't share across serverless instances.
const cache = new Map<string, { data: StockConsensus; expiry: number }>();
const inFlightPromises = new Map<string, Promise<StockConsensus>>();

export async function GET(request: Request, context: { params: Promise<{ ticker: string }> }) {
  try {
    const ip = clientIp(request);
    const { ok, retryAfterMs } = rateLimit(`consensus:${ip}`, 10, 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    const params = await context.params;
    const ticker = params.ticker;
    
    // Ticker validation: 1-10자리 영숫자 (한국 거래소 종목코드 '005930', 해외 'AAPL' 등)
    if (!/^[a-zA-Z0-9]{1,10}$/.test(ticker)) {
      return NextResponse.json({ error: "올바르지 않은 종목 코드예요." }, { status: 400 });
    }
    
    // 2. 종목의 현재가 조회 (목표가 대비 상승 여력 계산을 위함)
    const currentPriceData = await fetchCurrentPrice(ticker);
    const currentPrice = currentPriceData ? Number(currentPriceData.price) : 0;
    
    const roundedPrice = Math.round(currentPrice / 100) * 100;
    const PROMPT_VERSION = "consensus-v1-20260929";
    const cacheKey = `consensus:${ticker}:${roundedPrice}:${PROMPT_VERSION}`;
    const now = Date.now();
    
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return NextResponse.json(cached.data);
    }

    if (inFlightPromises.has(cacheKey)) {
      try {
        const data = await inFlightPromises.get(cacheKey);
        return NextResponse.json(data);
      } catch {
        // Fallthrough on error to retry
      }
    }
    
    const fetchPromise = (async () => {
      try {
        // 1. 증권사 리포트 목록 수집 (네이버 V2 API)
        const reports = await scrapeAnalystReports(ticker, 5); // 최근 5건
        
        // 3. AI 분석 엔진 호출 (요약 및 팩트 추출)
        const aiAnalysis = await analyzeConsensus(ticker, reports, currentPrice);
        
        // 4. 응답 객체 구성
        const data: StockConsensus = {
          ticker,
          reports,
          aiAnalysis,
        };
        
        cache.set(cacheKey, { data, expiry: Date.now() + 30 * 60 * 1000 }); // 30 min TTL
        return data;
      } finally {
        inFlightPromises.delete(cacheKey);
      }
    })();
    
    inFlightPromises.set(cacheKey, fetchPromise);
    const data = await fetchPromise;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Consensus API Error]`, error);
    return NextResponse.json({ error: "컨센서스 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
