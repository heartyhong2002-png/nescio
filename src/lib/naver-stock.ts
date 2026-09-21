/**
 * 네이버 금융 모바일 실시간 시세 API 클라이언트.
 *
 * 한국거래소(KRX) Open API(bydd_trd)는 당일 거래가 완전히 마감되고 정산된 저녁에야
 * 데이터가 들어오는 치명적인 시차(Lag)가 있습니다.
 * 따라서 "상장 당일 09:00 ~ 15:30 장중"에는 KRX Open API로는 신규 상장 주식의 시세를 전혀 알 수 없습니다.
 *
 * 본 헬퍼는 별도의 API 키 인증 없이도 6자리 종목코드(티커)만으로
 * 상장 당일 장중 실시간 체결가, 등락률, 종목명을 밀리초 단위로 안전하게 조회합니다.
 */

export type NaverStockPrice = {
  price: number;
  changeRate: number;
  name?: string;
  market?: string;
};

export async function fetchNaverStockPrice(ticker: string): Promise<NaverStockPrice | null> {
  if (!ticker || typeof ticker !== "string") return null;

  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${encodeURIComponent(ticker)}/basic`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = await res.json();

    const rawClose = json.closePrice?.replace(/,/g, "");
    const price = Number(rawClose);
    if (!Number.isFinite(price) || price <= 0) return null;

    const rawRatio = json.fluctuationsRatio?.replace(/,/g, "");
    let changeRate = Number(rawRatio);
    if (!Number.isFinite(changeRate)) changeRate = 0;

    // 네이버 compareToPreviousPrice code:
    // "1": 상한, "2": 상승, "3": 보합, "4": 하한, "5": 하락
    const compareCode = json.compareToPreviousPrice?.code;
    if ((compareCode === "4" || compareCode === "5") && changeRate > 0) {
      changeRate = -changeRate;
    }

    return {
      price,
      changeRate,
      name: json.stockName,
      market: json.stockExchangeName,
    };
  } catch (error) {
    // 네트워크 타임아웃 등 예외 시 조용히 null 반환
    return null;
  }
}
