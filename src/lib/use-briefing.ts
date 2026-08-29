"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Analysis } from "./types";
import { resolveStockName } from "./stock-name";

function cacheKey(ticker: string) {
  return `nescio.briefing.${ticker}`;
}

function readSession(ticker: string): Analysis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(ticker));
    return raw ? (JSON.parse(raw) as Analysis) : null;
  } catch {
    return null;
  }
}

const snapshotCache = new Map<string, Analysis | null>();
const listeners = new Map<string, Set<() => void>>();

const LOADING_STAGES = [
  "시세 확인하는 중…",
  "관련 뉴스 긁어모으는 중…",
  "원인 하나하나 뜯어보는 중…",
  "쩐형이 코멘트 쓰는 중…",
];

function primeSnapshot(ticker: string) {
  if (!snapshotCache.has(ticker)) snapshotCache.set(ticker, readSession(ticker));
  return snapshotCache.get(ticker) ?? null;
}

function writeSnapshot(ticker: string, analysis: Analysis) {
  snapshotCache.set(ticker, analysis);
  if (typeof window !== "undefined") window.sessionStorage.setItem(cacheKey(ticker), JSON.stringify(analysis));
  listeners.get(ticker)?.forEach((listener) => listener());
}

function subscribe(ticker: string, callback: () => void) {
  let set = listeners.get(ticker);
  if (!set) {
    set = new Set();
    listeners.set(ticker, set);
  }
  set.add(callback);
  return () => set!.delete(callback);
}

export function useStockBriefing(ticker: string, initialName?: string) {
  const cached = useSyncExternalStore(
    (callback) => subscribe(ticker, callback),
    () => primeSnapshot(ticker),
    () => null,
  );
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string }>({ loading: true, error: "" });
  const effectiveLoading = cached ? false : fetchState.loading;
  // 로딩 문구는 tick 카운터에서 파생한다. setState를 effect 본문에서 동기로 부르지 않으려고
  // (cascading render 경고) 인터벌 콜백에서만 tick을 올리고, 로딩이 끝나면 cleanup에서 0으로 되돌린다.
  const [loadingTick, setLoadingTick] = useState(0);
  const loadingMessage = LOADING_STAGES[loadingTick % LOADING_STAGES.length];

  useEffect(() => {
    if (!effectiveLoading) return;
    const interval = setInterval(() => setLoadingTick((tick) => tick + 1), 2200);
    return () => {
      clearInterval(interval);
      setLoadingTick(0);
    };
  }, [effectiveLoading]);

  const fetchBriefing = useCallback(
    async (name: string) => {
      setFetchState({ loading: true, error: "" });
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ticker }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "브리핑을 불러오지 못했습니다.");
        writeSnapshot(ticker, data);
        setFetchState({ loading: false, error: "" });
      } catch (requestError) {
        setFetchState({ loading: false, error: requestError instanceof Error ? requestError.message : "브리핑을 불러오지 못했습니다." });
      }
    },
    [ticker],
  );

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    (async () => {
      setFetchState({ loading: true, error: "" });
      const name = initialName ?? (await resolveStockName(ticker));
      if (cancelled) return;
      if (!name) {
        setFetchState({ loading: false, error: "종목 정보를 찾을 수 없습니다." });
        return;
      }
      fetchBriefing(name);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, cached]);

  const refresh = useCallback(() => {
    const name = initialName ?? cached?.stock.name;
    if (name) fetchBriefing(name);
  }, [cached?.stock.name, fetchBriefing, initialName]);

  return {
    analysis: cached,
    loading: effectiveLoading,
    error: cached ? "" : fetchState.error,
    loadingMessage,
    refresh,
  };
}
