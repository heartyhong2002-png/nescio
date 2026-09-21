import { NextResponse } from "next/server";
import { getPriceForTicker } from "@/lib/krx";
import { fetchNaverStockPrice } from "@/lib/naver-stock";
import { fetchCurrentPrice } from "@/lib/kis";
import { fetchNewListings } from "@/lib/ipo-listings";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

// 종목 상세 페이지의 헤더/차트/재무지표를 AI 브리핑(느린 2단계 LLM 파이프라인)보다
// 먼저 그릴 수 있도록, 시세만 빠르게 돌려주는 전용 엔드포인트.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";
  const name = searchParams.get("name") ?? "";
  if (!ticker) return NextResponse.json({ error: "종목 코드가 필요합니다." }, { status: 400 });

  try {
    let price = await getPriceForTicker(ticker);

    // KRX Open API(전 영업일 기준)에 아직 반영되지 않은 신규 상장 종목 처리
    // 1순위: 네이버 금융 실시간 API (상장 당일 장중 09:00 즉시 지원, 키 불필요)
    if (price.close === null) {
      try {
        const naver = await fetchNaverStockPrice(ticker);
        if (naver && naver.price > 0) {
          price = {
            close: naver.price,
            changeRate: naver.changeRate,
            marketCap: null,
          };
        }
      } catch {
        // ignore
      }
    }

    // 2순위: KIS(한국투자증권) 실시간 API
    if (price.close === null) {
      try {
        const kisPrice = await fetchCurrentPrice(ticker);
        if (kisPrice && kisPrice.price) {
          price = {
            close: kisPrice.price,
            changeRate: kisPrice.changeRate,
            marketCap: null,
          };
        }
      } catch {
        // KIS 미설정 또는 오류 시 아래 신규상장 크롤러 데이터로 폴백
      }
    }

    if (price.close === null) {
      try {
        const listings = await fetchNewListings();
        const found = [...listings.upcoming, ...listings.history].find((x) => x.ticker === ticker);
        if (found) {
          const fallbackPrice = found.currentPrice ?? found.openPrice ?? found.offerPrice;
          if (fallbackPrice) {
            const rawRate = found.changeRate?.replace("%", "") ?? found.openReturnRate?.replace("%", "") ?? "0";
            price = {
              close: fallbackPrice,
              changeRate: Number(rawRate) || 0,
              marketCap: null,
            };
          }
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ stock: { name, ticker }, price });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
