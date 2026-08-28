"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Analysis, Stock } from "./types";
import { Lang, useLanguage } from "./language";

function cacheKey(ticker: string, lang: Lang) {
  return `nescio.briefing.${lang}.${ticker}`;
}

function readSession(ticker: string, lang: Lang): Analysis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(ticker, lang));
    return raw ? (JSON.parse(raw) as Analysis) : null;
  } catch {
    return null;
  }
}

const snapshotCache = new Map<string, Analysis | null>();
const listeners = new Map<string, Set<() => void>>();

// 언어별로 문구를 따로 둔다 — /api/analyze도 같은 lang을 받아서 브리핑 자체를
// 그 언어로 생성하니, 로딩 중 문구도 맞춰준다.
const LOADING_STAGES: Record<Lang, string[]> = {
  ko: [
    "기다려봐 성질 급한 한국인아…",
    "시세부터 확인하는 중…",
    "관련 뉴스 탈탈 털어보는 중…",
    "원인 하나하나 뜯어보는 중…",
    "쩐형이 코멘트 쓰는 중… 거의 다 왔다",
  ],
  en: [
    "Hang tight, we're on it…",
    "Checking the price first…",
    "Digging through the news…",
    "Breaking down each cause…",
    "Money Bro's writing the comment… almost there",
  ],
};

function storeKey(ticker: string, lang: Lang) {
  return `${lang}::${ticker}`;
}

function primeSnapshot(ticker: string, lang: Lang) {
  const key = storeKey(ticker, lang);
  if (!snapshotCache.has(key)) snapshotCache.set(key, readSession(ticker, lang));
  return snapshotCache.get(key) ?? null;
}

function writeSnapshot(ticker: string, lang: Lang, analysis: Analysis) {
  const key = storeKey(ticker, lang);
  snapshotCache.set(key, analysis);
  if (typeof window !== "undefined") window.sessionStorage.setItem(cacheKey(ticker, lang), JSON.stringify(analysis));
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(ticker: string, lang: Lang, callback: () => void) {
  const key = storeKey(ticker, lang);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
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
  const { lang } = useLanguage();
  const cached = useSyncExternalStore(
    (callback) => subscribe(ticker, lang, callback),
    () => primeSnapshot(ticker, lang),
    () => null,
  );
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string }>({ loading: true, error: "" });
  const effectiveLoading = cached ? false : fetchState.loading;
  // 로딩 문구는 tick 카운터에서 파생한다. setState를 effect 본문에서 동기로 부르지 않으려고
  // (cascading render 경고) 인터벌 콜백에서만 tick을 올리고, 로딩이 끝나면 cleanup에서 0으로 되돌린다.
  const [loadingTick, setLoadingTick] = useState(0);
  const stages = LOADING_STAGES[lang];
  const loadingMessage = stages[loadingTick % stages.length];

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
          body: JSON.stringify({ name, ticker, lang }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "브리핑을 불러오지 못했습니다.");
        writeSnapshot(ticker, lang, data);
        setFetchState({ loading: false, error: "" });
      } catch (requestError) {
        setFetchState({ loading: false, error: requestError instanceof Error ? requestError.message : "브리핑을 불러오지 못했습니다." });
      }
    },
    [ticker, lang],
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
  }, [ticker, cached, lang]);

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
