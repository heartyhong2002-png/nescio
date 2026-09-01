"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { changeArrow, changeEmoji, changeDirection, formatPrice } from "@/lib/format";
import { useOnboarded, useWatchlist } from "@/lib/storage";
import { Stock } from "@/lib/types";

type SummaryItem = Stock & { close: number | null; changeRate: number | null; newsCount: number | null };

export default function HomePage() {
  const router = useRouter();
  const { onboarded, loading } = useOnboarded();
  const { watchlist, remove, loading: watchlistLoading } = useWatchlist();
  const [items, setItems] = useState<SummaryItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !onboarded) router.replace("/onboarding");
  }, [loading, onboarded, router]);

  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;
    (async () => {
      setItems(null);
      setError("");
      try {
        const res = await fetch("/api/watchlist-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stocks: watchlist }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "관심종목 요약을 불러오지 못했습니다.");
        if (!cancelled) setItems(data.items);
      } catch (err) {
        if (!cancelled) setItems([]);
        if (!cancelled) setError(err instanceof Error ? err.message : "관심종목 요약을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [watchlist]);

  if (loading || !onboarded) return null;

  const mover =
    items && items.length > 0
      ? [...items].sort((a, b) => Math.abs(b.changeRate ?? 0) - Math.abs(a.changeRate ?? 0))[0]
      : null;
  const newsAlerts = items?.filter((item) => (item.newsCount ?? 0) > 0).length ?? 0;
  const rows: SummaryItem[] =
    items ?? watchlist.map((stock) => ({ ...stock, close: null, changeRate: null, newsCount: null }));
  const summaryLoading = items === null && watchlist.length > 0;

  return (
    <AppShell>
      <div className="topbar">
        <div className="page-title">오늘의 브리핑</div>
        <Link href="/alerts" className="muted" style={{ fontSize: 13 }}>
          🔔 새 소식 {newsAlerts}
        </Link>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {watchlistLoading ? (
        <div className="skeleton" style={{ height: 96, borderRadius: 18 }} />
      ) : watchlist.length === 0 ? (
        <Link href="/watchlist/add" className="placeholder-box" style={{ padding: 36, fontSize: 14 }}>
          아직 담은 종목이 없어요. 눌러서 관심종목을 담아보세요.
        </Link>
      ) : (
        <div className="home-grid">
          <div>
            {mover ? (
              <Link
                href={`/stock/${mover.ticker}?name=${encodeURIComponent(mover.name)}`}
                className="hero-card"
                style={{ display: "block", marginBottom: 22 }}
              >
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  가장 크게 움직인 종목
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.45, marginBottom: 10 }}>
                  {mover.name}(이)가 오늘 가장 크게 움직였어요
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 1.55 }}>
                  {formatPrice(mover.close)}원 · {changeArrow(mover.changeRate)}{" "}
                  {Math.abs(mover.changeRate ?? 0).toFixed(2)}%{changeEmoji(mover.changeRate)} — 왜 그런지 브리핑에서 확인하세요.
                </div>
                <div style={{ fontSize: 13, marginTop: 14, fontWeight: 600 }}>브리핑 보기 →</div>
              </Link>
            ) : summaryLoading ? (
              <div className="skeleton" style={{ height: 150, borderRadius: 18, marginBottom: 22 }} />
            ) : null}

            <div className="section-title">
              관심종목 <span className="muted">{watchlist.length}</span>
            </div>
            <div className="list-panel">
              {rows.map((stock) => {
                const direction = changeDirection(stock.changeRate);
                return (
                  <div key={stock.ticker} className="list-row">
                    <Link
                      href={`/stock/${stock.ticker}?name=${encodeURIComponent(stock.name)}`}
                      style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, color: "inherit" }}
                    >
                      <div className="stock-icon">{stock.name.slice(0, 1)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{stock.name}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                          {summaryLoading
                            ? "불러오는 중…"
                            : stock.newsCount !== null
                              ? `오늘 뉴스 ${stock.newsCount}건`
                              : "뉴스 정보 없음"}
                        </div>
                      </div>
                      {summaryLoading ? (
                        <div className="skeleton" style={{ width: 64, height: 32 }} />
                      ) : (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatPrice(stock.close)}</div>
                          <div className={`price-${direction}`} style={{ fontSize: 12, marginTop: 3 }}>
                            {changeArrow(stock.changeRate)}{" "}
                            {stock.changeRate !== null ? `${Math.abs(stock.changeRate).toFixed(2)}%` : "—"}
                            {changeEmoji(stock.changeRate)}
                          </div>
                        </div>
                      )}
                    </Link>
                    <button
                      className="watchlist-remove-btn"
                      aria-label={`${stock.name} 관심종목에서 삭제`}
                      onClick={() => remove(stock.ticker)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="home-aside">
            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                오늘 요약
              </div>
              <SummaryStat label="담은 종목" value={`${watchlist.length}개`} />
              <SummaryStat label="뉴스 있는 종목" value={summaryLoading ? "…" : `${newsAlerts}개`} />
              <SummaryStat
                label="상승 / 하락"
                value={
                  summaryLoading || !items
                    ? "…"
                    : `${items.filter((i) => (i.changeRate ?? 0) > 0).length} / ${
                        items.filter((i) => (i.changeRate ?? 0) < 0).length
                      }`
                }
                last
              />
              <Link href="/watchlist/add" className="btn btn-secondary btn-block btn-sm" style={{ marginTop: 14 }}>
                종목 더 담기
              </Link>
            </div>
          </aside>
        </div>
      )}

      <style>{`
        .home-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        .home-aside { display: none; }
        @media (min-width: 1000px) {
          .home-grid { grid-template-columns: minmax(0,1fr) 300px; }
          .home-aside { display: block; position: sticky; top: calc(var(--header-h) + 22px); align-self: start; }
        }
      `}</style>
    </AppShell>
  );
}

function SummaryStat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid var(--line)",
        fontSize: 13,
      }}
    >
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
