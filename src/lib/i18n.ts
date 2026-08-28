"use client";

import { useLanguage } from "./language";

export const dict = {
  ko: {
    tagline: "관심 종목 뉴스 맥락 브리핑",
    stock: {
      backToList: "← 브리핑 목록",
      inWatchlist: "★ 관심종목에 담김",
      addToWatchlist: "☆ 관심종목 담기",
      retry: "다시 시도",
      whyMoved: "가격이 움직인 이유",
      noClearCause: "뚜렷한 원인을 찾지 못했어요.",
      aiSummary: "AI가 정리해줬어요",
      todayOneLiner: "오늘 한 줄",
      metricsTitle: "회사 숫자로 보기",
      metricsFailed: "지표를 불러오지 못했어요.",
      metricsLoading: "이 숫자들 쉽게 풀어보는 중…",
      metricsInterpretedTitle: "이 숫자, 쉽게 풀면",
      noCauseData: "원인 데이터가 없어요.",
      noPriceData: "데이터 없음",
      per: "PER",
      pbr: "PBR",
      dividendYield: "배당수익률",
      marketCap: "시가총액",
      // PriceChart/`/api/price-history`가 이 정확한 한글 문자열을 그대로 range 파라미터로
      // 받아서 KIS 조회 방식을 정한다 — 언어와 무관하게 항상 이 값을 그대로 써야 한다.
      rangeKeys: ["1일", "1주", "1개월", "1년"],
      ranges: ["1일", "1주", "1개월", "1년"],
    },
    causeDetail: {
      briefingPrefix: "원인 브리핑 · ",
      question: "왜 그렇게 움직였나요?",
      inOneLine: "한 줄로 말하면",
      stepByStep: "순서대로 정리하면",
      newsCount: (n: number) => `이 이야기가 나온 뉴스 ${n}개`,
      expertsView: "전문가는 이렇게 봐요",
      bullishCount: (n: number) => `오를 것 같다 ${n}명`,
      bearishCount: (n: number) => `조심하자는 의견 ${n}명`,
      similarCase: "비슷한 일이 있었을 때",
      locale: "ko-KR",
    },
    langToggle: { label: "EN", switchTo: "영어로 보기" },
  },
  en: {
    tagline: "News context for the stocks you're watching",
    stock: {
      backToList: "← Briefing list",
      inWatchlist: "★ In watchlist",
      addToWatchlist: "☆ Add to watchlist",
      retry: "Retry",
      whyMoved: "Why the price moved",
      noClearCause: "Couldn't find a clear cause.",
      aiSummary: "AI summary",
      todayOneLiner: "Today in one line",
      metricsTitle: "The numbers behind the company",
      metricsFailed: "Couldn't load the metrics.",
      metricsLoading: "Breaking these numbers down…",
      metricsInterpretedTitle: "In plain terms",
      noCauseData: "No cause data available.",
      noPriceData: "No data",
      per: "PER",
      pbr: "PBR",
      dividendYield: "Dividend yield",
      marketCap: "Market cap",
      // 실제 API 호출에는 항상 한글 canonical 값(rangeKeys)을 쓰고, 이 ranges는
      // 버튼에 보여줄 라벨 텍스트로만 쓴다 (PriceChart/`/api/price-history` 계약 유지).
      rangeKeys: ["1일", "1주", "1개월", "1년"],
      ranges: ["1D", "1W", "1M", "1Y"],
    },
    causeDetail: {
      briefingPrefix: "Cause briefing · ",
      question: "Why did it move like this?",
      inOneLine: "In one line",
      stepByStep: "Step by step",
      newsCount: (n: number) => `${n} news stories behind this`,
      expertsView: "What experts are saying",
      bullishCount: (n: number) => `${n} bullish`,
      bearishCount: (n: number) => `${n} cautious`,
      similarCase: "When something similar happened before",
      locale: "en-US",
    },
    langToggle: { label: "한글", switchTo: "View in Korean" },
  },
} as const;

export function useI18n() {
  const { lang } = useLanguage();
  return { lang, t: dict[lang] };
}
