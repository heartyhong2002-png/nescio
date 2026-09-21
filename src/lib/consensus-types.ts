export interface AnalystReport {
  nid: string;
  title: string;
  content: string;
  brokerName: string;
  targetPrice: number | null;
  prevTargetPrice: number | null;
  opinion: string; // 예: "매수", "중립", "BUY"
  writeDate: string; // YYYY-MM-DD
  attachUrl: string | null;
}

export interface ConsensusAiReport {
  consensusScore: number; // 5점 만점
  averageTargetPrice: number; // 평균 목표주가
  upsidePercent: number; // 현재가 대비 상승 여력
  summary: string; // 3문장의 친절한 전문가 뷰 요약
  keyDrivers: string[]; // 전문가들이 주목하는 2~3가지 핵심 성장 요인/리스크 요인
}

export interface StockConsensus {
  ticker: string;
  reports: AnalystReport[];
  aiAnalysis: ConsensusAiReport | null; // 스몰캡 등 리포트 부족 시 null 처리
}
