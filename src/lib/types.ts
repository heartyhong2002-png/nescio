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
  source?: string;
  language?: string;
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
// 증권신고서의 "인수인정보" 그룹 한 행 — 주관사별 배정(인수)주식수 등 청약 전 미리 알 수 있는
// 정보. 실제 청약 결과(수요예측 경쟁률 등)는 DART 구조화 API에 없어 여기 포함하지 않는다.
export type UnderwriterAllocation = {
  name: string; // 증권사명
  role: string | null; // 대표/공동 등 인수인구분
  shares: number | null; // 배정(인수)주식수
  percentage: number | null; // 공모주식수 대비 인수 비율 (%)
  retailShares: number | null; // 일반청약자 배정물량 (통상 25% 추정 또는 확정치)
  equalShares: number | null; // 균등배정 예상물량 (일반청약자의 50%)
  proportionalShares: number | null; // 비례배정 예상물량 (일반청약자의 50%)
  subscriptionLimit?: string | null; // 최고 청약한도 (예: "15,000 ~ 18,000주")
};

export type CompanyInfo = {
  summary?: string | null; // 기업 개요 및 주요 비즈니스 모델 설명
  sector?: string | null; // 업종 (예: 방송장비 제조업, 응용 소프트웨어 개발 등)
  ceo?: string | null; // 대표자
  companySize?: string | null; // 기업구분 (예: 중소일반, 벤처기업 등)
  homepage?: string | null; // 공식 웹사이트 URL
  phone?: string | null; // 대표 전화번호
  address?: string | null; // 본사 소재지
  establishedDate?: string | null; // 설립일
  revenue?: string | null; // 최근 매출액 (예: "46,644 (백만원)")
  profit?: string | null; // 최근 순이익 또는 세전이익 (예: "5,157 (백만원)")
  capital?: string | null; // 자본금 (예: "876 (백만원)")
};

export type IpoAiAnalysis = {
  verdict: "STRONG_APPLY" | "APPLY" | "NEUTRAL" | "PASS";
  verdictLabel: string; // "적극 청약 추천" | "청약 추천" | "중립 (균등만 소액)" | "청약 패스 권고"
  score: number; // 0 ~ 100점
  oneLiner: string; // 한 줄 진단 요약
  businessSummary?: string; // 기업의 주요 제품/서비스 및 핵심 비즈니스 요약
  strengths: string[]; // 긍정 요인 (호재)
  cautions: string[]; // 주의 요인 (리스크)
  strategy: string; // 맞춤형 청약 전략 가이드
};

export type IpoInfo = {
  corpCode: string; // DART 고유번호 (8자리) 또는 임시 식별자
  corpName: string;
  subscriptionStart: string | null; // YYYY-MM-DD
  subscriptionEnd: string | null;
  refundDate: string | null; // 환불일/배정공고일 (YYYY-MM-DD)
  paymentDate: string | null; // 납입기일 (YYYY-MM-DD)
  offerPriceMin: number | null; // 원
  offerPriceMax: number | null;
  confirmedPrice: number | null; // 확정 공모가 (원)
  hopePriceBand: string | null; // 희망 공모가 밴드 (예: "16,500 ~ 19,500원")
  institutionCompetitionRate: string | null; // 기관 수요예측 경쟁률 (예: "1187.74:1")
  lockupRatio: string | null; // 의무보유확약 비율 (예: "21.75%")
  subscriptionCompetitionRate: string | null; // 일반 청약 경쟁률 (예: "1375.34:1")
  minSubscriptionShares?: number | null; // 최소 청약 단위 (보통 10주 또는 20주)
  minSubscriptionDeposit: number | null; // 최소 청약 시 필요 증거금 (원, 50% 기준)
  estimatedListingDate: string | null; // YYYY-MM-DD, 추정값
  leadUnderwriter: string | null; // 대표 주관사 (요약 표시용 — "유진증권(대표) · 미래에셋증권(공동)")
  underwriterAllocations: UnderwriterAllocation[]; // 증권사별 배정주식수 상세
  totalShares: number | null; // 공모주식수
  offerAmount: number | null; // 공모총액(원)
  lockupNote: string | null; // 의무보유확약 등 참고사항 요약
  receiptDate: string; // 증권신고서 접수일 (YYYY-MM-DD) — 정렬/캐시 키 보조용
  companyInfo?: CompanyInfo | null; // 기업 기본정보 (업종, 대표자, 재무현황 등)
  aiAnalysis?: IpoAiAnalysis | null; // LLM 기반 청약 AI 진단 결과
};

export type IpoListingItem = {
  name: string; // 종목명
  listingDate: string; // YYYY/MM/DD
  currentPrice: number | null; // 현재가
  changeRate: string | null; // 전일비 (%)
  offerPrice: number | null; // 공모가 (원)
  openPrice: number | null; // 시초가 (원)
  openReturnRate: string | null; // 시초가 대비 공모가 수익률 (예: "+125.6%")
  firstDayClose: number | null; // 상장 첫날 종가 (원)
  firstDayReturnRate: string | null; // 첫날 종가 기준 공모가 대비 수익률 (예: "+300.0%")
  isUpcoming: boolean; // 상장 예정 여부
  badge?: "TRIPLE" | "DOUBLE" | "PROFIT" | "LOSS" | "UPCOMING"; // 성적 뱃지
};

export type IpoMarketStats = {
  totalCount: number; // 2026년 상장 종목 수
  avgOpenReturn: string; // 평균 시초가 수익률 (+125.6%)
  avgFirstDayReturn: string; // 평균 첫날 종가 수익률 (+78.8%)
  tripleCount: number; // 따따블 (+300%) 종목 수
  doubleCount: number; // 따블 이상 (100%+) 종목 수
  lossCount: number; // 공모가 하회 (손실) 종목 수
};

export type IpoListingsData = {
  upcoming: IpoListingItem[];
  history: IpoListingItem[];
  stats: IpoMarketStats;
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

// 코스피/코스닥/해외 대표지수 — 종목이 아니라 시장 전체 흐름을 보여주는 용도.
export type MarketIndex = {
  name: "코스피" | "코스닥" | "니케이225" | "상해종합" | "심천종합" | "항셍지수";
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
