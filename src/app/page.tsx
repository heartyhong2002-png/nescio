"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { LiveSparkline } from "@/components/LiveSparkline";
import { changeArrow, changeEmoji, changeDirection, formatPrice } from "@/lib/format";
import { useOnboarded, useWatchlist } from "@/lib/storage";
import { MarketIndex, Stock } from "@/lib/types";
import { useLiveWatchlistPrices } from "@/lib/use-live-prices";

type SummaryItem = Stock & { close: number | null; changeRate: number | null; newsCount: number | null };

// LiveSparkline은 (현재가, 기준값) 쌍을 받는데 우리가 들고 있는 건 (현재가, 등락률%)이라
// 기준값을 역산해서 넘긴다 — 등락률은 항상 전일 종가 대비라는 이 앱의 기존 규약과 맞춘다.
function referenceFromChangeRate(price: number, changeRate: number) {
  return price / (1 + changeRate / 100);
}

// 코스피/코스닥 대표지수 — 관심종목과 별개로 오늘 시장 전체 분위기를 한눈에 보여준다.
// comment는 "왜" 오르고 내렸는지를 쩐형 캐릭터 톤으로 설명하는 한 줄(부가 기능이라 없을 수도
// 있음). KRX 지수 API 필드명을 확신 못 해 얻지 못할 수도 있어서(krx.ts 주석 참고) 실패하면
// 빈 배열로 조용히 접는다.
function useMarketIndices() {
  const [indices, setIndices] = useState<MarketIndex[] | null>(null);
  const [comment, setComment] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-indices")
      .then(async (response) => {
        const data = await response.json();
        if (!cancelled) {
          setIndices(response.ok ? (data.indices ?? []) : []);
          setComment(response.ok ? (data.comment ?? null) : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIndices([]);
          setComment(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { indices, comment };
}

function MarketIndexStrip({ indices, comment }: { indices: MarketIndex[] | null; comment: string | null }) {
  if (indices === null) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="skeleton" style={{ height: 46, borderRadius: 12, flex: 1 }} />
          <div className="skeleton" style={{ height: 46, borderRadius: 12, flex: 1 }} />
        </div>
      </div>
    );
  }
  if (indices.length === 0) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      {/* 코스피/코스닥 2개일 땐 꽉 채우고, 해외 지수까지 붙어 4~6개가 되면 한 화면에 다
          욱여넣기보다 가로 스크롤로 넘기는 게 낫다 — 폭이 좁아지면 숫자가 다 안 보인다. */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
        {indices.map((index) => {
          const direction = changeDirection(index.changeRate);
          return (
            <div
              key={index.name}
              className="card"
              style={{
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flex: "1 1 150px",
                minWidth: 150,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>{index.name}</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{formatPrice(index.close)}</span>
                <span className={`price-${direction}`} style={{ fontSize: 12 }}>
                  {changeArrow(index.changeRate)}{" "}
                  {index.changeRate !== null ? `${Math.abs(index.changeRate).toFixed(2)}%` : "—"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {comment && (
        <div className="card" style={{ marginTop: 10, padding: "12px 14px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            오늘 시장 분위기
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{comment}</div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { onboarded, loading } = useOnboarded();
  const { watchlist, remove, loading: watchlistLoading } = useWatchlist();
  const [items, setItems] = useState<SummaryItem[] | null>(null);
  const [error, setError] = useState("");
  const { indices, comment } = useMarketIndices();
  const liveTickers = watchlist.map((stock) => stock.ticker);
  const livePrices = useLiveWatchlistPrices(liveTickers);

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

      <MarketIndexStrip indices={indices} comment={comment} />

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
                // 폴링(live-prices)이 아직 안 왔으면 watchlist-summary의 정적 종가로 대체 —
                // 카드가 빈 채로 있지 않고 처음부터 뭔가는 보이게 한다.
                const live =
                  livePrices[stock.ticker] ??
                  (stock.close !== null && stock.changeRate !== null
                    ? { price: stock.close, changeRate: stock.changeRate }
                    : null);
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
                        <>
                          {live && (
                            <LiveSparkline
                              value={live.price}
                              referenceValue={referenceFromChangeRate(live.price, live.changeRate)}
                            />
                          )}
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatPrice(stock.close)}</div>
                            <div className={`price-${direction}`} style={{ fontSize: 12, marginTop: 3 }}>
                              {changeArrow(stock.changeRate)}{" "}
                              {stock.changeRate !== null ? `${Math.abs(stock.changeRate).toFixed(2)}%` : "—"}
                              {changeEmoji(stock.changeRate)}
                            </div>
                          </div>
                        </>
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
