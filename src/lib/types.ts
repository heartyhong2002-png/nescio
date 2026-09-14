export type Market = "KOSPI" | "KOSDAQ" | "KONEX" | "ETF" | "ETN" | "WARRANT";

export type Stock = {
  name: string;
  ticker: string;
  market: Market;
};

export type WatchlistItem = Stock;

export type Persona = "beginner" | "general" | "expert";

export type SectorId =
  | "semiconductor"
  | "battery"
  | "bio"
  | "finance"
  | "auto"
  | "internet-ai"
  | "entertainment";

export type OnboardingProfile = {
  persona: Persona | null;
  sectors: SectorId[];
};

export type NewsItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
};

export type Price = {
  close: number | null;
  changeRate: number | null;
  marketCap: number | null;
};

// 한국수출입은행 환율 API — 매매기준율 기준. unit은 "100엔당" 같은 표시 단위(기본 1).
export type ExchangeRate = {
  code: string; // ISO 통화코드 (USD, JPY, EUR ...)
  name: string; // 한글 통화명 (미국 달러, 일본 엔 ...)
  unit: number; // 1 또는 100 (JPY(100) 등 소액 통화)
  rate: number; // 매매기준율 (원)
  ttb: number | null; // 전신환 매입율
  tts: number | null; // 전신환 매도율
};

// 공모주(IPO) 청약 정보 — 금융감독원 OpenDART "증권신고서(지분증권)" 공시에서 추출.
// estimatedListingDate는 공시에 없는 값이라 "청약종료일 + 2영업일"로 추정한 것 — 화면에서
// 반드시 "예상" 라벨을 붙여서 확정값이 아님을 알려야 한다.
export type IpoInfo = {
  corpCode: string; // DART 고유번호 (8자리)
  corpName: string;
  subscriptionStart: string | null; // YYYY-MM-DD
  subscriptionEnd: string | null;
  offerPriceMin: number | null; // 원
  offerPriceMax: number | null;
  estimatedListingDate: string | null; // YYYY-MM-DD, 추정값
  leadUnderwriter: string | null; // 대표 주관사
  totalShares: number | null; // 공모주식수
  offerAmount: number | null; // 공모총액(원)
  lockupNote: string | null; // 의무보유확약 등 참고사항 요약
  receiptDate: string; // 증권신고서 접수일 (YYYY-MM-DD) — 정렬/캐시 키 보조용
};

export type CauseImpact = "high" | "medium" | "low";

export type Cause = {
  id: string;
  title: string;
  impact: CauseImpact;
  summary: string;
  conclusion: string;
  timeline: { title: string; desc: string }[];
  newsIndices: number[];
  expertOpinions: {
    bullish: { count: number; summary: string };
    bearish: { count: number; summary: string };
  };
  similarCase: string;
};

export type Briefing = {
  oneLiner: string;
  causes: Cause[];
  aiComment: string;
};

export type Valuation = {
  per: number | null;
  pbr: number | null;
  eps: number | null;
  bps: number | null;
  marketCap: number | null; // 원 단위
  dividendYield: number | null; // % (최근 1년 주당 현금배당금 / 현재가)
};

// 재무지표(PER/PBR/배당/시총)를 초보자 눈높이로 풀어주는 한 줄 해설.
export type MetricNote = {
  meaning: string; // "이 숫자가 뭘 뜻하는지" 한 문장
  interpretation: string; // "그래서 비싼지/싼지/평범한지" 관점 한 문장
};

export type ValuationInterpretation = {
  per: MetricNote;
  pbr: MetricNote;
  dividend: MetricNote;
  marketCap: MetricNote;
};

// 코스피/코스닥 대표지수 — 종목이 아니라 시장 전체 흐름을 보여주는 용도.
export type MarketIndex = {
  name: "코스피" | "코스닥";
  close: number | null; // 지수 포인트
  changeRate: number | null; // %
};

export type Analysis = {
  stock: Stock;
  price: Price;
  news: NewsItem[];
  briefing: Briefing;
  generatedAt: string;
};
