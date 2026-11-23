import { scrapeAnalystReports } from "./consensus-scraper";
import { fetchKisRiskSnapshot } from "./kis";
import { fetchMacroIndicators } from "./macro-data";

export type InvestorDailyTrend = {
  date: string; // YYYY-MM-DD
  foreigner: number; // 순매수 주수
  institution: number;
  individual: number;
  closePrice: number | null;
};

export type StockDisclosureItem = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  author: string;
  category: "실적/재무" | "수주/계약" | "자본/주주환원" | "지분/지배구조" | "IR/기타";
  url: string;
};

export type PeerStockItem = {
  ticker: string;
  name: string;
  closePrice: number | null;
  changeRate: number | null;
};

export type StockMultiSignals = {
  ticker: string;
  fetchedAt: string;
  // 1. 투자자별 수급 동향
  investorFlow: {
    foreignerHoldRatio: string | null;
    foreignerNet5d: number;
    institutionNet5d: number;
    individualNet5d: number;
    foreignerStreak: string;
    institutionStreak: string;
    daily: InvestorDailyTrend[];
    summary: string;
  };
  // 2. 최근 핵심 공시
  disclosures: {
    items: StockDisclosureItem[];
    summary: string;
  };
  // 3. 증권사 리포트 & 컨센서스
  consensus: {
    avgTargetPrice: number | null;
    upsidePercent: number | null;
    recommScore: number | null;
    reportCount: number;
    latestReports: Array<{
      broker: string;
      title: string;
      targetPrice: number | null;
      date: string;
      summary: string | null;
      url: string;
    }>;
    summary: string;
  };
  // 4. 기술적 위치 & 거래량 시그널
  technicals: {
    currentPrice: number | null;
    high52w: number | null;
    low52w: number | null;
    position52wPercent: number | null; // 0~100%
    drawdownFromHighPercent: number | null; // 고점 대비 %
    todayVolume: number | null;
    avgVolume20d: number | null;
    volumeRatio20d: number | null; // 20일 평균 대비 배수 (예: 1.85)
    ma5: number | null;
    ma20: number | null;
    ma20Disparity: number | null; // 20일선 이격도 (%)
    rsi14: number | null;
    summary: string;
  };
  // 5. 동종 업종(Peer) 비교 & 글로벌 매크로
  sectorAndMacro: {
    peers: PeerStockItem[];
    peerAvgChangeRate: number | null;
    relativeStatus: string;
    macroHighlights: Array<{
      name: string;
      value: string;
      changePercent: number | null;
    }>;
    summary: string;
  };
  // 6. 신용·공매도·과열 리스크 시그널
  riskAndShort: {
    marketWarning: string;
    creditBalanceRate: number | null;
    programNetBuyQty: number | null;
    turnoverRate: number | null;
    shortSellingAllowed: boolean | null;
    status: "NORMAL" | "OVERHEATED" | "OVERSOLD" | "SHORT_COVER_WATCH" | "CAUTION";
    statusLabel: string;
    checkpoints: string[];
    summary: string;
  };
};

type CacheEntry = {
  data: StockMultiSignals;
  expiresAt: number;
};

const SIGNAL_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3분 캐시

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

function toNum(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function formatSignedShares(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) {
    return `${sign}${(abs / 10000).toFixed(1).replace(/\.0$/, "")}만주`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")}주`;
}

function calcStreak(values: number[]): string {
  if (values.length === 0) return "중립";
  const first = values[0];
  if (first === 0) return "보합";
  const isBuy = first > 0;
  let count = 0;
  for (const v of values) {
    if ((isBuy && v > 0) || (!isBuy && v < 0)) count += 1;
    else break;
  }
  return `${count}일 연속 ${isBuy ? "순매수" : "순매도"}`;
}

function classifyDisclosure(title: string): StockDisclosureItem["category"] {
  if (/잠정\s*실적|매출액|손익구조|감사보고서|사업보고서|반기보고서|분기보고서|연결재무/.test(title)) {
    return "실적/재무";
  }
  if (/단일판매|공급계약|수주|투자판단|특허|양수|양도|시설투자|타법인/.test(title)) {
    return "수주/계약";
  }
  if (/유상증자|무상증자|전환사채|신주인수권|교환사채|자기주식|자사주|소각|배당|감자/.test(title)) {
    return "자본/주주환원";
  }
  if (/최대주주|대량보유|임원ㆍ주요주주|소유상황|특수관계인/.test(title)) {
    return "지분/지배구조";
  }
  return "IR/기타";
}

function calculateRsi14(closesNewestFirst: number[]): number | null {
  if (closesNewestFirst.length < 15) return null;
  const chronological = [...closesNewestFirst.slice(0, 15)].reverse();
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < chronological.length; i++) {
    const diff = chronological[i] - chronological[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

export async function fetchStockMultiSignals(
  ticker: string,
  currentPriceHint?: number | null,
  currentChangeRateHint?: number | null,
): Promise<StockMultiSignals> {
  const cached = SIGNAL_CACHE.get(ticker);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 모든 독립 데이터 소스를 병렬로 수집 (하나라도 실패해도 나머지는 100% 정상 동작)
  const [integrationRes, priceListRes, disclosureRes, analystReports, kisRisk, macroList] = await Promise.all([
    fetch(`https://m.stock.naver.com/api/stock/${encodeURIComponent(ticker)}/integration`, {
      headers: NAVER_HEADERS,
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${encodeURIComponent(ticker)}/price?pageSize=20&page=1`, {
      headers: NAVER_HEADERS,
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`https://m.stock.naver.com/api/stock/${encodeURIComponent(ticker)}/disclosure?pageSize=8&page=1`, {
      headers: NAVER_HEADERS,
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    scrapeAnalystReports(ticker).catch(() => []),
    fetchKisRiskSnapshot(ticker).catch(() => null),
    fetchMacroIndicators().catch(() => []),
  ]);

  // -------------------------------------------------------------------------
  // 1. 투자자별 수급 동향 (외국인·기관·개인 최근 5영업일)
  // -------------------------------------------------------------------------
  const rawTrends = Array.isArray(integrationRes?.dealTrendInfos) ? integrationRes.dealTrendInfos.slice(0, 5) : [];
  const dailyTrends: InvestorDailyTrend[] = rawTrends.map((row: Record<string, unknown>) => {
    const rawDate = String(row.bizdate ?? "");
    const date =
      rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;
    return {
      date,
      foreigner: toNum(row.foreignerPureBuyQuant) ?? 0,
      institution: toNum(row.organPureBuyQuant) ?? 0,
      individual: toNum(row.individualPureBuyQuant) ?? 0,
      closePrice: toNum(row.closePrice),
    };
  });

  const foreignerHoldRatio =
    typeof rawTrends[0]?.foreignerHoldRatio === "string" ? rawTrends[0].foreignerHoldRatio : null;
  const foreignerNet5d = dailyTrends.reduce((acc, d) => acc + d.foreigner, 0);
  const institutionNet5d = dailyTrends.reduce((acc, d) => acc + d.institution, 0);
  const individualNet5d = dailyTrends.reduce((acc, d) => acc + d.individual, 0);
  const foreignerStreak = calcStreak(dailyTrends.map((d) => d.foreigner));
  const institutionStreak = calcStreak(dailyTrends.map((d) => d.institution));

  const investorSummary =
    dailyTrends.length > 0
      ? `최근 5거래일 외국인 ${formatSignedShares(foreignerNet5d)}(${foreignerStreak}) · 기관 ${formatSignedShares(
          institutionNet5d,
        )}(${institutionStreak}) · 개인 ${formatSignedShares(individualNet5d)}${
          foreignerHoldRatio ? ` · 외인지분율 ${foreignerHoldRatio}` : ""
        }`
      : "최근 투자자별 수급 집계 데이터가 없습니다.";

  // -------------------------------------------------------------------------
  // 2. 최근 핵심 공시
  // -------------------------------------------------------------------------
  const rawDisclosures = Array.isArray(disclosureRes) ? disclosureRes.slice(0, 6) : [];
  const disclosureItems: StockDisclosureItem[] = rawDisclosures.map((d: Record<string, unknown>) => {
    const title = String(d.title ?? "").trim();
    const dt = String(d.datetime ?? "").slice(0, 10);
    const id = String(d.disclosureId ?? "");
    return {
      id,
      title,
      date: dt,
      author: String(d.author ?? "공시"),
      category: classifyDisclosure(title),
      url: id
        ? `https://m.stock.naver.com/domestic/stock/${encodeURIComponent(ticker)}/notice/${encodeURIComponent(id)}`
        : `https://dart.fss.or.kr`,
    };
  });

  const disclosureSummary =
    disclosureItems.length > 0
      ? disclosureItems
          .slice(0, 3)
          .map((d) => `[${d.category}] ${d.title} (${d.date})`)
          .join(" / ")
      : "최근 30일 내 주요 특이 공시가 없습니다.";

  // -------------------------------------------------------------------------
  // 4. 기술적 위치 & 거래량 시그널 (3번 컨센서스 괴리율 계산을 위해 현재가를 먼저 확정)
  // -------------------------------------------------------------------------
  const totalInfos: Array<{ key?: string; value?: string }> = Array.isArray(integrationRes?.totalInfos)
    ? integrationRes.totalInfos
    : [];
  const findTotalInfo = (k: string) => totalInfos.find((item) => item.key === k)?.value;

  const high52w = toNum(findTotalInfo("52주 최고"));
  const low52w = toNum(findTotalInfo("52주 최저"));

  const priceRows = Array.isArray(priceListRes) ? priceListRes : [];
  const closes: number[] = [];
  const volumes: number[] = [];
  let latestChangeRate: number | null = currentChangeRateHint ?? null;

  for (let i = 0; i < priceRows.length; i++) {
    const row = priceRows[i] as Record<string, unknown>;
    const c = toNum(row.closePrice);
    const v = toNum(row.accumulatedTradingVolume);
    if (c !== null && c > 0) closes.push(c);
    if (v !== null && v >= 0) volumes.push(v);
    if (i === 0 && latestChangeRate === null) {
      latestChangeRate = toNum(row.fluctuationsRatio);
    }
  }

  const currentPrice = currentPriceHint ?? closes[0] ?? dailyTrends[0]?.closePrice ?? null;
  const todayVolume = volumes[0] ?? toNum(findTotalInfo("거래량")) ?? null;
  const avgVolume20d =
    volumes.length >= 5 ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;
  const volumeRatio20d =
    todayVolume !== null && avgVolume20d && avgVolume20d > 0
      ? Math.round((todayVolume / avgVolume20d) * 100) / 100
      : null;

  const ma5 = closes.length >= 5 ? Math.round(closes.slice(0, 5).reduce((a, b) => a + b, 0) / 5) : null;
  const ma20 = closes.length >= 15 ? Math.round(closes.reduce((a, b) => a + b, 0) / closes.length) : null;
  const ma20Disparity =
    currentPrice && ma20 && ma20 > 0 ? Math.round(((currentPrice - ma20) / ma20) * 1000) / 10 : null;

  const position52wPercent =
    currentPrice && high52w && low52w && high52w > low52w
      ? Math.max(0, Math.min(100, Math.round(((currentPrice - low52w) / (high52w - low52w)) * 100)))
      : null;

  const drawdownFromHighPercent =
    currentPrice && high52w && high52w > 0
      ? Math.round(((currentPrice - high52w) / high52w) * 1000) / 10
      : null;

  const rsi14 = calculateRsi14(closes);

  const techParts: string[] = [];
  if (volumeRatio20d !== null) {
    techParts.push(
      `20일 평균 대비 거래량 ${volumeRatio20d}배(${
        volumeRatio20d >= 2 ? "거래량 급증" : volumeRatio20d <= 0.6 ? "거래량 감소" : "평년 수준"
      })`,
    );
  }
  if (position52wPercent !== null) {
    techParts.push(`52주 가격밴드 하위 ${position52wPercent}% 위치(고점 대비 ${drawdownFromHighPercent}%)`);
  }
  if (ma20Disparity !== null) {
    techParts.push(`20일 이평선 대비 ${ma20Disparity > 0 ? `+${ma20Disparity}% 상회` : `${ma20Disparity}% 하회`}`);
  }
  if (rsi14 !== null) {
    techParts.push(`RSI(14) ${rsi14}(${rsi14 >= 70 ? "과매수" : rsi14 <= 30 ? "과매도" : "중립"})`);
  }
  const techSummary = techParts.length > 0 ? techParts.join(" · ") : "기술적 가격·거래량 지표 집계 중";

  // -------------------------------------------------------------------------
  // 3. 증권사 리포트 & 목표주가 컨센서스
  // -------------------------------------------------------------------------
  const validTargets = analystReports.map((r) => r.targetPrice).filter((p): p is number => p !== null && p > 0);
  const naverTargetMean = toNum(integrationRes?.consensusInfo?.priceTargetMean);
  const avgTargetPrice =
    validTargets.length > 0
      ? Math.round(validTargets.reduce((a, b) => a + b, 0) / validTargets.length)
      : naverTargetMean;

  const upsidePercent =
    avgTargetPrice && currentPrice && currentPrice > 0
      ? Math.round(((avgTargetPrice - currentPrice) / currentPrice) * 1000) / 10
      : null;

  const recommScore = toNum(integrationRes?.consensusInfo?.recommMean);
  const latestReports = analystReports.slice(0, 3).map((r) => ({
    broker: r.brokerName,
    title: r.title,
    targetPrice: r.targetPrice,
    date: r.writeDate,
    summary: r.content || null,
    url: r.attachUrl || `https://finance.naver.com/research/company_read.naver?nid=${encodeURIComponent(r.nid)}`,
  }));

  const consensusSummary =
    avgTargetPrice !== null
      ? `평균 목표주가 ${avgTargetPrice.toLocaleString("ko-KR")}원(${
          upsidePercent !== null ? `현재가 대비 괴리율 ${upsidePercent > 0 ? `+${upsidePercent}%` : `${upsidePercent}%`}` : ""
        })` +
        (latestReports.length > 0
          ? ` · 최신 리포트: ${latestReports.map((r) => `${r.broker} "${r.title}"`).join(", ")}`
          : "")
      : "최근 3개월 내 제시된 증권사 목표주가 컨센서스가 없습니다.";

  // -------------------------------------------------------------------------
  // 5. 동종 업종(Peer) 비교 & 글로벌 매크로 연동
  // -------------------------------------------------------------------------
  const rawPeers = Array.isArray(integrationRes?.industryCompareInfo) ? integrationRes.industryCompareInfo : [];
  const peers: PeerStockItem[] = rawPeers
    .filter((p: Record<string, unknown>) => String(p.itemCode ?? "") !== ticker)
    .slice(0, 4)
    .map((p: Record<string, unknown>) => {
      let rate = toNum(p.fluctuationsRatio);
      const code = (p.compareToPreviousPrice as { code?: string } | undefined)?.code;
      if ((code === "4" || code === "5") && rate !== null && rate > 0) {
        rate = -rate;
      }
      return {
        ticker: String(p.itemCode ?? ""),
        name: String(p.stockName ?? ""),
        closePrice: toNum(p.closePrice),
        changeRate: rate,
      };
    });

  const peerRates = peers.map((p) => p.changeRate).filter((r): r is number => r !== null);
  const peerAvgChangeRate =
    peerRates.length > 0 ? Math.round((peerRates.reduce((a, b) => a + b, 0) / peerRates.length) * 100) / 100 : null;

  let relativeStatus = "업종 평균 수준";
  if (latestChangeRate !== null && peerAvgChangeRate !== null) {
    const diff = latestChangeRate - peerAvgChangeRate;
    if (latestChangeRate > 0.5 && peerAvgChangeRate > 0.5) relativeStatus = "동종 업종 동반 강세";
    else if (latestChangeRate < -0.5 && peerAvgChangeRate < -0.5) relativeStatus = "동종 업종 동반 약세";
    else if (diff >= 1.5) relativeStatus = "업종 대비 독자 강세 (아웃퍼폼)";
    else if (diff <= -1.5) relativeStatus = "업종 대비 상대 약세 (언더퍼폼)";
  }

  const keyTickers = ["^NDX", "^SOX", "^TNX", "DX-Y.NYB", "CL=F", "^VIX"];
  const macroHighlights = macroList
    .filter((m) => keyTickers.includes(m.ticker) && m.price !== null)
    .map((m) => ({
      name: m.name,
      value: `${m.price?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      changePercent: m.changePercent !== null ? Math.round(m.changePercent * 100) / 100 : null,
    }));

  const peerSummaryText =
    peers.length > 0
      ? `동종업종 비교(${relativeStatus}, 평균 ${
          peerAvgChangeRate !== null ? `${peerAvgChangeRate > 0 ? "+" : ""}${peerAvgChangeRate}%` : "-"
        }): ${peers
          .map((p) => `${p.name}(${p.changeRate !== null ? `${p.changeRate > 0 ? "+" : ""}${p.changeRate}%` : "-"})`)
          .join(", ")}`
      : "동종업종 비교 데이터 없음";

  // -------------------------------------------------------------------------
  // 6. 신용·공매도·수급과열 리스크 시그널
  // -------------------------------------------------------------------------
  const marketWarning = kisRisk?.marketWarning ?? "정상";
  const creditBalanceRate = kisRisk?.creditBalanceRate ?? null;
  const programNetBuyQty = kisRisk?.programNetBuyQty ?? null;
  const turnoverRate = kisRisk?.turnoverRate ?? null;
  const shortSellingAllowed = kisRisk?.shortSellingAllowed ?? null;

  const checkpoints: string[] = [];
  if (marketWarning !== "정상") checkpoints.push(`거래소 시장경보: ${marketWarning}`);
  if (creditBalanceRate !== null) {
    checkpoints.push(
      `신용융자 잔고율 ${creditBalanceRate.toFixed(2)}% (${
        creditBalanceRate >= 5 ? "높음·반대매매 주의" : creditBalanceRate >= 3 ? "보통" : "안정적"
      })`,
    );
  }
  if (programNetBuyQty !== null && programNetBuyQty !== 0) {
    checkpoints.push(`당일 프로그램 ${formatSignedShares(programNetBuyQty)}`);
  }
  if (turnoverRate !== null) {
    checkpoints.push(`거래량 회전율 ${turnoverRate.toFixed(2)}%`);
  }
  if (volumeRatio20d !== null && volumeRatio20d >= 2.0) {
    checkpoints.push(`평소 대비 거래량 ${volumeRatio20d}배 폭발 (단기 수급 쏠림)`);
  }
  if (rsi14 !== null && rsi14 >= 70) {
    checkpoints.push(`RSI ${rsi14} 단기 과매수 구간 진입`);
  } else if (rsi14 !== null && rsi14 <= 30) {
    checkpoints.push(`RSI ${rsi14} 단기 과매도 구간 진입`);
  }
  if (foreignerNet5d > 0 && institutionNet5d > 0) {
    checkpoints.push("최근 5일 외인·기관 양매수 유입");
  } else if (foreignerNet5d < 0 && institutionNet5d < 0) {
    checkpoints.push("최근 5일 외인·기관 동반 순매도 압력");
  }

  let riskStatus: StockMultiSignals["riskAndShort"]["status"] = "NORMAL";
  let statusLabel = "수급·변동성 안정";

  if (marketWarning !== "정상" || (rsi14 !== null && rsi14 >= 75) || (volumeRatio20d !== null && volumeRatio20d >= 3.0)) {
    riskStatus = "OVERHEATED";
    statusLabel = "단기 과열 · 변동성 확대 주의";
  } else if (rsi14 !== null && rsi14 <= 32) {
    riskStatus = "OVERSOLD";
    statusLabel = "단기 과매도 · 기술적 반등 모색";
  } else if (
    (latestChangeRate ?? 0) >= 3.0 &&
    dailyTrends.length >= 2 &&
    dailyTrends[0].foreigner > 0 &&
    dailyTrends[1].foreigner < 0
  ) {
    riskStatus = "SHORT_COVER_WATCH";
    statusLabel = "외인 매수 전환 · 숏커버링 유입 주시";
  } else if ((creditBalanceRate ?? 0) >= 5.0 || (foreignerNet5d < 0 && institutionNet5d < 0)) {
    riskStatus = "CAUTION";
    statusLabel = "메이저 수급 이탈 · 리스크 관리";
  }

  const riskSummary = `${statusLabel}${checkpoints.length > 0 ? ` (${checkpoints.join(" · ")})` : ""}`;

  const result: StockMultiSignals = {
    ticker,
    fetchedAt: new Date().toISOString(),
    investorFlow: {
      foreignerHoldRatio,
      foreignerNet5d,
      institutionNet5d,
      individualNet5d,
      foreignerStreak,
      institutionStreak,
      daily: dailyTrends,
      summary: investorSummary,
    },
    disclosures: {
      items: disclosureItems,
      summary: disclosureSummary,
    },
    consensus: {
      avgTargetPrice,
      upsidePercent,
      recommScore,
      reportCount: analystReports.length,
      latestReports,
      summary: consensusSummary,
    },
    technicals: {
      currentPrice,
      high52w,
      low52w,
      position52wPercent,
      drawdownFromHighPercent,
      todayVolume,
      avgVolume20d,
      volumeRatio20d,
      ma5,
      ma20,
      ma20Disparity,
      rsi14,
      summary: techSummary,
    },
    sectorAndMacro: {
      peers,
      peerAvgChangeRate,
      relativeStatus,
      macroHighlights,
      summary: peerSummaryText,
    },
    riskAndShort: {
      marketWarning,
      creditBalanceRate,
      programNetBuyQty,
      turnoverRate,
      shortSellingAllowed,
      status: riskStatus,
      statusLabel,
      checkpoints,
      summary: riskSummary,
    },
  };

  SIGNAL_CACHE.set(ticker, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/**
 * /api/analyze 1단계·2단계 LLM 프롬프트에 직접 주입할 고밀도 6대 시그널 요약 블록
 */
export function formatSignalsForPrompt(signals: StockMultiSignals): string {
  const macroStr =
    signals.sectorAndMacro.macroHighlights.length > 0
      ? signals.sectorAndMacro.macroHighlights
          .map(
            (m) =>
              `${m.name} ${m.value}(${
                m.changePercent !== null ? `${m.changePercent > 0 ? "+" : ""}${m.changePercent}%` : "-"
              })`,
          )
          .join(", ")
      : "데이터 없음";

  return `[1. 투자자별 수급 동향 (외국인·기관·개인)]
- ${signals.investorFlow.summary}

[2. 최근 전자공시 (실적·수주·증자·IR)]
- ${signals.disclosures.summary}

[3. 증권사 목표주가 컨센서스 및 최신 리포트]
- ${signals.consensus.summary}

[4. 기술적 위치 및 거래량 시그널]
- ${signals.technicals.summary}

[5. 동종 업종(Peer) 흐름 및 글로벌 매크로]
- ${signals.sectorAndMacro.summary}
- 글로벌 매크로 지표: ${macroStr}

[6. 신용·프로그램·과열/숏커버링 리스크 진단]
- ${signals.riskAndShort.summary}`;
}
