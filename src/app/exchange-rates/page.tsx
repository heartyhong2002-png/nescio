"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { formatPrice } from "@/lib/format";
import { ExchangeRate } from "@/lib/types";
import { MAJOR_CURRENCY_CODES_CLIENT } from "@/lib/exchange-rate-constants";

function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[] | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/exchange-rates")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "환율 정보를 불러오지 못했습니다.");
        if (!cancelled) {
          setRates(data.rates);
          setDate(data.date);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "환율 정보를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rates, date, error };
}

function formatDate(basDd: string) {
  if (basDd.length !== 8) return "";
  return `${basDd.slice(0, 4)}.${basDd.slice(4, 6)}.${basDd.slice(6, 8)} 매매기준율`;
}

export default function ExchangeRatesPage() {
  const { rates, date, error } = useExchangeRates();
  const [query, setQuery] = useState("");

  const majors = useMemo(() => {
    if (!rates) return [];
    const seen = new Set<string>();
    return MAJOR_CURRENCY_CODES_CLIENT.map((code) => rates.find((rate) => rate.code === code)).filter(
      (rate): rate is ExchangeRate => {
        if (!rate || seen.has(rate.code)) return false;
        seen.add(rate.code);
        return true;
      },
    );
  }, [rates]);

  const filtered = useMemo(() => {
    if (!rates) return [];
    const trimmed = query.trim();
    if (!trimmed) return rates;
    return rates.filter((rate) => rate.name.includes(trimmed) || rate.code.includes(trimmed.toUpperCase()));
  }, [rates, query]);

  const loading = rates === null && !error;

  return (
    <AppShell narrow>
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="page-title">환율</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {date ? formatDate(date) : "한국수출입은행 매매기준율 기준"}
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

      {!loading && rates && (
        <>
          {majors.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                주요 통화
              </div>
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
            </>
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
            전체 통화 <span className="muted">{filtered.length}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="placeholder-box" style={{ padding: 20 }}>
              찾는 통화가 없어요.
            </div>
          ) : (
            <div className="list-panel">
              {filtered.map((rate) => (
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
            한국수출입은행이 공개하는 환율만 반영돼요(약 40개 통화 — 세계 모든 나라를 다 주는 무료
            공식 API는 없어요). 주말·공휴일에는 직전 영업일 기준율이 표시됩니다.
          </div>
        </>
      )}
    </AppShell>
  );
}
