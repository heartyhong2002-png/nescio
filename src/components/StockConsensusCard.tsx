"use client";

import { memo, useEffect, useState } from "react";
import type { StockConsensus } from "@/lib/consensus-types";

type ConsensusState = { ticker: string; data: StockConsensus | null; error: boolean };

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export const StockConsensusCard = memo(function StockConsensusCard({ ticker }: { ticker: string }) {
  const [state, setState] = useState<ConsensusState>({ ticker: "", data: null, error: false });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/stock/${encodeURIComponent(ticker)}/consensus`);
        if (!response.ok) throw new Error("컨센서스를 불러오지 못했습니다.");
        const data = (await response.json()) as StockConsensus;
        if (!cancelled) setState({ ticker, data, error: false });
      } catch {
        if (!cancelled) setState({ ticker, data: null, error: true });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [ticker]);

  const current = state.ticker === ticker ? state : null;
  const reports = current?.data?.reports ?? [];
  const analysis = current?.data?.aiAnalysis;
  const targets = reports.map((report) => report.targetPrice).filter((value): value is number => value !== null && value > 0);
  const averageTarget = targets.length ? Math.round(targets.reduce((sum, value) => sum + value, 0) / targets.length) : null;
  const latestDate = reports.map((report) => report.writeDate).sort().at(-1);

  return (
    <section className="stock-consensus-panel" aria-labelledby="stock-consensus-title">
      <div className="stock-consensus-head">
        <div>
          <h2 id="stock-consensus-title">증권사 리서치 컨센서스</h2>
          <p>공개된 증권사 리포트의 목표가와 의견을 모았어요</p>
        </div>
        {latestDate && <span className="stock-consensus-updated">최근 {latestDate} 발간</span>}
      </div>

      {!current ? (
        <div className="stock-consensus-loading" role="status" aria-label="증권사 리포트 불러오는 중">
          <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
        </div>
      ) : current.error ? (
        <div className="stock-consensus-state" role="status">증권사 리포트를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</div>
      ) : reports.length === 0 ? (
        <div className="stock-consensus-state" role="status">아직 확인된 증권사 리포트가 없어요.</div>
      ) : (
        <>
          <div className="stock-consensus-summary">
            <div><span>평균 목표가</span><strong>{averageTarget === null ? "—" : won(averageTarget)}</strong><small>{targets.length}개 목표가 기준</small></div>
            <div><span>목표가 범위</span><strong>{targets.length ? `${won(Math.min(...targets))}–${won(Math.max(...targets))}` : "—"}</strong><small>최저–최고 목표가</small></div>
            <div><span>공개 리포트</span><strong>{reports.length}건</strong><small>현재 조회된 리포트</small></div>
            <div><span>최근 발간일</span><strong>{latestDate ?? "—"}</strong><small>증권사 표기 기준</small></div>
          </div>

          <div className="stock-consensus-reports">
            {reports.map((report) => {
              const href = report.attachUrl || `https://stock.naver.com/research/company/detail/${encodeURIComponent(report.nid)}`;
              return (
                <a key={report.nid} className="stock-consensus-report" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${report.brokerName} 리포트 ${report.title} 원문 새 창에서 보기`}>
                  <div className="stock-consensus-firm"><strong>{report.brokerName}</strong><span>{report.writeDate}</span></div>
                  <div className="stock-consensus-copy"><strong>{report.title}</strong>{report.content && <p>{report.content}</p>}<small>{report.opinion || "의견 미표기"}</small></div>
                  <div className="stock-consensus-target"><span>목표가</span><strong>{report.targetPrice ? won(report.targetPrice) : "미제시"}</strong>{report.prevTargetPrice && report.targetPrice && <small>이전 {won(report.prevTargetPrice)}</small>}</div>
                  <span className="stock-consensus-open" aria-hidden="true">↗</span>
                </a>
              );
            })}
          </div>

          {analysis?.summary && (
            <div className="stock-consensus-context">
              <span aria-hidden="true">✳</span>
              <div><strong>리포트 AI 요약</strong><p>{analysis.summary}</p></div>
            </div>
          )}
          <p className="stock-consensus-disclaimer">목표가와 의견은 각 증권사의 전망이며 Nescio의 의견이나 매매 권유가 아닙니다. 세부 가정은 리포트 원문을 확인하세요.</p>
        </>
      )}
    </section>
  );
});
