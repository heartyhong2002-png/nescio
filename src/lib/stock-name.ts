"use client";

import { Stock } from "./types";

// 목록 API 응답을 세션에 캐시해두고 티커 -> 종목명을 조회한다.
// use-briefing(AI 브리핑)과 use-summary(빠른 시세) 양쪽에서 공유한다.
export async function resolveStockName(ticker: string): Promise<string | null> {
  try {
    const cached = window.sessionStorage.getItem("nescio.stocks-cache");
    const stocks: Stock[] = cached
      ? JSON.parse(cached)
      : await fetch("/api/stocks").then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.sessionStorage.setItem("nescio.stocks-cache", JSON.stringify(data.stocks));
          return data.stocks as Stock[];
        });
    return stocks.find((stock) => stock.ticker === ticker)?.name ?? null;
  } catch {
    return null;
  }
}
