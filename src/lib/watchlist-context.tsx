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

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuthContext();
  const [watchlist, setWatchlist] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    let active = true;

    // profile-context.tsx와 동일한 이유(react-hooks/set-state-in-effect가 이펙트 본문에서
    // 곧바로 호출되는 setState를 지적함)로 전체를 마이크로태스크 콜백 안에 둔다.
    Promise.resolve().then(async () => {
      if (!active) return;

      if (!user) {
        setWatchlist([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("watchlist_items")
        .select("ticker, name, market")
        .eq("user_id", user.id)
        .order("added_at", { ascending: true });
      if (!active) return;

      if (error) {
        console.warn("[watchlist] 조회 실패:", error);
        setWatchlist([]);
      } else {
        setWatchlist((data ?? []) as Stock[]);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [supabase, user, authLoading]);

  const add = useCallback(
    async (stock: Stock) => {
      if (!user) return;
      setWatchlist((current) => (current.some((item) => item.ticker === stock.ticker) ? current : [...current, stock]));
      const { error } = await supabase
        .from("watchlist_items")
        .upsert({ user_id: user.id, ticker: stock.ticker, name: stock.name, market: stock.market }, { onConflict: "user_id,ticker" });
      if (error) {
        console.warn("[watchlist] 추가 실패, 롤백:", error);
        setWatchlist((current) => current.filter((item) => item.ticker !== stock.ticker));
      }
    },
    [supabase, user],
  );

  const addMany = useCallback(
    async (stocks: Stock[]) => {
      if (!user || stocks.length === 0) return;
      const existing = new Set(watchlist.map((item) => item.ticker));
      const toAdd = stocks.filter((stock) => !existing.has(stock.ticker));
      if (toAdd.length === 0) return;
      setWatchlist((current) => [...current, ...toAdd]);
      const { error } = await supabase
        .from("watchlist_items")
        .upsert(
          toAdd.map((stock) => ({ user_id: user.id, ticker: stock.ticker, name: stock.name, market: stock.market })),
          { onConflict: "user_id,ticker" },
        );
      if (error) {
        console.warn("[watchlist] 일괄 추가 실패, 롤백:", error);
        const addedTickers = new Set(toAdd.map((s) => s.ticker));
        setWatchlist((current) => current.filter((item) => !addedTickers.has(item.ticker)));
      }
    },
    [supabase, user, watchlist],
  );

  const remove = useCallback(
    async (ticker: string) => {
      if (!user) return;
      const removed = watchlist.find((item) => item.ticker === ticker);
      setWatchlist((current) => current.filter((item) => item.ticker !== ticker));
      const { error } = await supabase.from("watchlist_items").delete().eq("user_id", user.id).eq("ticker", ticker);
      if (error && removed) {
        console.warn("[watchlist] 삭제 실패, 롤백:", error);
        setWatchlist((current) => [...current, removed]);
      }
    },
    [supabase, user, watchlist],
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
