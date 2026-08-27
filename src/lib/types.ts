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

export type Analysis = {
  stock: Stock;
  price: Price;
  news: NewsItem[];
  briefing: Briefing;
  generatedAt: string;
};
