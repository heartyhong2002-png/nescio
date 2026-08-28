"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CauseCardButton, CauseCardLink } from "@/components/CauseCard";
import CauseDetailView from "@/components/CauseDetailView";
import PriceChart from "@/components/PriceChart";
import { changeArrow, changeEmoji, changeDirection, formatMarketCap, formatMultiple, formatPercent, formatPrice } from "@/lib/format";
import type { Price, Stock, Valuation, ValuationInterpretation } from "@/lib/types";
import { useStockBriefing } from "@/lib/use-briefing";
import { useWatchlist } from "@/lib/storage";

const RANGES = ["1일", "1주", "1개월", "1년"];

function StockBriefingContent() {
  const params = useParams<{ ticker: string }>();
  const searchParams = useSearchParams();
  const ticker = params.ticker;
  const name = searchParams.get("name") ?? undefined;

  const { analysis, loading, error, refresh } = useStockBriefing(ticker, name);
  const { has, toggle } = useWatchlist();
  const [selectedCauseId, setSelectedCauseId] = useState<string | null>(null);
  const [range, setRange] = useState(0); // "1일"(분봉) 기본 선택

  const displayName = analysis?.stock.name ?? name ?? ticker;
  const causes = analysis?.briefing.causes ?? [];
  const selectedCause = causes.find((cause) => cause.id === selectedCauseId) ?? causes[0] ?? null;
  const inWatchlist = has(ticker);

  return (
    <main className="page desktop-briefing">
      <div className="container desktop-only" style={{ maxWidth: 1280, paddingTop: 20, paddingBottom: 40 }}>
        <DesktopHeader displayName={displayName} inWatchlist={inWatchlist} onToggle={() => toggle({ name: displayName, ticker, market: "KOSPI" })} />

        {loading && <div className="skeleton" style={{ height: 480, borderRadius: 20 }} />}
        {error && <div className="error-box">{error} <button className="btn-ghost" onClick={refresh}>다시 시도</button></div>}

        {analysis && !loading && (
          <div className="desktop-grid">
            <div className="desktop-col">
              <div className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
                관심종목
              </div>
              <PricePreview name={displayName} changeRate={analysis.price.changeRate} />
            </div>

            <div className="desktop-col">
              <StockHeader analysis={analysis} range={range} setRange={setRange} />
              <div className="section-title">가격이 움직인 이유</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
                {causes.map((cause) => (
                  <div key={cause.id} style={{ flex: 1, minWidth: 0 }}>
                    <CauseCardButton cause={cause} active={selectedCause?.id === cause.id} onClick={() => setSelectedCauseId(cause.id)} />
                  </div>
                ))}
              </div>
              <MetricsRow stock={analysis.stock} price={analysis.price} />
            </div>

            <div className="desktop-col desktop-side">
              {selectedCause ? <CauseDetailView analysis={analysis} cause={selectedCause} /> : <div className="muted">원인 데이터가 없어요.</div>}
            </div>
          </div>
        )}
      </div>

      <div className="container mobile-only" style={{ paddingTop: 18, paddingBottom: 40 }}>
        <div className="back-row">
          <Link href="/">← 홈</Link>
          <button className={inWatchlist ? undefined : "muted"} onClick={() => toggle({ name: displayName, ticker, market: "KOSPI" })}>
            {inWatchlist ? "★ 담김" : "☆ 담기"}
          </button>
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="skeleton" style={{ height: 60 }} />
            <div className="skeleton" style={{ height: 130, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 200 }} />
          </div>
        )}

        {error && (
          <div className="error-box">
            {error} <button className="btn-ghost" onClick={refresh}>다시 시도</button>
          </div>
        )}

        {analysis && !loading && (
          <>
            <StockHeader analysis={analysis} range={range} setRange={setRange} />

            <div className="section-title">가격이 움직인 이유</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {causes.length === 0 && <div className="muted" style={{ fontSize: 13 }}>뚜렷한 원인을 찾지 못했어요.</div>}
              {causes.map((cause) => (
                <CauseCardLink key={cause.id} cause={cause} href={`/stock/${ticker}/cause/${cause.id}?name=${encodeURIComponent(displayName)}`} />
              ))}
            </div>

            <MetricsRow stock={analysis.stock} price={analysis.price} />

            {analysis.briefing.aiComment && (
              <div className="placeholder-box" style={{ textAlign: "left", padding: 14, marginTop: 4 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  AI가 정리해줬어요
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>{analysis.briefing.aiComment}</div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function DesktopHeader({ displayName, inWatchlist, onToggle }: { displayName: string; inWatchlist: boolean; onToggle: () => void }) {
  return (
    <div className="back-row" style={{ marginBottom: 8 }}>
      <Link href="/">← 홈</Link>
      <div style={{ fontWeight: 600, color: "var(--ink)" }}>{displayName}</div>
      <button onClick={onToggle}>{inWatchlist ? "★ 담김" : "☆ 담기"}</button>
    </div>
  );
}

function PricePreview({ name, changeRate }: { name: string; changeRate: number | null }) {
  const direction = changeDirection(changeRate);
  return (
    <div className="card-outline" style={{ border: "1px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>{name}</span>
        <span className={`price-${direction}`}>
          {changeArrow(changeRate)}
          {changeRate !== null ? `${Math.abs(changeRate).toFixed(1)}%` : ""}
          {changeEmoji(changeRate)}
        </span>
      </div>
    </div>
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
  const direction = changeDirection(analysis.price.changeRate);
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <div className="title-md">{analysis.stock.name}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatPrice(analysis.price.close)}</div>
          <div className={`price-${direction}`} style={{ fontSize: 13 }}>
            {changeArrow(analysis.price.changeRate)}
            {analysis.price.changeRate !== null ? `${Math.abs(analysis.price.changeRate).toFixed(2)}%` : " 데이터 없음"}
            {changeEmoji(analysis.price.changeRate)}
          </div>
        </div>
      </div>

      <PriceChart key={`${analysis.stock.ticker}-${RANGES[range]}`} ticker={analysis.stock.ticker} range={RANGES[range]} />
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {RANGES.map((label, index) => (
          <button
            key={label}
            className="pill"
            style={{ borderColor: index === range ? "var(--accent)" : "var(--line)", color: index === range ? "var(--accent)" : "var(--muted)" }}
            onClick={() => setRange(index)}
          >
            {label}
          </button>
        ))}
      </div>

      {analysis.briefing.oneLiner && (
        <div style={{ borderLeft: "3px solid var(--accent)", padding: "2px 0 2px 12px", marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 5 }}>
            오늘 한 줄
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.55 }}>{analysis.briefing.oneLiner}</div>
        </div>
      )}
    </>
  );
}

function useValuation(ticker: string) {
  const [valuation, setValuation] = useState<Valuation | null>(null);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    fetch(`/api/valuation?ticker=${encodeURIComponent(ticker)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!cancelled && response.ok) setValuation(data.valuation);
      })
      .catch(() => {
        /* 지표는 부가 정보라 실패해도 조용히 대시(—) 유지 */
      });
    return () => {
      cancelled = true;
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

function MetricsRow({ stock, price }: { stock: Stock; price: Price }) {
  const valuation = useValuation(stock.ticker);
  const { interpretation, loading } = useValuationInterpretation(stock, price, valuation);

  const metrics = [
    { key: "per" as const, label: "PER", value: formatMultiple(valuation?.per ?? null) },
    { key: "pbr" as const, label: "PBR", value: formatMultiple(valuation?.pbr ?? null) },
    { key: "dividend" as const, label: "배당", value: formatPercent(valuation?.dividendYield ?? null) },
    { key: "marketCap" as const, label: "시가총액", value: formatMarketCap(valuation?.marketCap ?? price.marketCap) },
  ];

  return (
    <>
      <div className="section-title">회사 숫자로 보기</div>
      <div style={{ display: "flex", gap: 8, marginBottom: interpretation ? 12 : 20 }}>
        {metrics.map(({ label, value }) => (
          <div key={label} className="card-outline" style={{ flex: 1, padding: 11 }}>
            <div className="muted" style={{ fontSize: 10 }}>
              {label}
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      {loading && !interpretation && (
        <div className="muted" style={{ fontSize: 11, marginBottom: 20 }}>
          이 숫자들 쉽게 풀어보는 중…
        </div>
      )}

      {interpretation && (
        <div className="placeholder-box" style={{ textAlign: "left", padding: 14, marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            이 숫자, 쉽게 풀면
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {metrics.map(({ key, label }) => {
              const note = interpretation[key];
              if (!note?.meaning) return null;
              return (
                <div key={key}>
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <b>{label}</b> · {note.meaning}
                  </div>
                  {note.interpretation && (
                    <div className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 2 }}>
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
