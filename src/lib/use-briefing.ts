"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Analysis, Stock } from "./types";

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

async function resolveStockName(ticker: string): Promise<string | null> {
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

export function useStockBriefing(ticker: string, initialName?: string) {
  const cached = useSyncExternalStore(
    (callback) => subscribe(ticker, callback),
    () => primeSnapshot(ticker),
    () => null,
  );
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string }>({ loading: true, error: "" });

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
    loading: cached ? false : fetchState.loading,
    error: cached ? "" : fetchState.error,
    refresh,
  };
}
