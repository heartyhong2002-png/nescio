"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import type { MarketIndex } from "@/lib/types";

const QUICK_STOCKS = [
  { name: "삼성전자", ticker: "005930" },
  { name: "SK하이닉스", ticker: "000660" },
  { name: "현대차", ticker: "005380" },
  { name: "NAVER", ticker: "035420" },
];

export default function FamilyHomePage() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [indices, setIndices] = useState<MarketIndex[]>([]);

  useEffect(() => {
    fetch("/api/market-indices?phase=indices")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setIndices(data?.indices ?? []))
      .catch(() => setIndices([]));
  }, []);

  function openStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase();
    if (!/^[0-9A-Z]{6}$/.test(normalized)) return;
    router.push(`/family/stock/${normalized}`);
  }

  return (
    <main className="family-page">
      <header className="family-header">
        <Link href="/family" className="family-brand">Nescio <span>가족용</span></Link>
        <Link href="/" className="family-original-link">일반 화면</Link>
      </header>

      <section className="family-hero">
        <p className="family-kicker">오늘의 시장 정보</p>
        <h1>차분하게, 필요한 정보만<br />살펴보세요.</h1>
        <p>시세와 시장 흐름을 쉽게 보여드려요. 하루의 등락만으로 성급하게 판단할 필요는 없습니다.</p>
      </section>

      <section className="family-section" aria-labelledby="family-market-title">
        <div className="family-section-heading">
          <div>
            <h2 id="family-market-title">시장 흐름</h2>
            <p>국내 대표 지수의 현재 흐름입니다.</p>
          </div>
        </div>
        <div className="family-index-grid">
          {indices.length > 0 ? indices.map((index) => {
            const direction = index.changeRate === null || index.changeRate === 0 ? "flat" : index.changeRate > 0 ? "up" : "down";
            return (
              <article className="family-index-card" key={index.name}>
                <span>{index.name}</span>
                <strong>{formatPrice(index.close)}</strong>
                <em className={`family-${direction}`}>
                  {index.changeRate === null ? "변동 정보 없음" : `${index.changeRate > 0 ? "+" : ""}${index.changeRate.toFixed(2)}%`}
                </em>
              </article>
            );
          }) : (
            <div className="family-empty">시장 정보를 불러오는 중입니다.</div>
          )}
        </div>
      </section>

      <section className="family-section" aria-labelledby="family-stock-title">
        <div className="family-section-heading">
          <div>
            <h2 id="family-stock-title">종목 살펴보기</h2>
            <p>자주 보는 종목을 선택하거나 종목코드 6자리를 입력하세요.</p>
          </div>
        </div>
        <div className="family-stock-actions">
          {QUICK_STOCKS.map((stock) => (
            <Link className="family-stock-chip" key={stock.ticker} href={`/family/stock/${stock.ticker}?name=${encodeURIComponent(stock.name)}`}>
              <span>{stock.name}</span><small>{stock.ticker}</small>
            </Link>
          ))}
        </div>
        <form className="family-search" onSubmit={openStock}>
          <label htmlFor="family-ticker">종목코드</label>
          <input id="family-ticker" inputMode="numeric" maxLength={6} onChange={(event) => setTicker(event.target.value)} placeholder="예: 005930" value={ticker} />
          <button type="submit">확인</button>
        </form>
      </section>

      <aside className="family-guidance">
        <strong>천천히 확인하세요</strong>
        <p>이 화면은 정보를 이해하는 데 도움을 드리기 위한 것이며, 매수·매도 판단을 대신하지 않습니다.</p>
      </aside>
    </main>
  );
}
