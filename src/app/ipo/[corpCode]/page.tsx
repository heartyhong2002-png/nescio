"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { formatAmountCompact, formatPrice, formatSharesCompact } from "@/lib/format";
import { IpoInfo } from "@/lib/types";

function Value({ label, value }: { label: string; value: ReactNode }) {
  return <div className="ipo-detail-value"><span>{label}</span><strong>{value === null || value === undefined || value === "" ? "자료 준비 중" : value}</strong></div>;
}

export default function IpoDetailPage({ params }: { params: Promise<{ corpCode: string }> }) {
  const [ipo, setIpo] = useState<IpoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(({ corpCode }) => fetch("/api/ipos").then((res) => res.json()).then((data) => {
      const found = Array.isArray(data.ipos) ? data.ipos.find((item: IpoInfo) => item.corpCode === decodeURIComponent(corpCode)) : null;
      if (!found) setError("공모주 정보를 찾지 못했습니다.");
      setIpo(found ?? null);
    }).catch(() => setError("공모주 정보를 불러오지 못했습니다.")).finally(() => setLoading(false)));
  }, [params]);

  return <AppShell variant="intelligence"><div className="ipo-intelligence ipo-detail-page">
    <Link href="/ipo" className="ipo-detail-back">← 공모주 목록으로</Link>
    {loading && <div className="placeholder-box">공모주 상세 정보를 불러오는 중이에요.</div>}
    {!loading && error && <div className="error-box">{error}</div>}
    {!loading && ipo && <>
      <header className="ipo-detail-hero">
        <div><div className="eyebrow ipo-eyebrow">IPO DETAIL</div><h1>{ipo.corpName}</h1><p>{ipo.companyInfo?.sector ?? "업종 정보 준비 중"} · {ipo.leadUnderwriter ?? "대표 주관사 정보 준비 중"}</p></div>
        {ipo.aiAnalysis && <span className="pill filled">🤖 {ipo.aiAnalysis.verdictLabel} · {ipo.aiAnalysis.score}점</span>}
      </header>

      <section className="ipo-detail-grid ipo-detail-primary"><Value label="청약 기간" value={ipo.subscriptionStart && ipo.subscriptionEnd ? `${ipo.subscriptionStart} ~ ${ipo.subscriptionEnd}` : null} /><Value label="공모가" value={ipo.confirmedPrice ? `${formatPrice(ipo.confirmedPrice)}원` : ipo.hopePriceBand} /><Value label="기관 경쟁률" value={ipo.institutionCompetitionRate} /><Value label="의무보유확약" value={ipo.lockupRatio} /><Value label="최소 청약" value={ipo.minSubscriptionShares ? `${ipo.minSubscriptionShares}주 · ${formatAmountCompact(ipo.minSubscriptionDeposit)}원` : null} /></section>

      {ipo.aiAnalysis && <section className="card ipo-detail-section"><h2>AI 청약 판단</h2><p className="ipo-detail-lead">{ipo.aiAnalysis.oneLiner}</p><div className="ipo-detail-columns"><div><h3>긍정 요인</h3><ul>{ipo.aiAnalysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>주의할 점</h3><ul>{ipo.aiAnalysis.cautions.map((item) => <li key={item}>{item}</li>)}</ul></div></div><small className="muted">AI 분석 생성 시각: 분석 요청 시점 · 데이터 기준일: 증권신고서 접수일 {ipo.receiptDate || "자료 준비 중"}</small></section>}

      <section className="card ipo-detail-section"><h2>기업 정보</h2><div className="ipo-detail-grid"><Value label="대표자" value={ipo.companyInfo?.ceo} /><Value label="설립일" value={ipo.companyInfo?.establishedDate} /><Value label="기업 구분" value={ipo.companyInfo?.companySize} /><Value label="최근 매출" value={ipo.companyInfo?.revenue} /><Value label="최근 순이익" value={ipo.companyInfo?.profit} /><Value label="홈페이지" value={ipo.companyInfo?.homepage ? <a href={ipo.companyInfo.homepage} target="_blank" rel="noreferrer">홈페이지 열기 ↗</a> : null} /></div>{ipo.companyInfo?.summary && <p className="ipo-detail-summary">{ipo.companyInfo.summary}</p>}</section>

      <section className="card ipo-detail-section"><h2>증권사별 청약 정보</h2><div className="ipo-underwriter-list">{ipo.underwriterAllocations.map((item) => <div key={item.name}><strong>{item.name}</strong><span>{item.role ?? "공동 주관"}</span><span>배정 {formatSharesCompact(item.retailShares ?? item.shares)}</span><span>청약 한도 {item.subscriptionLimit ?? "자료 준비 중"}</span><span>수수료 자료 준비 중</span></div>)}</div></section>

      <section className="card ipo-detail-section ipo-detail-secondary"><h2>추가 공시 정보</h2><div className="ipo-detail-grid"><Value label="공모자금 사용처" value="증권신고서 세부 내역 연동 예정" /><Value label="비교 기업·예상 시가총액" value="자료 연동 예정" /><Value label="최근 정정 공시" value="공시 이력 연동 예정" /><Value label="상장 예정일" value={ipo.estimatedListingDate} /></div></section>
    </>}
  </div></AppShell>;
}
