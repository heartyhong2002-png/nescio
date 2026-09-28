"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { memo, Suspense, useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import BriefingErrorState from "@/components/BriefingErrorState";
import { CauseCardButton } from "@/components/CauseCard";
import CauseDetailView from "@/components/CauseDetailView";
import PriceChart from "@/components/PriceChart";
import { StockConsensusCard } from "@/components/StockConsensusCard";
import {
  changeArrow,
  changeEmoji,
  changeDirection,
  formatMarketCap,
  formatMultiple,
  formatPercent,
  formatPrice,
} from "@/lib/format";
import type { Price, Stock, Valuation, ValuationInterpretation } from "@/lib/types";
import { useStockBriefing } from "@/lib/use-briefing";
import { useStockSummary } from "@/lib/use-summary";
import { useWatchlist } from "@/lib/storage";

const RANGES = ["1일", "1주", "1개월", "1년"];

function StockBriefingContent() {
  const params = useParams<{ ticker: string }>();
  const searchParams = useSearchParams();
  const ticker = params.ticker;
  const name = searchParams.get("name") ?? undefined;

  // 시세/차트/재무지표는 빠른 경로(summary)로 먼저 그리고,
  // AI 브리핑(원인 분석·쩐형 코멘트)은 느린 경로(briefing)로 따로 불러와 해당 영역만 갱신한다.
  const { summary, loading: summaryLoading, error: summaryError } = useStockSummary(ticker, name);
  const { analysis, loading: briefingLoading, loadingMessage, error: briefingError, refresh } = useStockBriefing(
    ticker,
    name,
  );
  const { has, toggle, loading: watchlistLoading } = useWatchlist();
  const [selectedCauseId, setSelectedCauseId] = useState<string | null>(null);
  const [range, setRange] = useState(0);
  const handleRangeChange = useCallback((newRange: string) => {
    const index = RANGES.indexOf(newRange);
    if (index >= 0) setRange(index);
  }, []);

  const displayName = summary?.stock.name ?? analysis?.stock.name ?? name ?? ticker;
  const causes = analysis?.briefing.causes ?? [];
  const selectedCause = causes.find((cause) => cause.id === selectedCauseId) ?? causes[0] ?? null;
  const inWatchlist = has(ticker);

  return (
    <AppShell variant="intelligence">
      <div className="stock-intelligence">
      <div className="back-row stock-back-row">
        <Link href="/">← 브리핑 목록</Link>
        <button
          className={inWatchlist ? undefined : "muted"}
          disabled={watchlistLoading}
          onClick={() => toggle({ name: displayName, ticker, market: "KOSPI" })}
        >
          {watchlistLoading ? "관심종목 확인 중…" : inWatchlist ? "★ 관심종목에 담김" : "☆ 관심종목 담기"}
        </button>
      </div>

      {summaryLoading && (
        <div className="stock-loading-layout">
          <div className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 430, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        </div>
      )}

      {summaryError && (
        <div className="error-box">{summaryError}</div>
      )}

      {summary && !summaryLoading && (
        <div className="stock-layout">
          <div className="stock-main-column">
            <StockHeader stock={summary.stock} price={summary.price} oneLiner={analysis?.briefing.oneLiner} range={range} onRangeChange={handleRangeChange} />

            <div className="stock-section-heading">
              <span>오늘의 변동 요인</span>
              <small>뉴스와 시세를 바탕으로 정리했어요</small>
            </div>
            {briefingLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  {loadingMessage}
                </div>
                <div className="skeleton" style={{ height: 96, borderRadius: 14 }} />
              </div>
            ) : briefingError ? (
              <BriefingErrorState onRetry={refresh} />
            ) : causes.length === 0 ? (
              <div className="note-box" style={{ marginBottom: 24 }}>
                뚜렷한 원인을 찾지 못했어요.
              </div>
            ) : (
              <div className="cause-picker" style={{ marginBottom: 26 }}>
                {causes.map((cause) => (
                  <CauseCardButton
                    key={cause.id}
                    cause={cause}
                    active={selectedCause?.id === cause.id}
                    onClick={() => setSelectedCauseId(cause.id)}
                  />
                ))}
              </div>
            )}

            <MetricsRow stock={summary.stock} price={summary.price} />

            {briefingLoading && (
              <div className="note-box" style={{ marginTop: 8 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  AI가 정리하는 중
                </div>
                <div className="skeleton" style={{ height: 48, borderRadius: 10 }} />
              </div>
            )}

            {analysis?.briefing.aiComment && (
              <div className="note-box" style={{ marginTop: 8 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  AI가 정리해줬어요
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                  {analysis.briefing.aiComment}
                </div>
              </div>
            )}

            {/* 전문가 컨센서스 (비동기 로딩) */}
            <StockConsensusCard ticker={ticker} />
          </div>

          <aside className="stock-aside">
            {selectedCause && analysis ? (
              <CauseDetailView analysis={analysis} cause={selectedCause} />
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                {briefingLoading ? "원인 분석하는 중…" : "원인 데이터가 없어요."}
              </div>
            )}
          </aside>
        </div>
      )}
      </div>
    </AppShell>
  );
}

const StockHeader = memo(function StockHeader({
  stock,
  price,
  oneLiner,
  range,
  onRangeChange,
}: {
  stock: Stock;
  price: Price;
  oneLiner?: string;
  range: number;
  onRangeChange: (range: string) => void;
}) {
  const direction = changeDirection(price.changeRate);
  return (
    <>
      <section className="stock-price-hero">
        <div className="stock-identity">
          <div className="eyebrow">STOCK ANALYSIS · {stock.ticker}</div>
          <div className="stock-name-row">
            <h1>{stock.name}</h1>
            <span>국내 주식</span>
          </div>
          <div className="stock-price-row">
            <strong>{formatPrice(price.close)}원</strong>
            <span className={`price-${direction}`}>
              {changeArrow(price.changeRate)}
              {price.changeRate !== null ? ` ${Math.abs(price.changeRate).toFixed(2)}%` : " 데이터 없음"}
              {changeEmoji(price.changeRate)}
            </span>
          </div>
        </div>
        <div className="stock-hero-note">실시간 시세와 차트를 먼저 확인한 뒤, 아래에서 움직인 이유를 살펴보세요.</div>
      </section>

      <div className="stock-chart-shell">
        <div className="stock-chart-heading"><span>주가와 거래량 흐름</span><small>실제 시세로 가격·거래량·이동평균을 비교해요</small></div>
        <PriceChart
          key={`${stock.ticker}-${RANGES[range]}`}
          ticker={stock.ticker}
          range={RANGES[range]}
          onRangeChange={onRangeChange}
          height={400}
        />
      </div>

      {oneLiner && (
        <div className="stock-oneliner">
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            오늘 한 줄
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>{oneLiner}</div>
        </div>
      )}
    </>
  );
});

// KIS 레이트리밋(특히 서버리스에서 라우트별로 토큰 캐시가 안 겹치는 문제)은 대부분 몇 초 안에
// 풀린다. PriceChart와 동일한 패턴으로, retryable 신호를 받으면 바로 포기하지 않고 잠깐 뒤 다시 부른다.
const VALUATION_MAX_RETRIES = 4;
const VALUATION_RETRY_DELAYS_MS = [1200, 2500, 4500, 7000];

function useValuation(ticker: string) {
  const [valuation, setValuation] = useState<Valuation | null>(null);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const load = async (attempt: number) => {
      try {
        const response = await fetch(`/api/valuation?ticker=${encodeURIComponent(ticker)}`);
        const data = await response.json();
        if (cancelled) return;

        if (data.retryable && !data.valuation && attempt < VALUATION_MAX_RETRIES) {
          timers.push(setTimeout(() => load(attempt + 1), VALUATION_RETRY_DELAYS_MS[attempt] ?? 7000));
          return;
        }
        if (response.ok) setValuation(data.valuation);
      } catch {
        /* 지표는 부가 정보라 실패해도 조용히 대시(—) 유지 */
      }
    };

    load(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [ticker]);

  return valuation;
}

// 지표 숫자가 들어오면 초보자용 한 줄 해설을 한 번 받아온다. 실패해도 조용히 숨긴다.
function useValuationInterpretation(stock: Stock, price: Price, valuation: Valuation | null) {
  const [interpretation, setInterpretation] = useState<ValuationInterpretation | null>(null);
  const [settled, setSettled] = useState(false);

  const marketCap = valuation?.marketCap ?? price.marketCap;
  const ready =
    valuation !== null &&
    (valuation.per !== null || valuation.pbr !== null || valuation.dividendYield !== null || marketCap !== null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/valuation/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stock: { name: stock.name, ticker: stock.ticker },
        metrics: {
          per: valuation?.per ?? null,
          pbr: valuation?.pbr ?? null,
          dividend: valuation?.dividendYield ?? null,
          marketCap,
        },
        currentPrice: { close: price.close, changeRate: price.changeRate },
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!cancelled && response.ok) setInterpretation(data.interpretation);
      })
      .catch(() => {
        /* 해설은 부가 정보라 실패해도 조용히 카드만 보여준다 */
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });
    return () => {
      cancelled = true;
    };
    // valuation 객체가 새로 만들어질 때마다(=지표 로드 완료) 한 번만 돌면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stock.ticker]);

  return { interpretation, loading: ready && !settled };
}

const MetricsRow = memo(function MetricsRow({ stock, price }: { stock: Stock; price: Price }) {
  const valuation = useValuation(stock.ticker);
  const { interpretation, loading } = useValuationInterpretation(stock, price, valuation);

  const metrics = [
    { key: "per" as const, label: "PER", value: formatMultiple(valuation?.per ?? null) },
    { key: "pbr" as const, label: "PBR", value: formatMultiple(valuation?.pbr ?? null) },
    { key: "dividend" as const, label: "배당수익률", value: formatPercent(valuation?.dividendYield ?? null) },
    { key: "marketCap" as const, label: "시가총액", value: formatMarketCap(valuation?.marketCap ?? price.marketCap) },
  ];

  return (
    <>
      <div className="stock-section-heading">
        <span>핵심 지표</span>
        <small>회사 규모와 밸류에이션을 한눈에</small>
      </div>
      <div className="grid-cards cols-4" style={{ gap: 10, marginBottom: interpretation ? 14 : 24 }}>
        {metrics.map(({ label, value }) => (
          <div key={label} className="metric-tile">
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>

      {loading && !interpretation && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 24 }}>
          이 숫자들 쉽게 풀어보는 중…
        </div>
      )}

      {interpretation && (
        <div className="note-box" style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            이 숫자, 쉽게 풀면
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {metrics.map(({ key, label }) => {
              const note = interpretation[key];
              if (!note?.meaning) return null;
              return (
                <div key={key}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.65 }}>
                    <b>{label}</b> · {note.meaning}
                  </div>
                  {note.interpretation && (
                    <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.65, marginTop: 3 }}>
                      {note.interpretation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
});

export default function StockBriefingPage() {
  return (
    <Suspense fallback={null}>
      <StockBriefingContent />
    </Suspense>
  );
}
