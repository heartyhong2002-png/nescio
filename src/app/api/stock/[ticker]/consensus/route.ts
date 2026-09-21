import { NextResponse } from "next/server";
import { scrapeAnalystReports } from "@/lib/consensus-scraper";
import { analyzeConsensus } from "@/lib/consensus-analyzer";
import { fetchCurrentPrice } from "@/lib/kis";
import { StockConsensus } from "@/lib/consensus-types";

// 30분 동안 Vercel Edge Cache (ISR 방식) 적용
export const revalidate = 1800;

export async function GET(request: Request, context: { params: Promise<{ ticker: string }> }) {
  try {
    const params = await context.params;
    const ticker = params.ticker;
    
    // 1. 증권사 리포트 목록 수집 (네이버 V2 API)
    const reports = await scrapeAnalystReports(ticker, 5); // 최근 5건
    
    // 2. 종목의 현재가 조회 (목표가 대비 상승 여력 계산을 위함)
    const currentPriceData = await fetchCurrentPrice(ticker);
    const currentPrice = currentPriceData ? Number(currentPriceData.price) : 0;
    
    // 3. AI 분석 엔진 호출 (요약 및 팩트 추출)
    const aiAnalysis = await analyzeConsensus(ticker, reports, currentPrice);
    
    // 4. 응답 객체 구성
    const response: StockConsensus = {
      ticker,
      reports,
      aiAnalysis,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error(`[Consensus API Error] ${error}`);
    return NextResponse.json({ error: "Failed to fetch consensus data" }, { status: 500 });
  }
}
