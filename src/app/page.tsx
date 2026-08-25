"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { changeArrow, changeEmoji, changeDirection, formatPrice } from "@/lib/format";
import { useOnboarded, useWatchlist } from "@/lib/storage";
import { Stock } from "@/lib/types";

type SummaryItem = Stock & { close: number | null; changeRate: number | null; newsCount: number | null };

export default function HomePage() {
  const router = useRouter();
  const { onboarded, hydrated } = useOnboarded();
  const { watchlist } = useWatchlist();
  const [items, setItems] = useState<SummaryItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, router]);

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
        if (!cancelled) setError(err instanceof Error ? err.message : "관심종목 요약을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [watchlist]);

  if (!hydrated || !onboarded) return null;

  const mover = items && items.length > 0
    ? [...items].sort((a, b) => Math.abs(b.changeRate ?? 0) - Math.abs(a.changeRate ?? 0))[0]
    : null;

  return (
    <main className="page with-bottom-nav">
      <div className="container" style={{ paddingTop: 20 }}>
        <div className="topbar">
          <div className="title-md">오늘의 브리핑</div>
          <Link href="/alerts" className="muted" style={{ fontSize: 12 }}>
            🔔 {items?.filter((item) => (item.newsCount ?? 0) > 0).length ?? 0}
          </Link>
        </div>

        {mover && (
          <Link href={`/stock/${mover.ticker}?name=${encodeURIComponent(mover.name)}`} className="hero-card" style={{ display: "block", marginBottom: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              가장 중요한 소식
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5, marginBottom: 8 }}>
              오늘 관심종목 중 {mover.name}(이)가 가장 크게 움직였어요
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>
              {formatPrice(mover.close)}원 · {changeArrow(mover.changeRate)} {Math.abs(mover.changeRate ?? 0).toFixed(2)}%
              {changeEmoji(mover.changeRate)} — 왜 그런지 브리핑에서 확인하세요.
            </div>
            <div style={{ fontSize: 12, marginTop: 12, textDecoration: "underline" }}>브리핑 보기 →</div>
          </Link>
        )}

        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          관심종목 {watchlist.length}
        </div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

        {watchlist.length === 0 ? (
          <Link href="/watchlist/add" className="placeholder-box" style={{ padding: 24, textAlign: "center" }}>
            아직 담은 종목이 없어요. 눌러서 관심종목을 담아보세요.
          </Link>
        ) : (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {(items ?? watchlist.map((stock) => ({ ...stock, close: null, changeRate: null, newsCount: null }))).map((stock) => {
              const loading = items === null;
              const direction = changeDirection(stock.changeRate);
              return (
                <Link key={stock.ticker} href={`/stock/${stock.ticker}?name=${encodeURIComponent(stock.name)}`} className="list-row" style={{ color: "inherit" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{stock.name}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                      {loading ? "불러오는 중…" : stock.newsCount !== null ? `오늘 뉴스 ${stock.newsCount}건` : "뉴스 정보 없음"}
                    </div>
                  </div>
                  {loading ? (
                    <div className="skeleton" style={{ width: 60, height: 30 }} />
                  ) : (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13 }}>{formatPrice(stock.close)}</div>
                      <div className={`price-${direction}`} style={{ fontSize: 11, marginTop: 3 }}>
                        {changeArrow(stock.changeRate)} {stock.changeRate !== null ? `${Math.abs(stock.changeRate).toFixed(2)}%` : "—"}
                        {changeEmoji(stock.changeRate)}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
