"use client";

import { useCallback, useEffect, useState } from "react";
import { Price, Stock } from "./types";
import { resolveStockName } from "./stock-name";

export type StockSummary = { stock: Stock; price: Price };

/**
 * 종목 상세 페이지의 헤더/차트/재무지표에 필요한 최소 데이터(이름 + 시세)만 빠르게 가져온다.
 * useStockBriefing(느린 2단계 LLM 브리핑)과 독립적으로 돌아가서, 차트가 AI 분석을 기다리지 않게 한다.
 */
export function useStockSummary(ticker: string, initialName?: string) {
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(
    async (name: string) => {
      try {
        const response = await fetch(
          `/api/price-summary?ticker=${encodeURIComponent(ticker)}&name=${encodeURIComponent(name)}`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "가격 정보를 불러오지 못했습니다.");
        setSummary({ stock: { name, ticker, market: "KOSPI" }, price: data.price });
        setError("");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "가격 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [ticker],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSummary(null);
      setError("");
      const name = initialName ?? (await resolveStockName(ticker));
      if (cancelled) return;
      if (!name) {
        setError("종목 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      await fetchSummary(name);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  return { summary, loading, error };
}
