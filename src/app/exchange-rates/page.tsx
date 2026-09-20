"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { formatPrice } from "@/lib/format";
import { ExchangeRate } from "@/lib/types";
import { MacroIndicator } from "@/lib/macro-data";
import { MAJOR_CURRENCY_CODES_CLIENT } from "@/lib/exchange-rate-constants";

function useMacroData() {
  const [data, setData] = useState<{
    rates: ExchangeRate[];
    indicators: MacroIndicator[];
    briefing: string | null;
    date: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/macro")
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "매크로 정보를 불러오지 못했습니다.");
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "매크로 정보를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading: !data && !error };
}

function formatDate(basDd: string) {
  if (basDd?.length !== 8) return "";
  return `${basDd.slice(0, 4)}.${basDd.slice(4, 6)}.${basDd.slice(6, 8)} 매매기준율`;
}

function IndicatorCard({ indicator }: { indicator: MacroIndicator }) {
  const isUp = indicator.changePercent && indicator.changePercent > 0;
  const isDown = indicator.changePercent && indicator.changePercent < 0;
  const color = isUp ? "var(--up)" : isDown ? "var(--down)" : "inherit";
  const sign = isUp ? "+" : "";

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
        {indicator.name}
      </div>
      <div className="muted" style={{ fontSize: 11 }}>
        {indicator.ticker}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>
        {indicator.price !== null ? (indicator.price < 10 ? indicator.price.toFixed(3) : indicator.price.toLocaleString(undefined, { maximumFractionDigits: 2 })) : "N/A"}
      </div>
      {indicator.changePercent !== null && (
        <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 4 }}>
          {sign}{indicator.changePercent.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

export default function MacroPage() {
  const { data, error, loading } = useMacroData();
  const [query, setQuery] = useState("");

  const majors = useMemo(() => {
    if (!data?.rates) return [];
    const seen = new Set<string>();
    return MAJOR_CURRENCY_CODES_CLIENT.map((code) => data.rates.find((rate) => rate.code === code)).filter(
      (rate): rate is ExchangeRate => {
        if (!rate || seen.has(rate.code)) return false;
        seen.add(rate.code);
        return true;
      },
    );
  }, [data?.rates]);

  const filteredRates = useMemo(() => {
    if (!data?.rates) return [];
    const trimmed = query.trim();
    if (!trimmed) return data.rates;
    return data.rates.filter((rate) => rate.name.includes(trimmed) || rate.code.includes(trimmed.toUpperCase()));
  }, [data?.rates, query]);

  return (
    <AppShell narrow>
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="page-title">글로벌 매크로</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            원자재, 지수, 국채 및 환율 동향
          </p>
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="skeleton" style={{ height: 100, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
        </div>
      )}

      {!loading && data && (
        <>
          {data.briefing && (
            <div className="card" style={{ padding: 16, marginBottom: 24, backgroundColor: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🤖</span> AI 시장 코멘트
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, wordBreak: "keep-all" }}>
                {data.briefing}
              </div>
            </div>
          )}

          {data.indicators && data.indicators.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                핵심 지표
              </div>
              <div className="grid-cards cols-2" style={{ marginBottom: 32 }}>
                {data.indicators.map((ind) => (
                  <IndicatorCard key={ind.ticker} indicator={ind} />
                ))}
              </div>
            </>
          )}

          <div className="eyebrow" style={{ marginBottom: 12 }}>
            주요 환율
          </div>
          {majors.length > 0 && (
            <div className="grid-cards cols-2" style={{ marginBottom: 26 }}>
              {majors.map((rate) => (
                <div key={rate.code} className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                    {rate.code}
                    {rate.unit > 1 ? `(${rate.unit})` : ""}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {rate.name}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{formatPrice(rate.rate)}원</div>
                </div>
              ))}
            </div>
          )}

          <div className="search-field" style={{ marginBottom: 16 }}>
            🔍
            <input
              placeholder="통화명 · 통화코드 검색 (예: 달러, USD)"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button className="btn-ghost" onClick={() => setQuery("")}>
                취소
              </button>
            )}
          </div>

          <div className="eyebrow" style={{ marginBottom: 12 }}>
            전체 환율 <span className="muted">{filteredRates.length}</span>
          </div>

          {filteredRates.length === 0 ? (
            <div className="placeholder-box" style={{ padding: 20 }}>
              찾는 통화가 없어요.
            </div>
          ) : (
            <div className="list-panel">
              {filteredRates.map((rate) => (
                <div key={rate.code} className="list-row">
                  <div className="stock-icon">{rate.code.slice(0, 1)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{rate.name}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                      {rate.code}
                      {rate.unit > 1 ? ` · ${rate.unit}단위` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatPrice(rate.rate)}원</div>
                    {rate.ttb !== null && rate.tts !== null && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                        살 때 {formatPrice(rate.tts)} · 팔 때 {formatPrice(rate.ttb)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="note-box" style={{ marginTop: 20 }}>
            원자재 및 지수 실시간 데이터는 Yahoo Finance를 참고하며, 환율은 한국수출입은행 기준({data.date ? formatDate(data.date) : ""})입니다.
          </div>
        </>
      )}
    </AppShell>
  );
}
