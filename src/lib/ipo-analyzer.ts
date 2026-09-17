import { serverEnv } from "./server-env";
import { IpoAiAnalysis, IpoInfo } from "./types";

/**
 * 인메모리 분석 캐시 (동일 공모주 및 동일 수요예측 결과에 대해 중복 LLM 호출 방지)
 * TTL: 2시간
 */
const ANALYSIS_CACHE = new Map<string, { analysis: IpoAiAnalysis; expiresAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

function getCacheKey(ipo: IpoInfo): string {
  return [
    ipo.corpName,
    ipo.confirmedPrice ?? 0,
    ipo.institutionCompetitionRate ?? "",
    ipo.lockupRatio ?? "",
    ipo.subscriptionEnd ?? "",
  ].join("|");
}

function parseRate(str: string | null | undefined): number | null {
  if (!str) return null;
  const match = str.replace(/,/g, "").match(/([\d.]+)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

/**
 * LLM API 장애나 키 미설정 시에도 정밀한 데이터 기반으로 청약 판단을 내리는 룰베이스 엔진.
 */
export function generateRuleBasedAnalysis(ipo: IpoInfo): IpoAiAnalysis {
  const comp = parseRate(ipo.institutionCompetitionRate);
  const lockup = parseRate(ipo.lockupRatio);
  const confirmed = ipo.confirmedPrice;
  const band = ipo.hopePriceBand;

  // 1. 점수 산정 (기본 50점 시작)
  let score = 50;
  const strengths: string[] = [];
  const cautions: string[] = [];

  // 기관 경쟁률 평가 (가중치 40점)
  if (comp !== null) {
    if (comp >= 1000) {
      score += 30;
      strengths.push(`기관 수요예측 경쟁률이 ${ipo.institutionCompetitionRate}로 1,000:1을 크게 상회하여 기관 투자자들의 관심이 매우 뜨겁습니다.`);
    } else if (comp >= 600) {
      score += 18;
      strengths.push(`기관 수요예측 경쟁률 ${ipo.institutionCompetitionRate}로 양호한 흥행 성적을 기록했습니다.`);
    } else if (comp >= 200) {
      score += 5;
      cautions.push(`기관 수요예측 경쟁률이 ${ipo.institutionCompetitionRate} 수준으로 평이하여 상장 당일 수급 변동성에 유의해야 합니다.`);
    } else {
      score -= 25;
      cautions.push(`기관 수요예측 경쟁률이 ${ipo.institutionCompetitionRate}로 저조하여 기관들의 선호도가 낮게 나타났습니다.`);
    }
  } else {
    cautions.push("수요예측 결과(기관 경쟁률/의무확약)가 아직 공시되지 않아 일정 및 공모가 확정 추이를 지켜봐야 합니다.");
  }

  // 의무보유확약 평가 (가중치 20점)
  if (lockup !== null) {
    if (lockup >= 15) {
      score += 15;
      strengths.push(`의무보유확약 비율이 ${ipo.lockupRatio}로 우수하여 상장 첫날 유통 가능 물량이 크게 축소되어 가격 하방 경직성을 확보했습니다.`);
    } else if (lockup >= 5) {
      score += 8;
      strengths.push(`의무보유확약 비율이 ${ipo.lockupRatio}로 통상적인 수준의 확약 물량을 확보했습니다.`);
    } else {
      score -= 5;
      cautions.push(`의무보유확약 비율이 ${ipo.lockupRatio}로 낮은 편이라 상장일 기관 매도 물량 출회에 유의가 필요합니다.`);
    }
  }

  // 확정 공모가 위치 분석
  if (confirmed && band) {
    const bandMatches = band.replace(/,/g, "").match(/(\d+)/g);
    if (bandMatches && bandMatches.length >= 2) {
      const minBand = Number(bandMatches[0]);
      const maxBand = Number(bandMatches[1]);
      if (confirmed > maxBand) {
        cautions.push(`확정 공모가(${confirmed.toLocaleString()}원)가 희망 밴드 상단(${maxBand.toLocaleString()}원)을 초과 결정되어 밸류에이션 부담이 일부 존재합니다.`);
      } else if (confirmed === maxBand) {
        strengths.push(`희망 밴드 상단(${confirmed.toLocaleString()}원)에서 안정적으로 공모가가 결정되었습니다.`);
      } else if (confirmed < minBand) {
        score -= 10;
        cautions.push(`공모가가 희망 밴드 하단 미만으로 결정되어 시장 평가가 보수적인 상태입니다.`);
      }
    }
  }

  // 주관사 현황
  const allocs = ipo.underwriterAllocations || [];
  if (allocs.length > 0) {
    const sorted = [...allocs].sort((a, b) => (b.retailShares ?? b.shares ?? 0) - (a.retailShares ?? a.shares ?? 0));
    const topBroker = sorted[0];
    const brokerNames = allocs.map((a) => a.name).join(", ");
    strengths.push(`청약 주관사(${brokerNames}) 중 ${topBroker.name}의 일반 배정 물량이 가장 많아 균등/비례 당첨 확률에 유리합니다.`);
  }

  // 점수 범위 클램핑 (10 ~ 98점)
  score = Math.max(15, Math.min(96, score));

  // 판정 도출
  let verdict: IpoAiAnalysis["verdict"] = "NEUTRAL";
  let verdictLabel = "중립 (균등만 소액)";
  let oneLiner = "";
  let strategy = "";

  if (score >= 80) {
    verdict = "STRONG_APPLY";
    verdictLabel = "적극 청약 추천";
    oneLiner = `수요예측 흥행 성공(${ipo.institutionCompetitionRate || "높은 경쟁률"})과 견고한 수급 구조로 상장일 높은 수익률이 기대됩니다.`;
    strategy = `주관사 중 배정 주식수가 가장 많은 ${allocs[0]?.name || "대표 주관사"}를 1순위로 공략하시고, 여유 자금이 있다면 비례 청약까지 적극 고려할 만합니다.`;
  } else if (score >= 65) {
    verdict = "APPLY";
    verdictLabel = "청약 추천 (균등 노림)";
    oneLiner = `양호한 기관 평가를 바탕으로 상장 당일 안정적인 수익 실현이 가능해 보입니다.`;
    strategy = `리스크를 낮추기 위해 최소 청약 주식수(${ipo.minSubscriptionShares ?? 10}주) 증거금만 입금하여 '균등 배정' 위주로 안전하게 참여하는 전략을 권장합니다.`;
  } else if (score >= 45) {
    verdict = "NEUTRAL";
    verdictLabel = "신중한 접근 (관망 또는 소액)";
    oneLiner = `기관 경쟁률 또는 유통 물량 조건이 평이하여 상장 당일 시초가 흐름을 면밀히 관찰해야 합니다.`;
    strategy = `비례 청약은 피하고, 가족 계좌 등을 활용한 최소 단위 균등 청약(치킨값 노림) 정도로만 가볍게 접근하는 것이 바람직합니다.`;
  } else {
    verdict = "PASS";
    verdictLabel = "청약 패스 권고";
    oneLiner = `기관 수요예측 부진 및 수급 부담으로 인해 상장일 공모가 하회(손실) 위험이 있습니다.`;
    strategy = `무리한 청약보다는 상장 후 시장 안착 과정을 지켜보거나 다음 우량 공모주를 기다리는 것을 추천합니다.`;
  }

  return {
    verdict,
    verdictLabel,
    score,
    oneLiner,
    strengths: strengths.slice(0, 3),
    cautions: cautions.slice(0, 2),
    strategy,
  };
}

async function callOpenAiFormat(opts: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
}): Promise<string> {
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

const SYSTEM_PROMPT = `너는 대한민국 공모주(IPO) 투자 전문 수석 애널리스트다.
제공된 공모주의 객관적 데이터(기관 수요예측 경쟁률, 의무보유확약 비율, 확정 공모가 및 희망 밴드, 주관사별 배정물량, 환불일 등)를 정밀하게 종합 분석하여 투자자가 '청약을 해야 할지 말아야 할지' 명쾌하고 날카로운 분석을 내린다.

규칙:
1. 근거 없는 억측은 금지하며, 주어진 기관 경쟁률과 확약 비율, 밸류에이션 위치를 최우선 팩트로 삼는다.
2. 친절하고 신뢰감 있는 전문가 톤으로 작성한다.
3. 반드시 아래 JSON 스키마로만 출력한다.

출력 JSON 스키마:
{
  "verdict": "STRONG_APPLY" | "APPLY" | "NEUTRAL" | "PASS",
  "verdictLabel": "적극 청약 추천" | "청약 추천 (균등 노림)" | "신중한 접근" | "청약 패스 권고",
  "score": number, // 0 ~ 100점 사이 정수
  "oneLiner": string, // 1~2문장의 임팩트 있는 결론 요약
  "strengths": string[], // 핵심 호재/강점 2~3개
  "cautions": string[], // 주의/리스크 요인 1~2개
  "strategy": string // 구체적 청약 가이드 (어느 주관사가 유리한지, 균등 vs 비례 전략, 환불일 고려 등)
}`;

function buildUserPrompt(ipo: IpoInfo): string {
  const underwritersStr = (ipo.underwriterAllocations || [])
    .map(
      (a) =>
        `- ${a.name} (${a.role || "주관"}): 일반배정 ${a.retailShares ? a.retailShares.toLocaleString() : "미정"}주, 청약한도: ${a.subscriptionLimit || "기본한도"}`,
    )
    .join("\n");

  return `다음 공모주 청약 데이터를 분석하여 청약 판단 리포트를 작성해줘:

- 종목명: ${ipo.corpName}
- 청약 일정: ${ipo.subscriptionStart || "미정"} ~ ${ipo.subscriptionEnd || "미정"}
- 환불일: ${ipo.refundDate || "청약 종료 2영업일 후"}
- 희망 공모가 밴드: ${ipo.hopePriceBand || "미정"}
- 확정 공모가: ${ipo.confirmedPrice ? `${ipo.confirmedPrice.toLocaleString()}원` : "미확정"}
- 기관 수요예측 경쟁률: ${ipo.institutionCompetitionRate || "미공시"}
- 의무보유확약 비율: ${ipo.lockupRatio || "미공시"}
- 일반 청약 경쟁률: ${ipo.subscriptionCompetitionRate || "청약 전/진행 중"}
- 최소 청약 단위: ${ipo.minSubscriptionShares ?? 10}주 (필요 증거금: ${ipo.minSubscriptionDeposit ? `${ipo.minSubscriptionDeposit.toLocaleString()}원` : "계산중"})
- 환매청구권(풋백옵션): ${ipo.lockupNote || "없음"}

주관사 및 배정 현황:
${underwritersStr || "주관사 정보 없음"}`;
}

export async function analyzeIpoWithAi(ipo: IpoInfo): Promise<IpoAiAnalysis> {
  const cacheKey = getCacheKey(ipo);
  const cached = ANALYSIS_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.analysis;
  }

  const prompt = buildUserPrompt(ipo);

  // 1. Groq 시도 (초고속 LPU)
  const groqKey = serverEnv("GROQ_API_KEY");
  if (groqKey) {
    try {
      const content = await callOpenAiFormat({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: groqKey,
        model: serverEnv("GROQ_MODEL") || "llama-3.3-70b-versatile",
        system: SYSTEM_PROMPT,
        prompt,
      });
      const parsed = JSON.parse(content) as IpoAiAnalysis;
      if (parsed.verdict && parsed.score !== undefined) {
        ANALYSIS_CACHE.set(cacheKey, { analysis: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
        return parsed;
      }
    } catch (err) {
      console.warn("[ipo-analyzer] Groq failed, trying fallback:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Gemini 시도
  const geminiKey = serverEnv("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      const model = serverEnv("GEMINI_MODEL") || "gemini-2.5-flash";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text) as IpoAiAnalysis;
          if (parsed.verdict && parsed.score !== undefined) {
            ANALYSIS_CACHE.set(cacheKey, { analysis: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("[ipo-analyzer] Gemini failed, trying fallback:", err instanceof Error ? err.message : err);
    }
  }

  // 3. xAI 시도
  const xaiKey = serverEnv("XAI_API_KEY");
  if (xaiKey) {
    try {
      const content = await callOpenAiFormat({
        url: "https://api.x.ai/v1/chat/completions",
        apiKey: xaiKey,
        model: serverEnv("XAI_MODEL") || "grok-4-1-fast-non-reasoning",
        system: SYSTEM_PROMPT,
        prompt,
      });
      const parsed = JSON.parse(content) as IpoAiAnalysis;
      if (parsed.verdict && parsed.score !== undefined) {
        ANALYSIS_CACHE.set(cacheKey, { analysis: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
        return parsed;
      }
    } catch (err) {
      console.warn("[ipo-analyzer] xAI failed, falling back to rule engine:", err instanceof Error ? err.message : err);
    }
  }

  // 4. 안전한 룰베이스 분석 폴백 (절대 실패하지 않고 고품질 데이터 기반 분석 산출)
  const ruleResult = generateRuleBasedAnalysis(ipo);
  ANALYSIS_CACHE.set(cacheKey, { analysis: ruleResult, expiresAt: Date.now() + CACHE_TTL_MS });
  return ruleResult;
}
