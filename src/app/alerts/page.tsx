"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useWatchlist } from "@/lib/storage";
import { Stock } from "@/lib/types";

type SummaryItem = Stock & { close: number | null; changeRate: number | null; newsCount: number | null };

export default function AlertsPage() {
  const { watchlist, loading: watchlistLoading } = useWatchlist();
  const [items, setItems] = useState<SummaryItem[] | null>(null);

  useEffect(() => {
    // 관심종목이 아직 서버에서 로딩 중이면 기다린다 — 안 그러면 빈 배열로 먼저 요약을 요청했다가
    // 실제 데이터가 도착한 뒤 다시 요청하는 낭비가 생긴다.
    if (watchlistLoading || watchlist.length === 0) return;
    fetch("/api/watchlist-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: watchlist }),
    })
      .then(async (res) => (res.ok ? setItems((await res.json()).items) : setItems([])))
      .catch(() => setItems([]));
  }, [watchlist, watchlistLoading]);

  const loading = watchlistLoading || (watchlist.length > 0 && items === null);
  const withNews = (items ?? []).filter((item) => (item.newsCount ?? 0) > 0);

  return (
    <AppShell narrow>
      <div className="topbar">
        <div className="page-title">알림함</div>
      </div>

      {loading && <div className="muted" style={{ fontSize: 13 }}>불러오는 중…</div>}

      {!loading && withNews.length === 0 && (
        <div className="placeholder-box" style={{ padding: 32, fontSize: 14 }}>
          아직 새 알림이 없어요.
        </div>
      )}

      {withNews.length > 0 && (
        <div className="list-panel">
          {withNews.map((stock) => (
            <Link
              key={stock.ticker}
              href={`/stock/${stock.ticker}?name=${encodeURIComponent(stock.name)}`}
              className="list-row"
              style={{ color: "inherit" }}
            >
              <div className="stock-icon">{stock.name.slice(0, 1)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{stock.name}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                  오늘 뉴스 {stock.newsCount}건 도착했어요
                </div>
              </div>
              <span className="muted">→</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
