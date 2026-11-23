"use client";

import Link from "next/link";
import { memo, useEffect, useState } from "react";
import type { StockMultiSignals } from "@/lib/stock-signals";

type SignalState = {
  ticker: string;
  data: StockMultiSignals | null;
  error: boolean;
};

function formatSignedShares(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) {
    return `${sign}${(abs / 10000).toFixed(1).replace(/\.0$/, "")}만주`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")}주`;
}

function shareColor(n: number): string {
  if (n > 0) return "var(--up)";
  if (n < 0) return "var(--down)";
  return "var(--muted)";
}

export const StockMultiSignalCard = memo(function StockMultiSignalCard({ ticker }: { ticker: string }) {
  const [state, setState] = useState<SignalState>({ ticker: "", data: null, error: false });
  const [tab, setTab] = useState<"flow" | "tech" | "disclosure">("flow");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/${encodeURIComponent(ticker)}/signals`)
      .then(async (res) => {
        if (!res.ok) throw new Error("시그널 조회 실패");
        const json = (await res.json()) as { signals?: StockMultiSignals };
        if (!cancelled) {
          setState({ ticker, data: json.signals ?? null, error: !json.signals });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ ticker, data: null, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const current = state.ticker === ticker ? state : null;
  const s = current?.data;

  const riskBadgeStyle = (status?: StockMultiSignals["riskAndShort"]["status"]) => {
    if (status === "OVERHEATED" || status === "CAUTION") {
      return { bg: "rgba(239, 68, 68, 0.12)", color: "var(--up)", border: "1px solid rgba(239, 68, 68, 0.28)" };
    }
    if (status === "OVERSOLD" || status === "SHORT_COVER_WATCH") {
      return { bg: "rgba(16, 185, 129, 0.14)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.3)" };
    }
    return { bg: "var(--surface-sunken)", color: "var(--ink)", border: "1px solid var(--line)" };
  };

  const badge = riskBadgeStyle(s?.riskAndShort.status);

  return (
    <section
      className="card"
      style={{
        marginTop: 18,
        marginBottom: 18,
        padding: "18px 20px",
        borderRadius: 16,
        border: "1px solid var(--line)",
        background: "var(--surface)",
      }}
      aria-label="6대 다차원 종목 분석 시그널"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            MULTI-SIGNAL INTELLIGENCE
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            뉴스 너머의 6대 실전 시그널 (수급 · 공시 · 기술 · 동종업종 · 리스크)
          </h2>
        </div>

        {s && (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              background: badge.bg,
              color: badge.color,
              border: badge.border,
            }}
          >
            🔥 {s.riskAndShort.statusLabel}
          </span>
        )}
      </div>

      {/* 상단 탭 */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 10,
          flexWrap: "wrap",
        }}
      >
        {[
          { id: "flow" as const, label: "👥 외인·기관 수급 & 리스크" },
          { id: "tech" as const, label: "📐 기술적 위치 & 동종업종·매크로" },
          { id: "disclosure" as const, label: `📢 최근 공시(${s?.disclosures.items.length ?? 0}) & 목표가 괴리율` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              padding: "6px 12px",
              borderRadius: 8,
              border: tab === item.id ? "none" : "1px solid var(--line)",
              background: tab === item.id ? "var(--accent)" : "var(--surface-sunken)",
              color: tab === item.id ? "#fff" : "var(--muted)",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!current ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="skeleton" style={{ height: 64, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 96, borderRadius: 12 }} />
        </div>
      ) : current.error || !s ? (
        <div className="muted" style={{ fontSize: 13 }}>
          다차원 종목 시그널을 불러오지 못했어요.
        </div>
      ) : (
        <>
          {/* 탭 1: 외국인·기관·개인 수급 & 신용/공매도/과열 리스크 */}
          {tab === "flow" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    padding: "11px 13px",
                    borderRadius: 12,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    외국인 (최근 5거래일)
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      marginTop: 4,
                      color: shareColor(s.investorFlow.foreignerNet5d),
                    }}
                  >
                    {formatSignedShares(s.investorFlow.foreignerNet5d)}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {s.investorFlow.foreignerStreak}
                    {s.investorFlow.foreignerHoldRatio ? ` · 비중 ${s.investorFlow.foreignerHoldRatio}` : ""}
                  </div>
                </div>

                <div
                  style={{
                    padding: "11px 13px",
                    borderRadius: 12,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    기관 (최근 5거래일)
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      marginTop: 4,
                      color: shareColor(s.investorFlow.institutionNet5d),
                    }}
                  >
                    {formatSignedShares(s.investorFlow.institutionNet5d)}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {s.investorFlow.institutionStreak}
                  </div>
                </div>

                <div
                  style={{
                    padding: "11px 13px",
                    borderRadius: 12,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    개인 (최근 5거래일)
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      marginTop: 4,
                      color: shareColor(s.investorFlow.individualNet5d),
                    }}
                  >
                    {formatSignedShares(s.investorFlow.individualNet5d)}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    개인 수급 누적
                  </div>
                </div>
              </div>

              {/* 일별 수급 미니 테이블 */}
              {s.investorFlow.daily.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)", textAlign: "right" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>일자</th>
                        <th style={{ padding: "6px 8px" }}>외국인</th>
                        <th style={{ padding: "6px 8px" }}>기관</th>
                        <th style={{ padding: "6px 8px" }}>개인</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.investorFlow.daily.map((d) => (
                        <tr key={d.date} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{d.date.slice(5)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: shareColor(d.foreigner) }}>
                            {formatSignedShares(d.foreigner)}
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: shareColor(d.institution) }}>
                            {formatSignedShares(d.institution)}
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: shareColor(d.individual) }}>
                            {formatSignedShares(d.individual)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 신용·프로그램·과열 리스크 체크포인트 */}
              <div
                style={{
                  padding: "11px 14px",
                  borderRadius: 10,
                  background: "var(--surface-sunken)",
                  border: "1px solid var(--line)",
                  fontSize: 12.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  🛡️ 신용 · 프로그램 · 과열 리스크 체크 ({s.riskAndShort.marketWarning})
                </div>
                {s.riskAndShort.checkpoints.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {s.riskAndShort.checkpoints.map((cp) => (
                      <span
                        key={cp}
                        style={{
                          fontSize: 11.5,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        • {cp}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="muted">특이 과열 또는 신용 급증 징후 없이 정상 범위입니다.</span>
                )}
              </div>
            </div>
          )}

          {/* 탭 2: 기술적 위치 & 동종업종·매크로 */}
          {tab === "tech" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    padding: "11px 13px",
                    borderRadius: 12,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    20일 평균 대비 거래량
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {s.technicals.volumeRatio20d !== null ? `${s.technicals.volumeRatio20d}배` : "—"}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {s.technicals.volumeRatio20d !== null
                      ? s.technicals.volumeRatio20d >= 2
                        ? "🔥 평소 대비 거래량 폭발"
                        : s.technicals.volumeRatio20d <= 0.6
                        ? "거래량 소강 상태"
                        : "평년 수준 거래 활발"
                      : "거래량 집계 중"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "11px 13px",
                    borderRadius: 12,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    52주 밴드 내 위치
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {s.technicals.position52wPercent !== null ? `하위 ${s.technicals.position52wPercent}%` : "—"}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {s.technicals.drawdownFromHighPercent !== null
                      ? `52주 고점 대비 ${s.technicals.drawdownFromHighPercent}%`
                      : "52주 고저 대비"}
                  </div>
                </div>

                <div
                  style={{
                    padding: "11px 13px",
                    borderRadius: 12,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    20일 이평선 이격 / RSI(14)
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {s.technicals.ma20Disparity !== null
                      ? `${s.technicals.ma20Disparity > 0 ? "+" : ""}${s.technicals.ma20Disparity}%`
                      : "—"}{" "}
                    / {s.technicals.rsi14 ?? "—"}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {s.technicals.rsi14 !== null
                      ? s.technicals.rsi14 >= 70
                        ? "과매수 주의 구간"
                        : s.technicals.rsi14 <= 30
                        ? "과매도 바닥권"
                        : "중립 에너지 구간"
                      : "모멘텀 지표"}
                  </div>
                </div>
              </div>

              {/* 동종 업종(Peer) 실시간 등락 비교 */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "var(--surface-sunken)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                  <strong style={{ fontSize: 12.5 }}>🏭 동종 업종(Peer) 실시간 비교</strong>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent-dark)" }}>
                    {s.sectorAndMacro.relativeStatus}
                    {s.sectorAndMacro.peerAvgChangeRate !== null
                      ? ` (업종 평균 ${s.sectorAndMacro.peerAvgChangeRate > 0 ? "+" : ""}${s.sectorAndMacro.peerAvgChangeRate}%)`
                      : ""}
                  </span>
                </div>
                {s.sectorAndMacro.peers.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                    {s.sectorAndMacro.peers.map((peer) => (
                      <Link
                        key={peer.ticker}
                        href={`/stock/${encodeURIComponent(peer.ticker)}?name=${encodeURIComponent(peer.name)}`}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                          textDecoration: "none",
                          color: "inherit",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{peer.name}</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              (peer.changeRate ?? 0) > 0
                                ? "var(--up)"
                                : (peer.changeRate ?? 0) < 0
                                ? "var(--down)"
                                : "var(--muted)",
                          }}
                        >
                          {peer.changeRate !== null ? `${peer.changeRate > 0 ? "+" : ""}${peer.changeRate}%` : "—"}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    동종 업종 비교 종목 정보가 없습니다.
                  </div>
                )}
              </div>

              {/* 글로벌 매크로 핵심 지표 바 */}
              {s.sectorAndMacro.macroHighlights.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 11.5, marginRight: 4 }}>
                    🌍 관련 글로벌 매크로:
                  </span>
                  {s.sectorAndMacro.macroHighlights.map((m) => (
                    <span
                      key={m.name}
                      style={{
                        fontSize: 11.5,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "var(--surface-sunken)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      {m.name} <strong>{m.value}</strong>{" "}
                      {m.changePercent !== null && (
                        <span style={{ color: m.changePercent > 0 ? "var(--up)" : m.changePercent < 0 ? "var(--down)" : "var(--muted)" }}>
                          ({m.changePercent > 0 ? "+" : ""}
                          {m.changePercent}%)
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 탭 3: 최근 핵심 공시 & 목표주가 괴리율 */}
          {tab === "disclosure" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 목표주가 괴리율 배너 */}
              <div
                style={{
                  padding: "11px 14px",
                  borderRadius: 12,
                  background: "var(--surface-sunken)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  fontSize: 12.5,
                }}
              >
                <span>📊 증권사 평균 목표주가 컨센서스</span>
                <strong>
                  {s.consensus.avgTargetPrice
                    ? `${s.consensus.avgTargetPrice.toLocaleString("ko-KR")}원 (${
                        s.consensus.upsidePercent !== null
                          ? `현재가 대비 ${s.consensus.upsidePercent > 0 ? `+${s.consensus.upsidePercent}%` : `${s.consensus.upsidePercent}%`}`
                          : "괴리율 집계 중"
                      })`
                    : "최근 목표주가 미제시"}
                </strong>
              </div>

              {/* 최근 전자공시 목록 */}
              {s.disclosures.items.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.disclosures.items.map((item) => (
                    <a
                      key={`${item.id}-${item.date}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "var(--surface-sunken)",
                        border: "1px solid var(--line)",
                        textDecoration: "none",
                        color: "inherit",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--accent-soft)",
                              color: "var(--accent-dark)",
                            }}
                          >
                            {item.category}
                          </span>
                          <span className="muted" style={{ fontSize: 11 }}>
                            {item.date} · {item.author}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.title}
                        </div>
                      </div>
                      <span className="muted" style={{ fontSize: 13, flexShrink: 0 }}>
                        ↗
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12.5 }}>
                  최근 30일 내 접수된 주요 공시가 없습니다.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
});
