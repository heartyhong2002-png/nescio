"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { formatAmountCompact, formatPrice, formatSharesCompact } from "@/lib/format";
import { CompanyInfo, IpoInfo, IpoListingsData } from "@/lib/types";

function useIpos() {
  const [ipos, setIpos] = useState<IpoInfo[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ipos")
      .then(async (response) => {
        const data = await response.json();
        if (!cancelled) {
          if (Array.isArray(data.ipos)) {
            setIpos(data.ipos);
          } else {
            setIpos([]);
          }
          if (!response.ok && data.error) {
            setError(data.error);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIpos([]);
          setError(err instanceof Error ? err.message : "공모주 정보를 불러오지 못했습니다.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ipos, setIpos, error };
}

function useIpoListings() {
  const [data, setData] = useState<IpoListingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ipos/listings")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "신규상장 정보를 불러오지 못했습니다.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

function CompanyOverviewCard({ company, corpName }: { company?: CompanyInfo | null; corpName: string }) {
  if (!company || (!company.sector && !company.ceo && !company.revenue && !company.homepage && !company.capital)) {
    return null;
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          <span>🏢</span> {corpName} 기업 정보 & 재무 현황
          {company.companySize && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--surface-sunken)",
                color: "var(--muted)",
                border: "1px solid var(--line)",
              }}
            >
              {company.companySize}
            </span>
          )}
        </div>

        {company.homepage && (
          <a
            href={company.homepage}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 11.5,
              color: "var(--accent-dark)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 6,
              background: "var(--accent-soft)",
              border: "1px solid rgba(124, 58, 237, 0.2)",
              fontWeight: 600,
            }}
          >
            <span>🌐</span> 공식 홈페이지 바로가기 ↗
          </a>
        )}
      </div>

      {/* 기본 정보 & 재무 정보 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {company.sector && (
          <div
            style={{
              background: "var(--surface-sunken)",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>주요 업종</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
              {company.sector}
            </div>
          </div>
        )}

        {company.ceo && (
          <div
            style={{
              background: "var(--surface-sunken)",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>대표자명</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
              {company.ceo}
            </div>
          </div>
        )}

        {company.revenue && (
          <div
            style={{
              background: "var(--surface-sunken)",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>최근 매출액</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent-dark)" }}>
              {company.revenue}
            </div>
          </div>
        )}

        {company.profit && (
          <div
            style={{
              background: "var(--surface-sunken)",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>순이익 (세전)</div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: company.profit.includes("-") ? "var(--up)" : "#059669",
              }}
            >
              {company.profit}
            </div>
          </div>
        )}

        {company.capital && (
          <div
            style={{
              background: "var(--surface-sunken)",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>자본금</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
              {company.capital}
            </div>
          </div>
        )}

        {company.phone && (
          <div
            style={{
              background: "var(--surface-sunken)",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>대표 전화번호</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-soft)" }}>
              {company.phone}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IpoAiReportCard({
  ipo,
  onRefresh,
  isRefreshing,
}: {
  ipo: IpoInfo;
  onRefresh?: (ipo: IpoInfo) => void;
  isRefreshing?: boolean;
}) {
  const analysis = ipo.aiAnalysis;
  if (!analysis) return null;

  const toneConfig = {
    STRONG_APPLY: {
      bg: "rgba(16, 185, 129, 0.08)",
      border: "rgba(16, 185, 129, 0.3)",
      badgeBg: "rgba(16, 185, 129, 0.15)",
      badgeColor: "#059669",
      icon: "🚀",
    },
    APPLY: {
      bg: "rgba(49, 130, 246, 0.08)",
      border: "rgba(49, 130, 246, 0.25)",
      badgeBg: "rgba(49, 130, 246, 0.12)",
      badgeColor: "var(--down)",
      icon: "✨",
    },
    NEUTRAL: {
      bg: "rgba(245, 158, 11, 0.08)",
      border: "rgba(245, 158, 11, 0.25)",
      badgeBg: "rgba(245, 158, 11, 0.15)",
      badgeColor: "#d97706",
      icon: "⚖️",
    },
    PASS: {
      bg: "rgba(239, 68, 68, 0.08)",
      border: "rgba(239, 68, 68, 0.25)",
      badgeBg: "rgba(239, 68, 68, 0.12)",
      badgeColor: "var(--up)",
      icon: "✋",
    },
  }[analysis.verdict] ?? {
    bg: "var(--surface-sunken)",
    border: "var(--line)",
    badgeBg: "var(--surface)",
    badgeColor: "var(--ink)",
    icon: "🤖",
  };

  return (
    <div
      style={{
        background: toneConfig.bg,
        border: `1.5px solid ${toneConfig.border}`,
        borderRadius: 12,
        padding: "16px 16px",
        marginBottom: 20,
      }}
    >
      {/* AI 리포트 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--accent-dark)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>🤖</span> AI 청약 판단 리포트
          </span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 6,
              background: toneConfig.badgeBg,
              color: toneConfig.badgeColor,
            }}
          >
            {toneConfig.icon} {analysis.verdictLabel}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
            점수: {analysis.score}점 / 100
          </span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh(ipo);
            }}
            disabled={isRefreshing}
            style={{
              fontSize: 11,
              padding: "4px 9px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--muted)",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: isRefreshing ? "rotate(180deg)" : "none",
                transition: "transform 0.4s",
              }}
            >
              🔄
            </span>
            {isRefreshing ? "AI 재분석 중..." : "AI 심층 재분석"}
          </button>
        )}
      </div>

      {/* 한 줄 핵심 진단 */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        💡 {analysis.oneLiner}
      </div>

      {/* 기업 주요 사업 & 비즈니스 모델 요약 */}
      {analysis.businessSummary && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.75)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--ink-soft)",
            lineHeight: 1.55,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: "var(--accent-dark)",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>🏢</span> 기업 주요 사업 & 비즈니스 요약
          </div>
          {analysis.businessSummary}
        </div>
      )}

      {/* 호재 및 주의점 2열/그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {analysis.strengths && analysis.strengths.length > 0 && (
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              borderRadius: 8,
              padding: "10px 12px",
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#059669",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>✅</span> 청약 추천 및 긍정 요인
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                fontSize: 11.5,
                lineHeight: 1.5,
                color: "var(--ink-soft)",
              }}
            >
              {analysis.strengths.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {analysis.cautions && analysis.cautions.length > 0 && (
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              borderRadius: 8,
              padding: "10px 12px",
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#d97706",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>⚠️</span> 리스크 및 주의 요인
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                fontSize: 11.5,
                lineHeight: 1.5,
                color: "var(--ink-soft)",
              }}
            >
              {analysis.cautions.map((c, idx) => (
                <li key={idx}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 맞춤 청약 전략 */}
      {analysis.strategy && (
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            lineHeight: 1.5,
            background: "rgba(124, 58, 237, 0.05)",
            border: "1px solid rgba(124, 58, 237, 0.15)",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          <strong style={{ color: "var(--accent-dark)" }}>🎯 추천 청약 전략: </strong>
          {analysis.strategy}
        </div>
      )}
    </div>
  );
}

function formatWithDayOfWeek(iso: string | null): string {
  if (!iso) return "미정";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const day = days[date.getUTCDay()];
  const short = iso.slice(5).replace("-", ".");
  return `${short}(${day})`;
}

function formatScheduleRange(start: string | null, end: string | null) {
  if (!start && !end) return "일정 미정";
  if (start && end && start !== end) {
    return `${formatWithDayOfWeek(start)} ~ ${formatWithDayOfWeek(end)}`;
  }
  return formatWithDayOfWeek(start ?? end);
}

function formatPriceRange(min: number | null, max: number | null, confirmed: number | null) {
  if (confirmed !== null) return `${formatPrice(confirmed)}원 (확정)`;
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

function parseCompetitionNumber(compStr: string | null): number | null {
  if (!compStr) return null;
  const m = compStr.match(/([\d,.]+)\s*:\s*1/);
  if (!m) return null;
  const val = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(val) ? val : null;
}

function parsePercentNumber(percentStr: string | null): number | null {
  if (!percentStr) return null;
  const m = percentStr.match(/([\d,.]+)\s*%/);
  if (!m) return null;
  const val = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(val) ? val : null;
}

function ListingsView() {
  const { data, loading, error } = useIpoListings();
  const [filter, setFilter] = useState<"ALL" | "DOUBLE" | "LOSS">("ALL");

  if (loading && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 90, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      </div>
    );
  }

  if (error && !data) {
    return <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>;
  }

  const stats = data?.stats;
  const upcoming = data?.upcoming ?? [];
  const history = data?.history ?? [];

  const filteredHistory = history.filter((item) => {
    if (filter === "DOUBLE") return item.badge === "TRIPLE" || item.badge === "DOUBLE";
    if (filter === "LOSS") return item.badge === "LOSS";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. 2026 시장 종합 성적표 배너 */}
      {stats && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 10, fontSize: 11 }}>
            2026 공모주 시장 첫날 움직임 종합 ({stats.totalCount}개사 분석)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 10,
            }}
          >
            <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>평균 시초가 수익률</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--up)" }}>{stats.avgOpenReturn}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>공모가의 약 2.3배</div>
            </div>
            <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>평균 첫날 종가 수익률</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-dark)" }}>{stats.avgFirstDayReturn}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>차익실현 후 안착</div>
            </div>
            <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>따따블 (+300%)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#7c3aed" }}>{stats.tripleCount}개사</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>마키나락스, 폴레드 등</div>
            </div>
            <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>공모가 하회 (손실)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--down)" }}>{stats.lossCount}개사</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>손실 비율 약 29%</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. 상장 예정 공모주 현황 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div className="eyebrow" style={{ fontSize: 11 }}>
            상장 예정 공모주 <span className="muted">{upcoming.length}건</span>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            최근 상장 대기 종목
          </span>
        </div>

        {upcoming.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {upcoming.map((item) => (
              <div
                key={item.name}
                className="card"
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{item.name}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(124, 58, 237, 0.1)",
                      color: "var(--accent-dark)",
                      border: "1px solid rgba(124, 58, 237, 0.2)",
                    }}
                  >
                    상장 예정
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>상장예정일: <strong style={{ color: "var(--ink)" }}>{item.listingDate}</strong></span>
                  <span>공모가: <strong style={{ color: "var(--ink)" }}>{item.offerPrice ? `${item.offerPrice.toLocaleString()}원` : "미정"}</strong></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="placeholder-box" style={{ padding: 20, fontSize: 13 }}>
            현재 상장 대기 중인 종목이 없습니다.
          </div>
        )}
      </div>

      {/* 3. 2026 신규상장 공모주 첫날 성적표 */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div className="eyebrow" style={{ fontSize: 11 }}>
            2026 상장 첫날 실전 성적표 <span className="muted">{filteredHistory.length}건</span>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: filter === "ALL" ? "var(--accent)" : "var(--surface)",
                color: filter === "ALL" ? "#fff" : "var(--muted)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              전체 ({history.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("DOUBLE")}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: filter === "DOUBLE" ? "#7c3aed" : "var(--surface)",
                color: filter === "DOUBLE" ? "#fff" : "var(--muted)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🚀 따블 이상 ({stats?.doubleCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setFilter("LOSS")}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: filter === "LOSS" ? "var(--up)" : "var(--surface)",
                color: filter === "LOSS" ? "#fff" : "var(--muted)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⚠️ 손실 ({stats?.lossCount ?? 0})
            </button>
          </div>
        </div>

        {/* 성적표 테이블 */}
        <div
          style={{
            overflowX: "auto",
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              textAlign: "left",
              minWidth: 560,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--surface-sunken)",
                  borderBottom: "1px solid var(--line)",
                  color: "var(--muted)",
                  fontSize: 11.5,
                }}
              >
                <th style={{ padding: "9px 12px" }}>종목명 (상장일)</th>
                <th style={{ padding: "9px 10px", textAlign: "right" }}>공모가</th>
                <th style={{ padding: "9px 10px", textAlign: "right" }}>시초가 (수익률)</th>
                <th style={{ padding: "9px 10px", textAlign: "right" }}>첫날 종가 (최종 수익률)</th>
                <th style={{ padding: "9px 12px", textAlign: "center" }}>첫날 성적</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item, idx) => {
                const isLoss = item.badge === "LOSS";
                const isTriple = item.badge === "TRIPLE";
                const isDouble = item.badge === "DOUBLE";

                return (
                  <tr
                    key={item.name + item.listingDate}
                    style={{
                      borderBottom: idx < filteredHistory.length - 1 ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, color: "var(--ink)" }}>{item.name}</div>
                      <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{item.listingDate}</div>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--muted)" }}>
                      {item.offerPrice ? `${item.offerPrice.toLocaleString()}원` : "-"}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                        {item.openPrice ? `${item.openPrice.toLocaleString()}원` : "-"}
                      </div>
                      {item.openReturnRate && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: item.openReturnRate.startsWith("-") ? "var(--down)" : "var(--up)",
                          }}
                        >
                          {item.openReturnRate}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                        {item.firstDayClose ? `${item.firstDayClose.toLocaleString()}원` : "-"}
                      </div>
                      {item.firstDayReturnRate && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: item.firstDayReturnRate.startsWith("-") ? "var(--down)" : "var(--up)",
                          }}
                        >
                          {item.firstDayReturnRate}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {isTriple && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "linear-gradient(135deg, #7c3aed, #db2777)",
                            color: "#fff",
                          }}
                        >
                          따따블 (+300%)
                        </span>
                      )}
                      {isDouble && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#059669",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                          }}
                        >
                          따블 달성
                        </span>
                      )}
                      {!isTriple && !isDouble && !isLoss && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(49, 130, 246, 0.1)",
                            color: "var(--accent-dark)",
                          }}
                        >
                          공모가 상회
                        </span>
                      )}
                      {isLoss && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(239, 68, 68, 0.12)",
                            color: "var(--up)",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                          }}
                        >
                          공모가 하회
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function IpoPage() {
  const { ipos, setIpos, error } = useIpos();
  const [activeTab, setActiveTab] = useState<"subscription" | "listings">("subscription");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshingCorp, setRefreshingCorp] = useState<string | null>(null);

  const handleRefreshAnalysis = async (targetIpo: IpoInfo) => {
    if (refreshingCorp) return;
    setRefreshingCorp(targetIpo.corpName);
    try {
      const res = await fetch("/api/ipos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipo: targetIpo }),
      });
      if (!res.ok) throw new Error("분석 요청 실패");
      const data = await res.json();
      if (data.analysis) {
        setIpos((prev) =>
          prev
            ? prev.map((item) =>
                item.corpCode === targetIpo.corpCode ? { ...item, aiAnalysis: data.analysis } : item,
              )
            : null,
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingCorp(null);
    }
  };

  const loading = ipos === null && !error;

  return (
    <AppShell narrow>
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="page-title">공모주 캘린더 & 시장 동향</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            청약 일정·수요예측·AI 진단부터 <strong>상장 예정일 및 2026 신규상장 첫날 실전 성적표</strong>까지 한눈에 확인하세요.
          </p>
        </div>
      </div>

      {/* 상단 탭 스위처 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("subscription")}
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "subscription" ? "var(--accent)" : "transparent",
            color: activeTab === "subscription" ? "#fff" : "var(--muted)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          📝 공모 청약 & AI 진단
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("listings")}
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "listings" ? "var(--accent)" : "transparent",
            color: activeTab === "listings" ? "#fff" : "var(--muted)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          🚀 2026 상장 현황 & 첫날 성적표
        </button>
      </div>

      {/* 탭 1: 신규상장 현황 & 첫날 성적표 */}
      {activeTab === "listings" && <ListingsView />}

      {/* 탭 2: 기존 청약 일정 & AI 진단 */}
      {activeTab === "subscription" && (
        <>
          {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
        </div>
      )}

      {!loading && ipos && ipos.length === 0 && (
        <div className="placeholder-box" style={{ padding: 40, fontSize: 14 }}>
          지금 진행 중이거나 예정된 공모주가 없어요.
        </div>
      )}

      {!loading && ipos && ipos.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            청약 임박순 <span className="muted">{ipos.length}건</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ipos.map((ipo) => {
              const status = subscriptionStatus(ipo);
              const isOpen = expanded === ipo.corpCode;
              const compNum = parseCompetitionNumber(ipo.institutionCompetitionRate);
              const lockupNum = parsePercentNumber(ipo.lockupRatio);

              return (
                <div
                  key={ipo.corpCode}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    border: isOpen ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  {/* 카드 헤더 (항상 노출되는 기본 요약 행) */}
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      cursor: "pointer",
                      background: isOpen ? "var(--surface-sunken)" : "var(--surface)",
                      transition: "background 0.15s ease",
                    }}
                    onClick={() => setExpanded(isOpen ? null : ipo.corpCode)}
                    aria-expanded={isOpen}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div className="stock-icon" style={{ flexShrink: 0 }}>
                          {ipo.corpName.slice(0, 1)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span>{ipo.corpName}</span>
                            {/* 업종 뱃지 */}
                            {ipo.companyInfo?.sector && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: "var(--surface-sunken)",
                                  color: "var(--muted)",
                                  border: "1px solid var(--line)",
                                }}
                              >
                                {ipo.companyInfo.sector}
                              </span>
                            )}
                            {/* AI 청약 판단 배지 */}
                            {ipo.aiAnalysis && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background:
                                    ipo.aiAnalysis.verdict === "STRONG_APPLY"
                                      ? "rgba(16, 185, 129, 0.15)"
                                      : ipo.aiAnalysis.verdict === "APPLY"
                                      ? "rgba(49, 130, 246, 0.12)"
                                      : ipo.aiAnalysis.verdict === "NEUTRAL"
                                      ? "rgba(245, 158, 11, 0.15)"
                                      : "rgba(239, 68, 68, 0.12)",
                                  color:
                                    ipo.aiAnalysis.verdict === "STRONG_APPLY"
                                      ? "#059669"
                                      : ipo.aiAnalysis.verdict === "APPLY"
                                      ? "var(--down)"
                                      : ipo.aiAnalysis.verdict === "NEUTRAL"
                                      ? "#d97706"
                                      : "var(--up)",
                                  border:
                                    ipo.aiAnalysis.verdict === "STRONG_APPLY"
                                      ? "1px solid rgba(16, 185, 129, 0.3)"
                                      : "1px solid var(--line)",
                                }}
                              >
                                🤖 {ipo.aiAnalysis.verdictLabel} ({ipo.aiAnalysis.score}점)
                              </span>
                            )}
                            {/* 수요예측 기관경쟁률 배지 */}
                            {ipo.institutionCompetitionRate && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: (compNum ?? 0) >= 1000 ? "rgba(240, 68, 82, 0.12)" : "var(--accent-soft)",
                                  color: (compNum ?? 0) >= 1000 ? "var(--up)" : "var(--accent-dark)",
                                }}
                              >
                                {(compNum ?? 0) >= 1000 && "🔥 "}기관 {ipo.institutionCompetitionRate}
                              </span>
                            )}
                            {/* 의무보유확약 배지 */}
                            {ipo.lockupRatio && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: (lockupNum ?? 0) >= 10 ? "rgba(16, 185, 129, 0.12)" : "var(--surface-sunken)",
                                  color: (lockupNum ?? 0) >= 10 ? "#059669" : "var(--muted)",
                                  border: "1px solid var(--line)",
                                }}
                              >
                                확약 {ipo.lockupRatio}
                              </span>
                            )}
                            {/* 청약경쟁률 배지 (마감 또는 진행 시) */}
                            {ipo.subscriptionCompetitionRate && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: "rgba(49, 130, 246, 0.12)",
                                  color: "var(--down)",
                                }}
                              >
                                청약 {ipo.subscriptionCompetitionRate.split(" ")[0]}
                              </span>
                            )}
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            청약 {formatScheduleRange(ipo.subscriptionStart, ipo.subscriptionEnd)} · 공모가{" "}
                            <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                              {formatPriceRange(ipo.offerPriceMin, ipo.offerPriceMax, ipo.confirmedPrice)}
                            </span>
                            {" · "}
                            <span>
                              최소 청약:{" "}
                              <strong style={{ color: "var(--ink)" }}>{ipo.minSubscriptionShares ?? 10}주</strong>
                              {ipo.minSubscriptionDeposit && (
                                <span style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
                                  {" "}(증거금 {formatAmountCompact(ipo.minSubscriptionDeposit)}원)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <span className={`pill ${status.tone === "accent" ? "filled" : ""}`}>{status.label}</span>
                        <span
                          style={{
                            fontSize: 14,
                            color: "var(--muted)",
                            display: "inline-block",
                            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                          }}
                        >
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* 기본 뷰에서도 즉시 보이는 증권사별 배정 & 한도 뱃지 목록 */}
                    {ipo.underwriterAllocations.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", paddingTop: 2 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 2 }}>증권사 배정:</span>
                        {ipo.underwriterAllocations.map((a) => (
                          <span
                            key={a.name}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11.5,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: a.role?.includes("대표") ? "var(--accent-soft)" : "rgba(0,0,0,0.04)",
                              color: a.role?.includes("대표") ? "var(--accent-dark)" : "var(--ink-soft)",
                              fontWeight: a.role?.includes("대표") ? 600 : 500,
                              border: a.role?.includes("대표") ? "1px solid rgba(124, 58, 237, 0.2)" : "1px solid var(--line)",
                            }}
                          >
                            <span>{a.name}</span>
                            {a.role && <span style={{ opacity: 0.8, fontSize: 10.5 }}>({a.role})</span>}
                            <span style={{ fontWeight: 700, marginLeft: 2 }}>
                              {a.retailShares ? formatSharesCompact(a.retailShares) : formatSharesCompact(a.shares)}
                            </span>
                            {a.subscriptionLimit && (
                              <span style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: 2 }}>
                                (한도 {a.subscriptionLimit.replace(" 주", "")})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* 펼쳐진 상세 영역 */}
                  {isOpen && (
                    <div style={{ padding: "18px 20px 22px", borderTop: "1px solid var(--line)" }}>
                      {/* 0. 🤖 AI 청약 판단 리포트 (LLM 기반) */}
                      {ipo.aiAnalysis && (
                        <IpoAiReportCard
                          ipo={ipo}
                          onRefresh={handleRefreshAnalysis}
                          isRefreshing={refreshingCorp === ipo.corpName}
                        />
                      )}

                      {/* 0.5 🏢 기업 개요 & 재무 현황 카드 */}
                      <CompanyOverviewCard
                        company={ipo.companyInfo}
                        corpName={ipo.corpName}
                      />

                      {/* 1. 기관 수요예측 결과 하이라이트 카드 (핵심 추가!) */}
                      <div style={{ marginBottom: 18 }}>
                        <div className="eyebrow" style={{ marginBottom: 10, fontSize: 11 }}>
                          수요예측 결과 & 청약 지표
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: 10,
                          }}
                        >
                          <HighlightCard
                            label="기관 수요예측 경쟁률"
                            value={ipo.institutionCompetitionRate ?? "결과 대기 중"}
                            tag={
                              compNum !== null
                                ? compNum >= 1000
                                  ? "🔥 흥행 성공"
                                  : compNum >= 500
                                  ? "양호"
                                  : "저조"
                                : undefined
                            }
                            tagColor={
                              (compNum ?? 0) >= 1000
                                ? "var(--up)"
                                : (compNum ?? 0) >= 500
                                ? "var(--accent)"
                                : "var(--muted)"
                            }
                          />
                          <HighlightCard
                            label="의무보유확약 비율"
                            value={ipo.lockupRatio ?? "결과 대기 중"}
                            tag={
                              lockupNum !== null
                                ? lockupNum >= 15
                                  ? "🔒 확약 매우 높음"
                                  : lockupNum >= 5
                                  ? "🔒 확약 양호"
                                  : "확약 낮음"
                                : undefined
                            }
                            tagColor={(lockupNum ?? 0) >= 10 ? "#059669" : "var(--muted)"}
                          />
                          <HighlightCard
                            label="희망 공모가 밴드"
                            value={ipo.hopePriceBand ?? (ipo.offerPriceMin ? `${formatPrice(ipo.offerPriceMin)}원 ~ ${formatPrice(ipo.offerPriceMax)}원` : "미정")}
                            tag={
                              ipo.confirmedPrice
                                ? ipo.offerPriceMax && ipo.confirmedPrice > ipo.offerPriceMax
                                  ? "상단 초과 확정"
                                  : ipo.offerPriceMax && ipo.confirmedPrice === ipo.offerPriceMax
                                  ? "상단 확정"
                                  : "확정 완료"
                                : "공모가 미확정"
                            }
                            tagColor={ipo.confirmedPrice ? "var(--accent)" : "var(--muted)"}
                          />
                          {ipo.subscriptionCompetitionRate && (
                            <HighlightCard
                              label="일반 청약 최종 경쟁률"
                              value={ipo.subscriptionCompetitionRate}
                              tag="청약 마감"
                              tagColor="var(--down)"
                            />
                          )}
                        </div>
                      </div>

                      {/* 2. 청약 타임라인 (청약일정 -> 환불일 -> 상장예정일) */}
                      <div style={{ marginBottom: 18 }}>
                        <div className="eyebrow" style={{ marginBottom: 10, fontSize: 11 }}>
                          핵심 청약 일정
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                            gap: 8,
                          }}
                        >
                          <TimelineItem
                            step="1단계"
                            title="청약 기간"
                            date={formatScheduleRange(ipo.subscriptionStart, ipo.subscriptionEnd)}
                            highlight
                          />
                          <TimelineItem
                            step="2단계"
                            title="환불·납입일"
                            date={formatWithDayOfWeek(ipo.refundDate ?? ipo.paymentDate)}
                            desc="증거금 환불"
                          />
                          <TimelineItem
                            step="3단계"
                            title="상장 예정일"
                            date={ipo.estimatedListingDate ? `${formatWithDayOfWeek(ipo.estimatedListingDate)} (예상)` : "미정"}
                            desc="추정 일정"
                          />
                        </div>
                      </div>

                      {/* 3. 청약 조건 핵심 요약 카드 */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 10,
                          marginBottom: 20,
                        }}
                      >
                        <MetricCard
                          label="확정(희망) 공모가"
                          value={formatPriceRange(ipo.offerPriceMin, ipo.offerPriceMax, ipo.confirmedPrice)}
                        />
                        <MetricCard
                          label={`균등 최소 청약 (${ipo.minSubscriptionShares ?? 10}주)`}
                          value={
                            ipo.minSubscriptionDeposit !== null
                              ? `${formatPrice(ipo.minSubscriptionDeposit)}원`
                              : "미정"
                          }
                          sub={`최소단위 ${ipo.minSubscriptionShares ?? 10}주 · 증거금률 50%`}
                          accent
                        />
                        <MetricCard
                          label="총 공모 규모"
                          value={formatAmountCompact(ipo.offerAmount)}
                          sub={ipo.totalShares ? `총 ${formatSharesCompact(ipo.totalShares)}` : undefined}
                        />
                      </div>

                      {/* 4. 증권사별 배정 주식수 & 청약한도 상세 테이블 */}
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            marginBottom: 8,
                          }}
                        >
                          <div className="eyebrow" style={{ fontSize: 11 }}>
                            증권사별 배정 주식수 & 청약 한도 상세
                          </div>
                          <span className="muted" style={{ fontSize: 11 }}>
                            일반청약자 배정 물량 기준
                          </span>
                        </div>

                        {ipo.underwriterAllocations.length > 0 ? (
                          <div
                            style={{
                              overflowX: "auto",
                              borderRadius: 10,
                              border: "1px solid var(--line)",
                              background: "var(--surface)",
                            }}
                          >
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 12.5,
                                textAlign: "left",
                                minWidth: 480,
                              }}
                            >
                              <thead>
                                <tr
                                  style={{
                                    background: "var(--surface-sunken)",
                                    borderBottom: "1px solid var(--line)",
                                    color: "var(--muted)",
                                    fontSize: 11.5,
                                  }}
                                >
                                  <th style={{ padding: "8px 12px" }}>증권사</th>
                                  <th style={{ padding: "8px 10px", textAlign: "right" }}>일반 배정 수량</th>
                                  <th style={{ padding: "8px 10px", textAlign: "right" }}>균등 예상 (50%)</th>
                                  <th style={{ padding: "8px 12px", textAlign: "right" }}>최고 청약 한도</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ipo.underwriterAllocations.map((a, idx) => (
                                  <tr
                                    key={a.name}
                                    style={{
                                      borderBottom:
                                        idx < ipo.underwriterAllocations.length - 1
                                          ? "1px solid var(--line)"
                                          : "none",
                                    }}
                                  >
                                    <td style={{ padding: "10px 12px" }}>
                                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                        <span>{a.name}</span>
                                        {a.role && (
                                          <span
                                            style={{
                                              fontSize: 10.5,
                                              padding: "1px 5px",
                                              borderRadius: 4,
                                              background:
                                                a.role.includes("대표")
                                                  ? "var(--accent-soft)"
                                                  : "var(--surface-sunken)",
                                              color:
                                                a.role.includes("대표")
                                                  ? "var(--accent)"
                                                  : "var(--muted)",
                                              fontWeight: 600,
                                            }}
                                          >
                                            {a.role}
                                          </span>
                                        )}
                                      </div>
                                      {a.percentage !== null && (
                                        <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                                          인수 점유율 {a.percentage}%
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>
                                      {a.retailShares !== null ? `${formatPrice(a.retailShares)}주` : a.shares !== null ? `${formatPrice(a.shares)}주` : "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "10px 10px",
                                        textAlign: "right",
                                        fontWeight: 600,
                                        color: "var(--accent)",
                                      }}
                                    >
                                      {a.equalShares !== null ? `${formatPrice(a.equalShares)}주` : "—"}
                                    </td>
                                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--ink-soft)", fontWeight: 500 }}>
                                      {a.subscriptionLimit ?? "증권사 앱 확인"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div
                            className="placeholder-box"
                            style={{ padding: 14, fontSize: 12, textAlign: "center" }}
                          >
                            증권신고서에 주관사 배정 정보가 아직 공시되지 않았어요.
                          </div>
                        )}
                      </div>

                      {/* 5. 투자 팁 및 환매청구권 안내 */}
                      <div
                        style={{
                          background: "var(--accent-soft)",
                          borderRadius: 10,
                          padding: "12px 14px",
                          fontSize: 12,
                          lineHeight: 1.6,
                          color: "var(--ink-soft)",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "var(--accent-dark)", marginBottom: 3 }}>
                          💡 공모주 청약 가이드 & 꿀팁
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                          <li>
                            <strong>수요예측 지표</strong>: 기관 경쟁률이 1,000:1을 초과하고 의무보유확약 비율이 높을수록 상장일 매도 대기 물량이 적어 긍정적으로 평가받아요.
                          </li>
                          <li>
                            <strong>증권사 배정 전략</strong>: 배정 수량이 더 많은 증권사에 청약할수록 균등 배정 확률이 높아지며, 일반/우대 고객 등급에 따라 최고 청약 한도가 달라져요.
                          </li>
                          <li>
                            <strong>균등 배정</strong>: 최소 청약 단위({ipo.minSubscriptionShares ?? 10}주)에 해당하는 증거금만 입금해도 1계좌당 동일한 배정 기회를 얻을 수 있어요.
                          </li>
                        </ul>
                      </div>

                      {ipo.lockupNote && (
                        <div
                          style={{
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--line)",
                            borderRadius: 10,
                            padding: "10px 12px",
                            fontSize: 11.5,
                            lineHeight: 1.5,
                            color: "var(--ink-soft)",
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>참고사항: </span>
                          {ipo.lockupNote}
                        </div>
                      )}

                      <p className="muted" style={{ fontSize: 11, margin: "8px 0 0", lineHeight: 1.5 }}>
                        * 금융감독원 OpenDART 공시 및 38커뮤니케이션 청약 데이터를 바탕으로 분석된 정보입니다. 
                        수요예측 결과 및 배정 조건은 증권사 최종 공고에 따라 변경될 수 있으므로 청약 전 증권사 앱을 꼭 확인하세요.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="note-box" style={{ marginTop: 24, fontSize: 12, lineHeight: 1.6 }}>
            금융감독원 전자공시(OpenDART)와 IPO 포털을 교차 검증하여 청약일정, 확정공모가, 기관 수요예측 경쟁률, 의무보유확약 비율, 증권사별 배정수량 및 청약 한도를 통합 제공합니다.
          </div>
        </>
      )}
        </>
      )}
    </AppShell>
  );
}

function HighlightCard({
  label,
  value,
  tag,
  tagColor,
}: {
  label: string;
  value: string;
  tag?: string;
  tagColor?: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--surface-sunken)",
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span className="muted" style={{ fontSize: 11 }}>{label}</span>
        {tag && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: 4,
              background: "rgba(0,0,0,0.05)",
              color: tagColor ?? "var(--ink)",
            }}
          >
            {tag}
          </span>
        )}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function TimelineItem({
  step,
  title,
  date,
  desc,
  highlight,
}: {
  step: string;
  title: string;
  date: string;
  desc?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: highlight ? "var(--accent-soft)" : "var(--surface-sunken)",
        border: highlight ? "1px solid rgba(124, 58, 237, 0.25)" : "1px solid var(--line)",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: highlight ? "var(--accent)" : "var(--muted)",
          marginBottom: 2,
        }}
      >
        {step} · {title}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{date}</div>
      {desc && <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{desc}</div>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--surface-sunken)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: accent ? "var(--accent)" : "var(--ink)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
