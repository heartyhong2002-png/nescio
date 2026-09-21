import { serverEnv } from "./server-env";
import { AnalystReport, ConsensusAiReport } from "./consensus-types";

// 인메모리 캐시 (TTL 2시간)
const ANALYSIS_CACHE = new Map<string, { analysis: ConsensusAiReport; expiresAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

function getCacheKey(ticker: string, reports: AnalystReport[]): string {
  // 최신 리포트 nid들의 조합을 해시 대신 사용 (간단한 식별자)
  return ticker + "|" + reports.map((r) => r.nid).join(",");
}

/**
 * 정량적 수치를 바탕으로 투자의견 평점(1~5점)을 산출한다.
 */
function calculateConsensusScore(reports: AnalystReport[]): number {
  if (reports.length === 0) return 3; // 기본 중립
  let total = 0;
  let count = 0;
  for (const r of reports) {
    const op = r.opinion.toUpperCase();
    if (op.includes("BUY") || op.includes("매수")) total += 5;
    else if (op.includes("HOLD") || op.includes("중립")) total += 3;
    else if (op.includes("SELL") || op.includes("매도") || op.includes("비중축소")) total += 1;
    else continue;
    count++;
  }
  if (count === 0) return 3; // 해석 불가능한 의견들뿐이면 중립 처리
  return Math.round((total / count) * 10) / 10;
}

/**
 * 리포트 미발행 종목(스몰캡 등)을 위한 룰베이스 폴백 엔진
 */
function generateRuleBasedAnalysis(reports: AnalystReport[], currentPrice: number): ConsensusAiReport {
  const avgTargetPrice = reports.length > 0
    ? Math.round(reports.reduce((acc, r) => acc + (r.targetPrice || currentPrice), 0) / reports.length)
    : currentPrice;
  const score = calculateConsensusScore(reports);
  const upsidePercent = currentPrice > 0 ? Math.round(((avgTargetPrice - currentPrice) / currentPrice) * 1000) / 10 : 0;

  let summary = "";
  let keyDrivers: string[] = [];

  if (reports.length === 0) {
    summary = "최근 발간된 증권사 리포트가 없는 종목입니다. 대형 증권사의 커버리지가 부족한 중소형주일 가능성이 높습니다. 실시간 뉴스나 공시 정보를 함께 참고해 주세요.";
    keyDrivers = ["공식 리포트 미발간", "실적 발표 및 최신 공시 주목"];
  } else {
    summary = `최근 ${reports.length}개 증권사에서 리포트를 발간했으며, 평균 목표가는 ${avgTargetPrice.toLocaleString()}원입니다. `;
    if (upsidePercent > 15) {
      summary += "현재가 대비 상승 여력이 충분하다고 판단하는 의견이 많습니다. ";
    } else if (upsidePercent < 0) {
      summary += "현재 주가가 목표가를 상회하여 단기적 가격 부담이 있을 수 있습니다. ";
    } else {
      summary += "단기적으로는 현재가 부근에서 등락을 거듭할 것으로 예상됩니다. ";
    }
    summary += "세부적인 실적 추정치는 각 증권사 리포트 원문을 참고하세요.";
    keyDrivers = reports.map((r) => `${r.brokerName}: ${r.title}`).slice(0, 3);
  }

  return {
    consensusScore: score,
    averageTargetPrice: avgTargetPrice,
    upsidePercent,
    summary,
    keyDrivers,
  };
}

async function callOpenAiFormat(opts: { url: string; apiKey: string; model: string; system: string; prompt: string }): Promise<string> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM Error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

async function callGeminiFormat(opts: { apiKey: string; model: string; system: string; prompt: string }): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

const SYSTEM_PROMPT = `너는 여의도 증권가 리서치 센터의 전문가 뷰를 주식 초보자 친구에게 설명해 주는 친절한 분석가다.
입력으로 주어진 증권사 리포트 요약본과 목표주가, 투자의견을 종합하여 초보자가 한눈에 이해할 수 있도록 쉽게 풀어서 3줄로 요약해 주어야 한다. 12M Fwd P/E, CAPEX, 컨센서스 상회 등 어려운 전문 용어는 초보자 눈높이에 맞춰 일상적인 표현으로 변경하라.

반드시 아래 JSON 스키마로만 출력해야 한다. (마크다운 백틱 없이 순수 JSON만 반환)

{
  "consensusScore": number, // (1.0 ~ 5.0) 투자의견 평점 (강력 매수 5.0, 매수 4.0, 중립 3.0, 비중축소/매도 2.0 이하)
  "averageTargetPrice": number, // 제시된 리포트들의 목표주가 평균 (정수 원)
  "summary": string, // 전문가들의 시각을 종합한 친절한 3문장 이내의 요약문 (초보자용 톤앤매너)
  "keyDrivers": string[] // 전문가들이 가장 주목하는 2~3가지 핵심 성장 요인 또는 리스크 요인
}`;

export async function analyzeConsensus(
  ticker: string,
  reports: AnalystReport[],
  currentPrice: number
): Promise<ConsensusAiReport> {
  // 1. 리포트가 없으면 룰베이스 즉시 반환
  if (!reports || reports.length === 0) {
    return generateRuleBasedAnalysis(reports, currentPrice);
  }

  // 2. 캐시 확인
  const cacheKey = getCacheKey(ticker, reports);
  const cached = ANALYSIS_CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return cached.analysis;
  }

  // 3. 분석용 입력 데이터 구성
  const promptData = {
    ticker,
    currentPrice,
    reports: reports.map((r) => ({
      broker: r.brokerName,
      title: r.title,
      targetPrice: r.targetPrice,
      opinion: r.opinion,
      contentSnippet: r.content.substring(0, 300), // 앞부분 300자만 추출하여 토큰 절약
    })),
  };
  const prompt = `현재 주가는 ${currentPrice}원입니다. 다음은 최근 발간된 증권사 리포트 메타데이터와 핵심 내용입니다:\n${JSON.stringify(promptData, null, 2)}`;

  let aiResultText = "";

  // 4-1. Groq (Llama 3.3/3.1) 우선 호출
  const groqKey = serverEnv("GROQ_API_KEY");
  if (groqKey) {
    try {
      aiResultText = await callOpenAiFormat({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: groqKey,
        model: "llama-3.3-70b-versatile",
        system: SYSTEM_PROMPT,
        prompt,
      });
    } catch (e) {
      console.warn(`[ConsensusAnalyzer] Groq failed, fallback to Gemini. Error: ${e}`);
    }
  }

  // 4-2. Gemini Fallback
  if (!aiResultText) {
    const geminiKey = serverEnv("GEMINI_API_KEY");
    if (geminiKey) {
      try {
        aiResultText = await callGeminiFormat({
          apiKey: geminiKey,
          model: "gemini-2.5-flash",
          system: SYSTEM_PROMPT,
          prompt,
        });
      } catch (e) {
        console.warn(`[ConsensusAnalyzer] Gemini failed, fallback to Rule-based. Error: ${e}`);
      }
    }
  }

  // 5. 파싱 및 상승여력 추가 연산
  let aiReport: ConsensusAiReport;
  try {
    if (!aiResultText) throw new Error("No AI output");
    const parsed = JSON.parse(aiResultText.replace(/```json/g, "").replace(/```/g, "").trim());
    const upsidePercent = currentPrice > 0 ? Math.round(((parsed.averageTargetPrice - currentPrice) / currentPrice) * 1000) / 10 : 0;
    
    aiReport = {
      consensusScore: Number(parsed.consensusScore) || calculateConsensusScore(reports),
      averageTargetPrice: Number(parsed.averageTargetPrice) || currentPrice,
      upsidePercent,
      summary: parsed.summary || "",
      keyDrivers: Array.isArray(parsed.keyDrivers) ? parsed.keyDrivers : [],
    };
  } catch (e) {
    console.error("[ConsensusAnalyzer] Failed to parse AI result, using Rule-based.", e);
    aiReport = generateRuleBasedAnalysis(reports, currentPrice);
  }

  ANALYSIS_CACHE.set(cacheKey, { analysis: aiReport, expiresAt: now + CACHE_TTL_MS });
  return aiReport;
}
