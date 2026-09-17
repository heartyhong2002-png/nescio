"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { formatAmountCompact, formatPrice, formatSharesCompact } from "@/lib/format";
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

export default function IpoPage() {
  const { ipos, error } = useIpos();
  const [expanded, setExpanded] = useState<string | null>(null);

  const loading = ipos === null && !error;

  return (
    <AppShell narrow>
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="page-title">공모주 청약 & 수요예측</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            DART 공시와 38커뮤니케이션 데이터를 결합해 <strong>기관 수요예측 결과</strong>와 <strong>증권사별 실제 배정수량·한도</strong>를 한눈에 제공해요.
          </p>
        </div>
      </div>

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
                          label="균등 최소 증거금 (10주)"
                          value={
                            ipo.minSubscriptionDeposit !== null
                              ? `${formatPrice(ipo.minSubscriptionDeposit)}원`
                              : "미정"
                          }
                          sub="증거금률 50% 기준"
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
                            <strong>균등 배정</strong>: 최소 청약 단위(10주)에 해당하는 증거금만 입금해도 1계좌당 동일한 배정 기회를 얻을 수 있어요.
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
