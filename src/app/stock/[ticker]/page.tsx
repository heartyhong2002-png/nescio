"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CauseCardButton, CauseCardLink } from "@/components/CauseCard";
import CauseDetailView from "@/components/CauseDetailView";
import { changeArrow, changeEmoji, changeDirection, formatMarketCap, formatPrice } from "@/lib/format";
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
  const [range, setRange] = useState(0);

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
                  <div key={cause.id} style={{ flex: 1 }}>
                    <CauseCardButton cause={cause} active={selectedCause?.id === cause.id} onClick={() => setSelectedCauseId(cause.id)} />
                  </div>
                ))}
              </div>
              <MetricsRow marketCap={analysis.price.marketCap} />
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

            <MetricsRow marketCap={analysis.price.marketCap} />

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

      <div className="placeholder-box" style={{ height: 150, marginBottom: 10 }}>가격 차트</div>
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

function MetricsRow({ marketCap }: { marketCap: number | null }) {
  const metrics = [
    { label: "PER", value: "—" },
    { label: "PBR", value: "—" },
    { label: "배당", value: "—" },
    { label: "시가총액", value: formatMarketCap(marketCap) },
  ];
  return (
    <>
      <div className="section-title">회사 숫자로 보기</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {metrics.map(({ label, value }) => (
          <div key={label} className="card-outline" style={{ flex: 1, padding: 11 }}>
            <div className="muted" style={{ fontSize: 10 }}>
              {label}
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>
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
