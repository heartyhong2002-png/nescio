export type Market = "KOSPI" | "KOSDAQ";

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

export type Analysis = {
  stock: Stock;
  price: Price;
  news: NewsItem[];
  briefing: Briefing;
  generatedAt: string;
};
