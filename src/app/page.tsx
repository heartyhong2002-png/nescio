"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import DashboardIntradayChart from "@/components/DashboardIntradayChart";
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

type MarketUiIndex = MarketIndex & { country: string; shortLabel: string; flag?: string };

const ASIA_ORDER = ["니케이225", "상해종합", "심천종합", "대만가권"] as const;

function marketSourceLabel(source: MarketIndex["source"] | undefined) {
  if (source === "Yahoo") return "Yahoo Finance";
  return source ?? "데이터 연결 대기";
}

function marketBasisLabel(index: MarketIndex) {
  if (!index.asOf) return marketSourceLabel(index.source);
  if (/^\d{8}$/.test(index.asOf)) return `${marketSourceLabel(index.source)} · ${index.asOf.slice(0, 4)}-${index.asOf.slice(4, 6)}-${index.asOf.slice(6)} 기준`;
  const date = new Date(index.asOf);
  if (Number.isNaN(date.getTime())) return marketSourceLabel(index.source);
  return `${marketSourceLabel(index.source)} · ${date.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" })} 기준`;
}

// 코스피/코스닥 숫자를 먼저 보여주고 AI 코멘트는 별도 요청으로 뒤에 채운다.
function useMarketIndices() {
  const [indices, setIndices] = useState<MarketIndex[] | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-indices?phase=indices")
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;
        const nextIndices: MarketIndex[] = response.ok && Array.isArray(data.indices) ? data.indices : [];
        setIndices(nextIndices);
        if (nextIndices.length === 0) { setCommentLoading(false); return; }
        try {
          const commentResponse = await fetch("/api/market-indices?phase=comment");
          const commentData = await commentResponse.json();
          if (!cancelled) setComment(commentResponse.ok ? (commentData.comment ?? null) : null);
        } catch {
          if (!cancelled) setComment(null);
        } finally {
          if (!cancelled) setCommentLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIndices([]);
          setCommentLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { indices, comment, commentLoading };
}

function MarketSkeletonCards({ count }: { count: number }) {
  return <div className="dashboard-index-strip" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div className="dashboard-index-card dashboard-index-skeleton" key={index}><span /><strong /><small /></div>)}</div>;
}

function MarketIndexCard({ index }: { index: MarketUiIndex }) {
  const direction = changeDirection(index.changeRate);
  return (
    <article className="dashboard-index-card" tabIndex={0} aria-label={`${index.country} ${index.name} 지수`}>
      <div className="dashboard-index-card-head">
        <span className="dashboard-index-identity"><i aria-hidden="true">{index.flag ?? "🇰🇷"}</i><span><strong>{index.name}</strong><small>{index.country} · {index.shortLabel}</small></span></span>
        <span className="dashboard-index-source">{marketSourceLabel(index.source)}</span>
      </div>
      <div className="dashboard-index-quote"><strong>{formatPrice(index.close)}</strong><span className={`price-${direction}`}><span aria-hidden="true">{changeArrow(index.changeRate)}</span> {index.changeRate === null ? "—" : `${Math.abs(index.changeRate).toFixed(2)}%`}<span className="sr-only">{direction === "up" ? "상승" : direction === "down" ? "하락" : "변동 없음"}</span></span></div>
      <small className="dashboard-index-meta">{marketBasisLabel(index)}</small>
    </article>
  );
}

function MarketSection({ title, description, items, loading, emptyMessage, skeletonCount }: { title: string; description: string; items: MarketUiIndex[]; loading: boolean; emptyMessage: string; skeletonCount: number }) {
  const id = title === "국내 시장" ? "dashboard-domestic-market" : "dashboard-asia-market";
  return <section className="dashboard-market-group" aria-labelledby={id} aria-busy={loading}>
    <div className="dashboard-market-group-head"><div><h2 id={id}>{title}</h2><p>{description}</p></div>{loading && <span role="status">불러오는 중</span>}</div>
    {loading ? <MarketSkeletonCards count={skeletonCount} /> : items.length > 0 ? <div className="dashboard-index-strip">{items.map((item) => <MarketIndexCard index={item} key={item.name} />)}</div> : <div className="dashboard-index-empty" role="status">{emptyMessage}</div>}
  </section>;
}

function MarketIndexOverview({ indices }: { indices: MarketIndex[] | null }) {
  if (indices === null) {
    return (
      <section className="dashboard-index-area" aria-label="시장 지수 로딩 중"><MarketSection title="국내 시장" description="코스피 · 코스닥" items={[]} loading skeletonCount={2} emptyMessage="국내 시장 정보가 없어요." /><MarketSection title="아시아 시장" description="일본 · 중국 · 대만" items={[]} loading skeletonCount={4} emptyMessage="아시아 시장 정보가 없어요." /></section>
    );
  }
  const domestic = indices.filter((index) => index.name === "코스피" || index.name === "코스닥").map((index) => ({ ...index, country: "대한민국", shortLabel: index.name === "코스피" ? "KOSPI" : "KOSDAQ", flag: "🇰🇷" }));
  const asiaByName = new Map(indices.filter((index) => ASIA_ORDER.includes(index.name as (typeof ASIA_ORDER)[number])).map((index) => [index.name, index]));
  const asia = ASIA_ORDER.map((name) => asiaByName.get(name)).filter((item): item is MarketIndex => Boolean(item)).map((item) => ({
    ...item,
    country: item.name === "니케이225" ? "일본" : item.name === "대만가권" ? "대만" : "중국",
    shortLabel: item.name === "니케이225" ? "NIKKEI 225" : item.name === "상해종합" ? "SSE" : item.name === "심천종합" ? "SZSE" : "TAIEX",
    flag: item.name === "니케이225" ? "🇯🇵" : item.name === "대만가권" ? "🇹🇼" : "🇨🇳",
  }));
  return <section className="dashboard-index-area" aria-label="시장 지수"><MarketSection title="국내 시장" description="코스피 · 코스닥" items={domestic} loading={false} skeletonCount={2} emptyMessage="국내 시장 지수를 불러오지 못했어요." /><MarketSection title="아시아 시장" description="일본 · 중국 · 대만" items={asia} loading={false} skeletonCount={4} emptyMessage="아시아 지수 데이터를 아직 받지 못했습니다. 잠시 후 다시 확인해 주세요." /></section>;
}

function MarketAiComment({ comment, loading }: { comment: string | null; loading: boolean }) {
  return (
    <section className="dashboard-market-ai" aria-label="AI 시장 코멘트">
      <span className="dashboard-market-ai-label">AI 시장 코멘트</span>
      {loading ? (
        <div className="skeleton" role="status" aria-label="AI 시장 코멘트 준비 중" />
      ) : (
        <p>{comment || "지금은 AI 시장 코멘트를 불러오지 못했어요. 위 지수는 계속 확인할 수 있습니다."}</p>
      )}
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { onboarded, loading } = useOnboarded();
  const { watchlist, remove, loading: watchlistLoading } = useWatchlist();
  const [items, setItems] = useState<SummaryItem[] | null>(null);
  const [error, setError] = useState("");
  const { indices, comment, commentLoading } = useMarketIndices();
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
    <AppShell variant="intelligence">
      <div className="dashboard-topbar">
        <div>
          <div className="dashboard-date">MARKET BRIEFING</div>
          <h1>오늘의 시장 흐름</h1>
        </div>
        <Link href="/alerts" className="dashboard-alert-link">
          알림 <strong>{newsAlerts}</strong>
        </Link>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      <MarketIndexOverview indices={indices} />
      {indices !== null && indices.length > 0 && <MarketAiComment comment={comment} loading={commentLoading} />}

      {watchlistLoading ? (
        <div className="dashboard-loading-grid">
          <div className="skeleton" style={{ height: 210, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 210, borderRadius: 18 }} />
        </div>
      ) : watchlist.length === 0 ? (
        <Link href="/watchlist/add" className="placeholder-box" style={{ padding: 36, fontSize: 14 }}>
          아직 담은 종목이 없어요. 눌러서 관심종목을 담아보세요.
        </Link>
      ) : (
        <div className="dashboard-grid">
          <div className="dashboard-primary">
            {mover ? (
              <Link
                href={`/stock/${mover.ticker}?name=${encodeURIComponent(mover.name)}`}
                className="dashboard-mover"
                aria-label={`${mover.name} 현재 시세와 장중 차트 보기`}
              >
                <div className="dashboard-mover-head">
                  <div className="dashboard-mover-copy">
                    <div className="dashboard-kicker">TODAY&apos;S MOVE · 가장 큰 변동</div>
                    <div className="dashboard-mover-title">{mover.name}</div>
                    <span>관심종목 중 오늘의 변동 폭이 큰 종목이에요.</span>
                  </div>
                  <div className="dashboard-mover-price">
                    <span>현재가</span>
                    <strong>{formatPrice(livePrices[mover.ticker]?.price ?? mover.close)}<small>원</small></strong>
                    <em className={`price-${changeDirection(livePrices[mover.ticker]?.changeRate ?? mover.changeRate)}`}>
                      {changeArrow(livePrices[mover.ticker]?.changeRate ?? mover.changeRate)}{" "}
                      {Math.abs(livePrices[mover.ticker]?.changeRate ?? mover.changeRate ?? 0).toFixed(2)}%
                    </em>
                  </div>
                </div>
                <DashboardIntradayChart ticker={mover.ticker} stockName={mover.name} />
                <div className="dashboard-mover-foot"><span>장중 주가 흐름 · 실제 시세</span><span>종목 상세 보기 <b aria-hidden="true">→</b></span></div>
              </Link>
            ) : summaryLoading ? (
              <div className="skeleton" style={{ height: 62, borderRadius: 18, marginBottom: 18 }} />
            ) : null}

            <div className="dashboard-section-heading">
              <div><span>관심종목</span><small>내 종목의 시세와 오늘의 뉴스</small></div>
              <Link href="/watchlist/add">전체 {watchlist.length}개 →</Link>
            </div>
            <div className="dashboard-watchlist">
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
                  <div key={stock.ticker} className="dashboard-stock-row">
                    <Link
                      href={`/stock/${stock.ticker}?name=${encodeURIComponent(stock.name)}`}
                      style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, color: "inherit" }}
                    >
                      <div className="dashboard-stock-icon">{stock.name.slice(0, 1)}</div>
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

          <aside className="dashboard-aside">
            <div className="dashboard-summary-card">
              <div className="dashboard-kicker">MARKET SNAPSHOT</div>
              <h2>오늘의 요약</h2>
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
              <Link href="/watchlist/add" className="dashboard-add-stock">
                종목 더 담기
              </Link>
            </div>
          </aside>
        </div>
      )}

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
