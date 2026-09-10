"use client";

import { useEffect, useRef, useState } from "react";

export type LivePrice = { price: number; changeRate: number };

/**
 * 홈 대시보드 관심종목 카드의 LiveSparkline에 값을 흘려보내는 훅.
 * watchlist-summary처럼 한 번에 다 부르는(batched) 방식으로 종목 수만큼 개별 폴링
 * 타이머를 두지 않는다 — KIS 레이트리밋을 감안한 선택 (watchlist-summary의 배치 패턴과 동일).
 *
 * ⚠️ 이 훅이 부르는 /api/live-prices는 이번에 새로 추가된 엔드포인트라, 이 편집을 만든
 * 세션에서는 실제로 켜서 검증하지 못했다(조직 네트워크 정책상 KIS API 자체를 호출할 수
 * 없는 환경에서 작업함). 처음 켤 때 네트워크 탭에서 응답이 기대한 모양인지 한 번 확인해달라.
 */
export function useLiveWatchlistPrices(tickers: string[], intervalMs = 4000) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const tickersRef = useRef(tickers);

  // tickers 배열은 매 렌더마다 새 참조로 들어올 수 있어서, "내용"이 바뀔 때만
  // 폴링을 재시작하도록 join한 문자열을 의존성으로 쓴다. ref 갱신은 렌더 중이 아니라
  // 커밋 후(effect)에 해야 해서 별도 effect로 뺐다.
  const tickersKey = tickers.join(",");
  useEffect(() => {
    tickersRef.current = tickers;
  });

  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch("/api/live-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: tickersRef.current }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { prices?: Record<string, LivePrice> };
        if (!cancelled && data.prices) setPrices((prev) => ({ ...prev, ...data.prices }));
      } catch {
        // 한 번 실패해도 다음 폴링에서 다시 시도한다 — 조용히 넘어가고, 그 사이 카드는
        // 이전 값(또는 watchlist-summary의 정적 종가)을 계속 보여준다.
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey, intervalMs]);

  return prices;
}
