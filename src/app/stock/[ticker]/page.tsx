"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { CauseCardButton } from "@/components/CauseCard";
import CauseDetailView from "@/components/CauseDetailView";
import { LoadingBriefing } from "@/components/LoadingBriefing";
import PriceChart from "@/components/PriceChart";
import {
  changeArrow,
  changeEmoji,
  changeDirection,
  formatMarketCap,
  formatMultiple,
  formatPercent,
  formatPrice,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import type { Price, Stock, Valuation, ValuationInterpretation } from "@/lib/types";
import { useStockBriefing } from "@/lib/use-briefing";
import { useWatchlist } from "@/lib/storage";

function StockBriefingContent() {
  const params = useParams<{ ticker: string }>();
  const searchParams = useSearchParams();
  const ticker = params.ticker;
  const name = searchParams.get("name") ?? undefined;
  const { t } = useI18n();

  const { analysis, loading, loadingMessage, error, refresh } = useStockBriefing(ticker, name);
  const { has, toggle } = useWatchlist();
  const [selectedCauseId, setSelectedCauseId] = useState<string | null>(null);
  const [range, setRange] = useState(0);

  const displayName = analysis?.stock.name ?? name ?? ticker;
  const causes = analysis?.briefing.causes ?? [];
  const selectedCause = causes.find((cause) => cause.id === selectedCauseId) ?? causes[0] ?? null;
  const inWatchlist = has(ticker);

  return (
    <AppShell>
      <div className="back-row">
        <Link href="/">{t.stock.backToList}</Link>
        <button
          className={inWatchlist ? undefined : "muted"}
          onClick={() => toggle({ name: displayName, ticker, market: "KOSPI" })}
        >
          {inWatchlist ? t.stock.inWatchlist : t.stock.addToWatchlist}
        </button>
      </div>

      {loading && <LoadingBriefing message={loadingMessage} height={480} />}

      {error && (
        <div className="error-box">
          {error}{" "}
          <button className="btn-ghost" onClick={refresh}>
            {t.stock.retry}
          </button>
        </div>
      )}

      {analysis && !loading && (
        <div className="stock-layout">
          <div>
            <StockHeader analysis={analysis} range={range} setRange={setRange} />

            <div className="section-title">{t.stock.whyMoved}</div>
            {causes.length === 0 ? (
              <div className="note-box" style={{ marginBottom: 24 }}>
                {t.stock.noClearCause}
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

            <MetricsRow ticker={ticker} stock={analysis.stock} price={analysis.price} />

            {analysis.briefing.aiComment && (
              <div className="note-box" style={{ marginTop: 8 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  {t.stock.aiSummary}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                  {analysis.briefing.aiComment}
                </div>
              </div>
            )}
          </div>

          <aside className="stock-aside">
            {selectedCause ? (
              <CauseDetailView analysis={analysis} cause={selectedCause} />
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                {t.stock.noCauseData}
              </div>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function StockHeader({
  analysis,
  range,
  setRange,
}: {
  analysis: NonNullable<ReturnType<typeof useStockBriefing>["analysis"]>;
  range: number;
  setRange: (index: number) => void;
}) {
  const { t } = useI18n();
  // PriceChart/`/api/price-history`는 range 파라미터로 정확한 한글 canonical 값을
  // 기대하므로(rangeKeys), 버튼에 보여줄 라벨(ranges)과 실제 전달값을 분리해서 쓴다.
  const rangeKeys = t.stock.rangeKeys;
  const rangeLabels = t.stock.ranges;
  const direction = changeDirection(analysis.price.changeRate);
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div className="page-title">{analysis.stock.name}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {formatPrice(analysis.price.close)}
          </div>
          <div className={`price-${direction}`} style={{ fontSize: 14, fontWeight: 600 }}>
            {changeArrow(analysis.price.changeRate)}
            {analysis.price.changeRate !== null
              ? ` ${Math.abs(analysis.price.changeRate).toFixed(2)}%`
              : ` ${t.stock.noPriceData}`}
            {changeEmoji(analysis.price.changeRate)}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <PriceChart key={`${analysis.stock.ticker}-${rangeKeys[range]}`} ticker={analysis.stock.ticker} range={rangeKeys[range]} />
        <div className="range-tabs" style={{ marginTop: 4 }}>
          {rangeLabels.map((label, index) => (
            <button key={rangeKeys[index]} className={index === range ? "active" : undefined} onClick={() => setRange(index)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {analysis.briefing.oneLiner && (
        <div style={{ borderLeft: "3px solid var(--accent)", padding: "4px 0 4px 14px", margin: "18px 0 24px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {t.stock.todayOneLiner}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>{analysis.briefing.oneLiner}</div>
        </div>
      )}
    </>
  );
}

// 종목 페이지가 열리면 차트(/api/price-history)가 KIS 분봉을 4번 호출하고, 그 뒤로
// /api/valuation이 붙는다. KIS는 appkey 단위 레이트리밋이 빡빡해서 이 순간 valuation이
// EGW00201로 밀리면 예전엔 조용히 실패하고 PER/PBR/배당이 영영 "—"로 남았다.
// PriceChart와 같은 방식으로 몇 번 더 시도하고, 그래도 안 되면 눈에 보이는 재시도 버튼을 준다.
const VALUATION_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000];

function useValuation(ticker: string) {
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const load = async (attempt: number) => {
      if (attempt === 0) setFailed(false);
      try {
        const response = await fetch(`/api/valuation?ticker=${encodeURIComponent(ticker)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "재무 지표를 불러오지 못했습니다.");
        if (cancelled) return;
        setValuation(data.valuation);
      } catch {
        if (cancelled) return;
        if (attempt < VALUATION_RETRY_DELAYS_MS.length) {
          timers.push(setTimeout(() => load(attempt + 1), VALUATION_RETRY_DELAYS_MS[attempt]));
          return;
        }
        setFailed(true);
      }
    };

    load(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [ticker, reloadKey]);

  return { valuation, failed, retry: () => setReloadKey((key) => key + 1) };
}

// 지표 숫자가 들어오면 초보자용 한 줄 해설을 한 번 받아온다. 실패해도 조용히 숨긴다.
function useValuationInterpretation(stock: Stock, price: Price, valuation: Valuation | null) {
  const { lang } = useLanguage();
  const [interpretation, setInterpretation] = useState<ValuationInterpretation | null>(null);
  const [settled, setSettled] = useState(false);

  const marketCap = valuation?.marketCap ?? price.marketCap;
  const ready =
    valuation !== null &&
    (valuation.per !== null || valuation.pbr !== null || valuation.dividendYield !== null || marketCap !== null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setSettled(false);
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
        lang,
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
    // valuation 객체가 새로 만들어질 때마다(=지표 로드 완료) 또는 언어가 바뀔 때 한 번씩 돌면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stock.ticker, lang]);

  return { interpretation, loading: ready && !settled };
}

function MetricsRow({ ticker, stock, price }: { ticker: string; stock: Stock; price: Price }) {
  const { t } = useI18n();
  // URL의 ticker를 쓴다 — 세션에 캐시된 옛 분석 객체엔 stock.ticker가 없을 수도 있다.
  const { valuation, failed, retry } = useValuation(stock.ticker || ticker);
  const { interpretation, loading } = useValuationInterpretation(stock, price, valuation);

  const metrics = [
    { key: "per" as const, label: t.stock.per, value: formatMultiple(valuation?.per ?? null) },
    { key: "pbr" as const, label: t.stock.pbr, value: formatMultiple(valuation?.pbr ?? null) },
    { key: "dividend" as const, label: t.stock.dividendYield, value: formatPercent(valuation?.dividendYield ?? null) },
    { key: "marketCap" as const, label: t.stock.marketCap, value: formatMarketCap(valuation?.marketCap ?? price.marketCap) },
  ];

  return (
    <>
      <div className="section-title">{t.stock.metricsTitle}</div>
      <div className="grid-cards cols-4" style={{ gap: 10, marginBottom: interpretation ? 14 : 24 }}>
        {metrics.map(({ label, value }) => (
          <div key={label} className="metric-tile">
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>

      {failed && !valuation && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 24 }}>
          {t.stock.metricsFailed}{" "}
          <button className="btn-ghost" onClick={retry}>
            {t.stock.retry}
          </button>
        </div>
      )}

      {loading && !interpretation && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 24 }}>
          {t.stock.metricsLoading}
        </div>
      )}

      {interpretation && (
        <div className="note-box" style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t.stock.metricsInterpretedTitle}
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
}

export default function StockBriefingPage() {
  return (
    <Suspense fallback={null}>
      <StockBriefingContent />
    </Suspense>
  );
}
