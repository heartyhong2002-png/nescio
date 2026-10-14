"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatMarketCap, formatPrice } from "@/lib/format";
import type { PricePoint } from "@/components/PriceChart";
import { useStockSummary } from "@/lib/use-summary";

function familyNote(name: string, changeRate: number | null) {
  if (changeRate === null) return `${name}의 오늘 시세를 확인하고 있습니다. 잠시 뒤 다시 살펴봐 주세요.`;
  if (Math.abs(changeRate) < 0.1) return `${name}은(는) 전일과 큰 차이 없이 움직이고 있습니다. 장기적인 흐름도 함께 살펴보세요.`;
  const direction = changeRate > 0 ? "올랐" : "내렸";
  return `${name}은(는) 전일 대비 ${Math.abs(changeRate).toFixed(2)}% ${direction}습니다. 하루의 움직임보다 여러 날의 흐름을 함께 보는 것이 좋습니다.`;
}

function FamilyTrend({ ticker }: { ticker: string }) {
  const [points, setPoints] = useState<PricePoint[]>([]);

  useEffect(() => {
    fetch(`/api/price-history?ticker=${encodeURIComponent(ticker)}&range=1개월`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setPoints(data?.points ?? []))
      .catch(() => setPoints([]));
  }, [ticker]);

  const path = useMemo(() => {
    if (points.length < 2) return "";
    const closes = points.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = Math.max(max - min, 1);
    return points.map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 84 - ((point.close - min) / range) * 68;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }, [points]);

  return (
    <section className="family-trend-card">
      <div><h2>최근 한 달 흐름</h2><p>종가 기준으로 간단히 표시합니다.</p></div>
      {path ? (
        <svg aria-label="최근 한 달 주가 흐름" className="family-trend" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="family-trend-grid" d="M0 20H100M0 50H100M0 80H100" />
          <path className="family-trend-line" d={path} />
        </svg>
      ) : <div className="family-empty">차트 정보를 준비하고 있습니다.</div>}
    </section>
  );
}

export default function FamilyStockPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const searchParams = useSearchParams();
  const initialName = searchParams.get("name") ?? undefined;
  const { summary, loading, error } = useStockSummary(ticker, initialName);

  if (loading) return <main className="family-page"><div className="family-loading">종목 정보를 불러오는 중입니다.</div></main>;
  if (error || !summary) return <main className="family-page"><Link href="/family">← 가족용 화면으로 돌아가기</Link><div className="family-empty">{error || "종목 정보를 찾지 못했습니다."}</div></main>;

  const { stock, price } = summary;
  const direction = price.changeRate === null || price.changeRate === 0 ? "flat" : price.changeRate > 0 ? "up" : "down";

  return (
    <main className="family-page">
      <header className="family-header"><Link href="/family" className="family-back">← 가족용 화면</Link><Link href={`/stock/${ticker}?name=${encodeURIComponent(stock.name)}`} className="family-original-link">자세한 분석 보기</Link></header>
      <section className="family-stock-hero">
        <p className="family-kicker">종목 정보</p>
        <h1>{stock.name}</h1>
        <span>{stock.ticker} · {stock.market}</span>
        <strong>{formatPrice(price.close)}원</strong>
        <em className={`family-${direction}`}>{price.changeRate === null ? "변동 정보 없음" : `전일 대비 ${price.changeRate > 0 ? "+" : ""}${price.changeRate.toFixed(2)}%`}</em>
      </section>

      <section className="family-note"><h2>오늘의 안내</h2><p>{familyNote(stock.name, price.changeRate)}</p></section>
      <FamilyTrend ticker={ticker} />

      <section className="family-section">
        <div className="family-section-heading"><div><h2>기본 정보</h2><p>숫자의 뜻을 간단히 확인하세요.</p></div></div>
        <div className="family-metric-grid">
          <div><span>현재가</span><strong>{formatPrice(price.close)}원</strong></div>
          <div><span>오늘 변동</span><strong className={`family-${direction}`}>{price.changeRate === null ? "—" : `${price.changeRate > 0 ? "+" : ""}${price.changeRate.toFixed(2)}%`}</strong></div>
          <div><span>시가총액</span><strong>{formatMarketCap(price.marketCap)}</strong></div>
        </div>
      </section>
      <aside className="family-guidance"><strong>기억해 두세요</strong><p>주식 가격은 매일 오르내릴 수 있어요. 한 가지 숫자만 보기보다 회사와 시장의 장기 흐름을 함께 확인해 보세요.</p></aside>
    </main>
  );
}
