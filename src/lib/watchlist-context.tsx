"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "./supabase/client";
import { useAuthContext } from "./auth-context";
import { Stock } from "./types";

type WatchlistContextValue = {
  watchlist: Stock[];
  loading: boolean;
  add: (stock: Stock) => Promise<void>;
  addMany: (stocks: Stock[]) => Promise<void>;
  remove: (ticker: string) => Promise<void>;
  toggle: (stock: Stock) => Promise<void>;
  has: (ticker: string) => boolean;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

const LOCAL_WATCHLIST_KEY = "nescio.watchlist_local";
const LEGACY_WATCHLIST_KEY = "nescio.watchlist";

function readLocalWatchlist(): Stock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_WATCHLIST_KEY) || window.localStorage.getItem(LEGACY_WATCHLIST_KEY);
    return raw ? (JSON.parse(raw) as Stock[]) : [];
  } catch {
    return [];
  }
}

function writeLocalWatchlist(stocks: Stock[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(stocks));
  } catch (err) {
    console.warn("[watchlist] 로컬 캐시 저장 실패:", err);
  }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuthContext();
  const [watchlist, setWatchlist] = useState<Stock[]>(() => readLocalWatchlist());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    let active = true;

    Promise.resolve().then(async () => {
      if (!active) return;

      if (!user) {
        // 비로그인 상태: 로컬 스토리지에 보관된 종목 표시
        const local = readLocalWatchlist();
        setWatchlist(local);
        setLoading(false);
        return;
      }

      setLoading(true);

      // 1. 로그인 시 로컬에 임시로 담겨있던 종목이 있으면 Supabase로 자동 병합(upsert)
      const localStocks = readLocalWatchlist();
      if (localStocks.length > 0) {
        const { error: mergeError } = await supabase.from("watchlist_items").upsert(
          localStocks.map((s) => ({ user_id: user.id, ticker: s.ticker, name: s.name, market: s.market })),
          { onConflict: "user_id,ticker" },
        );
        if (mergeError) {
          console.warn("[watchlist] 로컬 종목 Supabase 자동 병합 실패:", mergeError);
        }
      }

      // 2. Supabase에서 해당 사용자의 전체 관심종목 조회
      const { data, error } = await supabase
        .from("watchlist_items")
        .select("ticker, name, market")
        .eq("user_id", user.id)
        .order("added_at", { ascending: true });
      if (!active) return;

      if (error) {
        console.warn("[watchlist] 조회 실패, 로컬 캐시 유지:", error);
      } else {
        const remoteStocks = (data ?? []) as Stock[];
        setWatchlist(remoteStocks);
        writeLocalWatchlist(remoteStocks);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [supabase, user, authLoading]);

  const add = useCallback(
    async (stock: Stock) => {
      setWatchlist((current) => {
        if (current.some((item) => item.ticker === stock.ticker)) return current;
        const next = [...current, stock];
        writeLocalWatchlist(next);
        return next;
      });

      if (!user) return; // 비로그인 시 로컬에만 보관, 로그인 시 자동 동기화됨

      const { error } = await supabase
        .from("watchlist_items")
        .upsert({ user_id: user.id, ticker: stock.ticker, name: stock.name, market: stock.market }, { onConflict: "user_id,ticker" });
      if (error) {
        console.warn("[watchlist] Supabase 추가 실패, 롤백:", error);
        setWatchlist((current) => {
          const next = current.filter((item) => item.ticker !== stock.ticker);
          writeLocalWatchlist(next);
          return next;
        });
      }
    },
    [supabase, user],
  );

  const addMany = useCallback(
    async (stocks: Stock[]) => {
      if (stocks.length === 0) return;
      let toAdd: Stock[] = [];
      setWatchlist((current) => {
        const existing = new Set(current.map((item) => item.ticker));
        toAdd = stocks.filter((stock) => !existing.has(stock.ticker));
        if (toAdd.length === 0) return current;
        const next = [...current, ...toAdd];
        writeLocalWatchlist(next);
        return next;
      });

      if (!user || toAdd.length === 0) return;

      const { error } = await supabase
        .from("watchlist_items")
        .upsert(
          toAdd.map((stock) => ({ user_id: user.id, ticker: stock.ticker, name: stock.name, market: stock.market })),
          { onConflict: "user_id,ticker" },
        );
      if (error) {
        console.warn("[watchlist] 일괄 추가 실패, 롤백:", error);
        const addedTickers = new Set(toAdd.map((s) => s.ticker));
        setWatchlist((current) => {
          const next = current.filter((item) => !addedTickers.has(item.ticker));
          writeLocalWatchlist(next);
          return next;
        });
      }
    },
    [supabase, user],
  );

  const remove = useCallback(
    async (ticker: string) => {
      let removed: Stock | undefined;
      setWatchlist((current) => {
        removed = current.find((item) => item.ticker === ticker);
        const next = current.filter((item) => item.ticker !== ticker);
        writeLocalWatchlist(next);
        return next;
      });

      if (!user) return;

      const { error } = await supabase.from("watchlist_items").delete().eq("user_id", user.id).eq("ticker", ticker);
      if (error && removed) {
        console.warn("[watchlist] 삭제 실패, 롤백:", error);
        setWatchlist((current) => {
          const next = [...current, removed!];
          writeLocalWatchlist(next);
          return next;
        });
      }
    },
    [supabase, user],
  );

  const toggle = useCallback(
    async (stock: Stock) => {
      const exists = watchlist.some((item) => item.ticker === stock.ticker);
      if (exists) await remove(stock.ticker);
      else await add(stock);
    },
    [watchlist, add, remove],
  );

  const has = useCallback((ticker: string) => watchlist.some((item) => item.ticker === ticker), [watchlist]);

  const value = useMemo<WatchlistContextValue>(
    () => ({ watchlist, loading, add, addMany, remove, toggle, has }),
    [watchlist, loading, add, addMany, remove, toggle, has],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlistContext() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlistContext는 WatchlistProvider 안에서만 쓸 수 있어요.");
  return ctx;
}
