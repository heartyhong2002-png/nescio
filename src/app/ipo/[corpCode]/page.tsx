"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { formatAmountCompact, formatPrice, formatSharesCompact } from "@/lib/format";
import { IpoInfo } from "@/lib/types";
import CompanyLogo from "@/components/CompanyLogo";

function Value({ label, value, fallback = "자료 준비 중" }: { label: string; value: ReactNode; fallback?: string }) {
  return (
    <div className="ipo-detail-value">
      <span>{label}</span>
      <strong>{value === null || value === undefined || value === "" ? fallback : value}</strong>
    </div>
  );
}

export default function IpoDetailPage({ params }: { params: Promise<{ corpCode: string }> }) {
  const [ipo, setIpo] = useState<IpoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(({ corpCode }) =>
      fetch("/api/ipos")
        .then((res) => res.json())
        .then((data) => {
          const found = Array.isArray(data.ipos)
            ? data.ipos.find((item: IpoInfo) => item.corpCode === decodeURIComponent(corpCode))
            : null;
          if (!found) setError("공모주 정보를 찾지 못했습니다.");
          setIpo(found ?? null);
        })
        .catch(() => setError("공모주 정보를 불러오지 못했습니다."))
        .finally(() => setLoading(false)),
    );
  }, [params]);

  const demandFallback = ipo?.demandForecastDate
    ? `수요예측 (${ipo.demandForecastDate}) 후 공개`
    : "수요예측 결과 발표 대기";

  const peerAndMarketCap = ipo
    ? [ipo.companyInfo?.peerCompanies ? `비교기업: ${ipo.companyInfo.peerCompanies}` : null, ipo.companyInfo?.marketCapEstimate]
        .filter(Boolean)
        .join(" · ") || (ipo.offerAmount ? `공모총액 ${formatAmountCompact(ipo.offerAmount)}원` : null)
    : null;

  return (
    <AppShell variant="intelligence">
      <div className="ipo-intelligence ipo-detail-page">
        <Link href="/ipo" className="ipo-detail-back">
          ← 공모주 목록으로
        </Link>
        {loading && <div className="placeholder-box">공모주 상세 정보를 불러오는 중이에요.</div>}
        {!loading && error && <div className="error-box">{error}</div>}
        {!loading && ipo && (
          <>
            <header className="ipo-detail-hero">
              <div className="ipo-detail-title">
                <CompanyLogo name={ipo.corpName} homepage={ipo.companyInfo?.homepage} size={58} />
                <div>
                  <div className="eyebrow ipo-eyebrow">IPO DETAIL</div>
                  <h1>{ipo.corpName}</h1>
                  <p>
                    {ipo.companyInfo?.sector ?? "업종 정보 준비 중"} · {ipo.leadUnderwriter ?? "대표 주관사 정보 준비 중"}
                  </p>
                </div>
              </div>
              {ipo.aiAnalysis && (
                <span className="pill filled">
                  🤖 {ipo.aiAnalysis.verdictLabel} · {ipo.aiAnalysis.score}점
                </span>
              )}
            </header>

            <section className="ipo-detail-grid ipo-detail-primary">
              <Value
                label="청약 기간"
                value={
                  ipo.subscriptionStart && ipo.subscriptionEnd
                    ? `${ipo.subscriptionStart} ~ ${ipo.subscriptionEnd}`
                    : null
                }
              />
              <Value
                label="공모가"
                value={ipo.confirmedPrice ? `${formatPrice(ipo.confirmedPrice)}원 (확정)` : ipo.hopePriceBand}
              />
              <Value label="기관 경쟁률" value={ipo.institutionCompetitionRate} fallback={demandFallback} />
              <Value
                label="수요예측 참여기관 수"
                value={
                  ipo.demandForecast?.institutionParticipationCount
                    ? `${ipo.demandForecast.institutionParticipationCount.toLocaleString()}곳`
                    : null
                }
                fallback={demandFallback}
              />
              <Value
                label="상단 이상 주문 비율"
                value={ipo.demandForecast?.upperBandOrAboveOrderRatio}
                fallback={demandFallback}
              />
              <Value
                label="상단 이상 참여기관 수"
                value={
                  ipo.demandForecast?.upperBandOrAboveInstitutionCount
                    ? `${ipo.demandForecast.upperBandOrAboveInstitutionCount.toLocaleString()}곳`
                    : null
                }
                fallback={demandFallback}
              />
              <Value
                label="의무보유확약 신청수량·비율"
                value={ipo.demandForecast?.lockupCompetitionRate ?? ipo.lockupRatio}
                fallback={demandFallback}
              />
              <Value
                label="의무보유확약 기관 비율"
                value={ipo.demandForecast?.lockupInstitutionRatio ?? ipo.lockupRatio}
                fallback={demandFallback}
              />
              <Value
                label="수요예측 일정 / 환불일"
                value={
                  [
                    ipo.demandForecastDate ? `수요예측 ${ipo.demandForecastDate}` : null,
                    ipo.refundDate ? `환불 ${ipo.refundDate}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
              <Value
                label="최소 청약 (증거금 50%)"
                value={
                  ipo.minSubscriptionShares && ipo.minSubscriptionDeposit
                    ? `${ipo.minSubscriptionShares}주 · ${formatAmountCompact(ipo.minSubscriptionDeposit)}원${
                        !ipo.confirmedPrice ? " (희망상단 기준)" : ""
                      }`
                    : null
                }
              />
            </section>

            {ipo.aiAnalysis && (
              <section className="card ipo-detail-section">
                <h2>AI 청약 판단</h2>
                <p className="ipo-detail-lead">{ipo.aiAnalysis.oneLiner}</p>
                <div className="ipo-detail-columns">
                  <div>
                    <h3>긍정 요인</h3>
                    <ul>
                      {ipo.aiAnalysis.strengths.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>주의할 점</h3>
                    <ul>
                      {ipo.aiAnalysis.cautions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <small className="muted">
                  AI 분석 생성 시각: 실시간 반영 · 데이터 기준일: 공시 접수일 {ipo.receiptDate || "최신"}
                </small>
              </section>
            )}

            <section className="card ipo-detail-section">
              <h2>기업 정보</h2>
              <div className="ipo-detail-grid">
                <Value label="주력 분야" value={ipo.companyInfo?.sector} />
                <Value label="대표자" value={ipo.companyInfo?.ceo} />
                <Value
                  label={ipo.companyInfo?.establishedDate ? "설립일" : "본사 소재지"}
                  value={ipo.companyInfo?.establishedDate ?? ipo.companyInfo?.address ?? ipo.companyInfo?.phone}
                />
                <Value label="기업 구분" value={ipo.companyInfo?.companySize} />
                <Value label="최근 매출" value={ipo.companyInfo?.revenue} />
                <Value label="최근 순이익" value={ipo.companyInfo?.profit} />
                <Value
                  label="홈페이지"
                  value={
                    ipo.companyInfo?.homepage ? (
                      <a href={ipo.companyInfo.homepage} target="_blank" rel="noreferrer">
                        홈페이지 열기 ↗
                      </a>
                    ) : (
                      ipo.companyInfo?.phone ?? "비공개"
                    )
                  }
                />
              </div>
              <div className="ipo-detail-summary">
                <strong>주력 상품·서비스 및 사업 현황</strong>
                <p>
                  {ipo.companyInfo?.products ??
                    ipo.companyInfo?.summary ??
                    ipo.aiAnalysis?.businessSummary ??
                    `${ipo.corpName}은(는) ${ipo.companyInfo?.sector ?? "공시 업종"} 분야의 주력 제품 및 솔루션을 공급하는 기업입니다.`}
                </p>
              </div>
            </section>

            <section className="card ipo-detail-section">
              <h2>재무·지분 정보</h2>
              <div className="ipo-detail-grid">
                <Value label="최근 매출" value={ipo.companyInfo?.revenue} />
                <Value label="최근 순이익" value={ipo.companyInfo?.profit} />
                <Value label="자본금" value={ipo.companyInfo?.capital} />
                <Value label="대표자" value={ipo.companyInfo?.ceo} />
              </div>
              {ipo.companyInfo?.financialHistory?.length ? (
                <div className="ipo-financial-list">
                  {ipo.companyInfo.financialHistory.map((row) => (
                    <div key={row.year}>
                      <strong>{row.year}</strong>
                      <span>매출 {row.revenue ?? "-"}</span>
                      <span>영업/세전이익 {row.operatingProfit ?? "-"}</span>
                      <span>순이익 {row.netProfit ?? "-"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ipo-detail-summary">
                  현재 공시에서 확인된 최신 재무 수치를 우선 표시하고 있습니다.
                </p>
              )}
              {ipo.companyInfo?.executiveHoldings?.length ? (
                <div className="ipo-financial-list">
                  {ipo.companyInfo.executiveHoldings.map((item, idx) => (
                    <div key={`${item.name}-${idx}`}>
                      <strong>{item.name}</strong>
                      <span>{item.role ?? "주요주주"}</span>
                      <span>공모후 보유 {item.shares ?? "-"}</span>
                      <span>지분율 {item.ownershipRate ?? "-"}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="card ipo-detail-section">
              <h2>증권사별 청약 정보</h2>
              <div className="ipo-underwriter-list">
                {ipo.underwriterAllocations.map((item) => (
                  <div key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{item.role ?? "공동 주관"}</span>
                    <span>
                      배정{" "}
                      {item.retailShares || item.shares
                        ? formatSharesCompact(item.retailShares ?? item.shares)
                        : "배정물량 공고 예정"}
                    </span>
                    <span>
                      최소 증거금{" "}
                      {item.minSubscriptionDeposit !== null && item.minSubscriptionDeposit !== undefined
                        ? `${formatAmountCompact(item.minSubscriptionDeposit)}원`
                        : "공고 확인"}
                    </span>
                    <span>청약 한도 {item.subscriptionLimit ?? "일반청약 배정물량 내"}</span>
                    <span>계좌개설 마감 {item.accountOpeningDeadline ?? "청약 초일 전일까지 권장"}</span>
                    <span>청약 수수료 {item.subscriptionFee ?? "온라인 2,000원 (등급별 면제)"}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card ipo-detail-section ipo-detail-secondary">
              <h2>공모·공시 정보</h2>
              <div className="ipo-detail-grid">
                <Value
                  label="공모 구조 및 유통가능물량"
                  value={
                    ipo.companyInfo?.offeringUse ??
                    (ipo.totalShares ? `총 공모주식수 ${ipo.totalShares.toLocaleString()}주 (100% 공모)` : null)
                  }
                />
                <Value label="비교 기업·예상 시가총액" value={peerAndMarketCap} fallback="수요예측 후 확정" />
                <Value
                  label="최근 증권신고서 공시"
                  value={ipo.companyInfo?.correctionNotice ?? `${ipo.receiptDate} 증권신고서(지분증권) 접수`}
                />
                <Value label="상장 예정일" value={ipo.estimatedListingDate} fallback="거래소 일정 협의 중" />
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
