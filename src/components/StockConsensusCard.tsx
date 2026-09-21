"use client";

import { useEffect, useState } from "react";
import { StockConsensus } from "@/lib/consensus-types";

export function StockConsensusCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<StockConsensus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/stock/${ticker}/consensus`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Failed to fetch consensus", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [ticker]);

  if (loading) {
    return (
      <div className="animate-pulse bg-white border border-gray-100 rounded-xl p-5 shadow-sm mt-4">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-100 rounded mb-4"></div>
        <div className="h-32 bg-gray-50 rounded"></div>
      </div>
    );
  }

  if (!data || !data.aiAnalysis) {
    return null;
  }

  const { reports, aiAnalysis } = data;
  const hasReports = reports.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mt-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📊</span>
        <h2 className="text-lg font-bold text-gray-900">증권사 전문가 컨센서스</h2>
      </div>

      {!hasReports ? (
        <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center text-center">
          <span className="text-2xl text-gray-400 mb-2">ℹ️</span>
          <p className="text-sm text-gray-600 font-medium">아직 증권사 공식 리포트가 발간되지 않은 종목이에요.</p>
          <p className="text-xs text-gray-500 mt-1">상단의 실시간 뉴스 분석을 참고해 보세요!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. 핵심 수치 요약 바 */}
          <div className="bg-indigo-50/50 rounded-lg p-4 border border-indigo-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-xs font-semibold text-indigo-600 mb-1">평균 목표가</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-gray-900">{aiAnalysis.averageTargetPrice.toLocaleString()}원</span>
                <span className={`text-sm font-medium mb-1 ${aiAnalysis.upsidePercent > 0 ? "text-red-500" : aiAnalysis.upsidePercent < 0 ? "text-blue-500" : "text-gray-500"}`}>
                  ({aiAnalysis.upsidePercent > 0 ? "+" : ""}{aiAnalysis.upsidePercent}%)
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-start sm:items-end">
              <p className="text-xs font-semibold text-gray-500 mb-1">투자의견 평점</p>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md">
                  BUY
                </span>
                <span className="text-lg font-bold text-gray-800">{aiAnalysis.consensusScore.toFixed(1)} / 5.0</span>
              </div>
            </div>
          </div>

          {/* 2. AI 3줄 요약 */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🤖</span>
              <h3 className="text-sm font-bold text-gray-800">AI 전문가 뷰 요약</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {aiAnalysis.summary}
            </p>
            {aiAnalysis.keyDrivers.length > 0 && (
              <ul className="text-xs text-gray-600 space-y-1 mt-3 pt-3 border-t border-gray-200">
                {aiAnalysis.keyDrivers.map((driver, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-indigo-500 shrink-0 mt-0.5">📌</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 3. 최근 리포트 타임라인 */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3 px-1 uppercase tracking-wider">최근 발간된 리포트</h3>
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.nid} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-700">{report.brokerName}</span>
                      <span className="text-[10px] text-gray-400">{report.writeDate}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate" title={report.title}>{report.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">목표가: <strong className="text-gray-700">{report.targetPrice ? report.targetPrice.toLocaleString() + "원" : "N/A"}</strong></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-xs font-medium text-gray-600">{report.opinion}</span>
                    </div>
                  </div>
                  {report.attachUrl && (
                    <a href={report.attachUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors shrink-0" title="PDF 원문 보기">
                      📄
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
