"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { formatPrice } from "@/lib/format";
import { IpoInfo } from "@/lib/types";

function useIpos() {
  const [ipos, setIpos] = useState<IpoInfo[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ipos")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "공모주 정보를 불러오지 못했습니다.");
        if (!cancelled) setIpos(data.ipos);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "공모주 정보를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ipos, error };
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "일정 미정";
  const short = (iso: string) => iso.slice(5).replace("-", ".");
  if (start && end && start !== end) return `${short(start)} ~ ${short(end)}`;
  return short(start ?? end!);
}

function formatPriceRange(min: number | null, max: number | null) {
  if (min === null && max === null) return "미정";
  if (min !== null && max !== null && min !== max) return `${formatPrice(min)}원 ~ ${formatPrice(max)}원`;
  return `${formatPrice(min ?? max)}원`;
}

function daysUntil(dateIso: string | null) {
  if (!dateIso) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((Date.parse(dateIso) - Date.parse(today)) / 86_400_000);
}

function subscriptionStatus(ipo: IpoInfo) {
  const untilEnd = daysUntil(ipo.subscriptionEnd);
  const untilStart = daysUntil(ipo.subscriptionStart);
  if (untilEnd !== null && untilEnd < 0) return { label: "청약 마감", tone: "muted" as const };
  if (untilStart !== null && untilStart > 0) return { label: `D-${untilStart}`, tone: "accent" as const };
  return { label: "청약 중", tone: "accent" as const };
}

export default function IpoPage() {
  const { ipos, error } = useIpos();
  const [expanded, setExpanded] = useState<string | null>(null);

  const loading = ipos === null && !error;

  return (
    <AppShell narrow>
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="page-title">공모주</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            금융감독원 전자공시(DART) 기준 청약 일정이에요.
          </p>
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
        </div>
      )}

      {!loading && ipos && ipos.length === 0 && (
        <div className="placeholder-box" style={{ padding: 32, fontSize: 14 }}>
          지금 진행 중이거나 예정된 공모주가 없어요.
        </div>
      )}

      {!loading && ipos && ipos.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            청약 임박순 <span className="muted">{ipos.length}건</span>
          </div>

          <div className="list-panel">
            {ipos.map((ipo) => {
              const status = subscriptionStatus(ipo);
              const isOpen = expanded === ipo.corpCode;
              return (
                <div key={ipo.corpCode}>
                  <button
                    className="list-row"
                    style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : ipo.corpCode)}
                  >
                    <div className="stock-icon">{ipo.corpName.slice(0, 1)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{ipo.corpName}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                        청약 {formatDateRange(ipo.subscriptionStart, ipo.subscriptionEnd)} · 공모가{" "}
                        {formatPriceRange(ipo.offerPriceMin, ipo.offerPriceMax)}
                      </div>
                    </div>
                    <span className={`pill ${status.tone === "accent" ? "filled" : ""}`}>{status.label}</span>
                  </button>

                  {isOpen && (
                    <div className="card" style={{ margin: "0 0 8px", borderRadius: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                        <Row label="대표 주관사" value={ipo.leadUnderwriter ?? "정보 없음"} />
                        <Row
                          label="공모 규모"
                          value={ipo.offerAmount !== null ? `${formatPrice(ipo.offerAmount)}원` : "정보 없음"}
                        />
                        <Row
                          label="공모 주식수"
                          value={ipo.totalShares !== null ? `${formatPrice(ipo.totalShares)}주` : "정보 없음"}
                        />
                        <Row
                          label="상장 예정일"
                          value={
                            ipo.estimatedListingDate
                              ? `${ipo.estimatedListingDate} (예상)`
                              : "정보 없음"
                          }
                        />
                      </div>
                      <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
                        상장 예정일은 청약종료일 기준으로 추정한 값이라 실제와 다를 수 있어요. 확정 일정은
                        증권사 공지를 확인해주세요.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="note-box" style={{ marginTop: 20 }}>
            금융감독원 전자공시(DART)에 접수된 증권신고서 기준이라, 소규모 공모나 접수가 늦은 종목은
            빠질 수 있어요. 청약 전엔 반드시 증권사 앱에서 최종 조건을 다시 확인하세요.
          </div>
        </>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}
