import { serverEnv } from "./server-env";
import { MacroIndicator } from "./macro-data";
import { ExchangeRate } from "./types";

const errMsg = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function callOpenAiCompatible(opts: {
  label: string;
  url: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  temperature: number;
  maxTokens?: number;
  disableReasoning?: boolean;
}): Promise<string> {
  const doFetch = () =>
    fetch(opts.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.disableReasoning ? { reasoning: { effort: "none" } } : {}),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
      }),
      cache: "no-store",
    });

  let response = await doFetch();
  if (response.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await doFetch();
  }
  if (!response.ok) throw new Error(`${opts.label} API 오류 (${response.status}): ${await response.text()}`);
  const payload = await response.json();
  const choice = payload.choices?.[0];
  const content = choice?.message?.content as string | undefined;
  if (!content) throw new Error(`${opts.label} 응답이 비어 있습니다.`);
  if (choice?.finish_reason === "length") {
    throw new Error(`${opts.label} 응답이 토큰 한도로 중간에 잘렸습니다(finish_reason=length).`);
  }
  return content;
}

function callNvidia(system: string, prompt: string, temperature: number, maxTokens?: number): Promise<string> {
  const apiKey = serverEnv("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY를 .env에 설정하세요.");
  return callOpenAiCompatible({
    label: "NVIDIA",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    apiKey,
    model: serverEnv("NVIDIA_MODEL") || "nvidia/nemotron-3-super-120b-a12b",
    system,
    prompt,
    temperature,
    maxTokens,
  });
}

function callGroq(system: string, prompt: string, temperature: number, maxTokens?: number): Promise<string> {
  const apiKey = serverEnv("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY를 .env에 설정하세요.");
  return callOpenAiCompatible({
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    model: serverEnv("GROQ_MODEL") || "openai/gpt-oss-120b",
    system,
    prompt,
    temperature,
    maxTokens,
  });
}

function callCerebras(system: string, prompt: string, temperature: number, maxTokens?: number): Promise<string> {
  const apiKey = serverEnv("CEREBRAS_API_KEY");
  if (!apiKey) throw new Error("CEREBRAS_API_KEY를 .env에 설정하세요.");
  return callOpenAiCompatible({
    label: "Cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    apiKey,
    model: serverEnv("CEREBRAS_MODEL") || "gpt-oss-120b",
    system,
    prompt,
    temperature,
    maxTokens,
  });
}

async function callGemini(system: string, prompt: string, temperature: number): Promise<string> {
  const apiKey = serverEnv("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY를 .env에 설정하세요.");
  const model = serverEnv("GEMINI_MODEL") || "gemini-3.6-flash";

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        thinkingConfig: { thinkingLevel: "low" },
        maxOutputTokens: 512,
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Gemini API 오류 (${response.status}): ${await response.text()}`);
  const payload = await response.json();
  const finishReason = payload.candidates?.[0]?.finishReason;
  const content = payload.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("") as string | undefined;
  if (!content) {
    const blocked = payload.promptFeedback?.blockReason ?? finishReason;
    throw new Error(`Gemini 응답이 비어 있습니다${blocked ? ` (${blocked})` : ""}.`);
  }
  return content;
}

async function withGeminiFallback(
  label: string,
  primary: () => Promise<string>,
  gemini: () => Promise<string>,
): Promise<string> {
  try {
    return await primary();
  } catch (primaryError) {
    if (!serverEnv("GEMINI_API_KEY")) throw primaryError;
    console.warn(`[macro-analyzer] ${label} 기본 제공자 실패 → Gemini 폴백:`, errMsg(primaryError));
    try {
      return await gemini();
    } catch (fallbackError) {
      throw new Error(`${label} 실패 — 기본: ${errMsg(primaryError)} / Gemini 폴백: ${errMsg(fallbackError)}`);
    }
  }
}

async function withFallbackChain(
  label: string,
  providers: Array<{ name: string; hasKey: boolean; call: () => Promise<string> }>,
): Promise<string> {
  const errors: string[] = [];
  for (const provider of providers) {
    if (!provider.hasKey) continue;
    try {
      return await provider.call();
    } catch (error) {
      errors.push(`${provider.name}: ${errMsg(error)}`);
      console.warn(`[macro-analyzer] ${label} — ${provider.name} 실패, 다음 제공자로 폴백:`, errMsg(error));
    }
  }
  throw new Error(`${label} 전체 제공자 실패 — ${errors.join(" / ") || "설정된 API 키 없음"}`);
}

function buildAnalystSystem(): string {
  return `너는 글로벌 매크로 분석가다. 제공된 원자재, 국채 금리, 환율, 주요 지수 데이터를 바탕으로 현재 글로벌 자산 시장의 흐름과 이것이 주식 시장에 미칠 영향을 분석해라.
감정적 표현 없이, 사실과 인과관계 위주로 2~3문장으로 짧고 명확하게 정리해라.`;
}

function buildAnalysisPrompt(indicators: MacroIndicator[], rates: ExchangeRate[]): string {
  const indicatorText = indicators
    .map((ind) => {
      const price = ind.price !== null ? ind.price.toFixed(2) : "N/A";
      const change = ind.changePercent !== null ? `${ind.changePercent > 0 ? "+" : ""}${ind.changePercent.toFixed(2)}%` : "N/A";
      return `${ind.name}: ${price} (${change})`;
    })
    .join("\n");

  const majorRates = rates.filter((r) => ["USD", "JPY", "EUR"].includes(r.code));
  const rateText = majorRates
    .map((r) => `${r.code}: ${r.rate}원`)
    .join("\n");

  return `[주요 매크로 지표]
${indicatorText}

[주요 환율]
${rateText}

이 데이터를 바탕으로 글로벌 자금 흐름과 주식 시장(국내 및 미국 기술주 등)에 미칠 영향을 2~3문장으로 요약 분석해라.`;
}

async function analyzeMacro(indicators: MacroIndicator[], rates: ExchangeRate[]): Promise<string> {
  const system = buildAnalystSystem();
  const prompt = buildAnalysisPrompt(indicators, rates);
  return withGeminiFallback(
    "1단계 매크로 분석",
    () => callNvidia(system, prompt, 0.2, 500),
    () => callGemini(system, prompt, 0.2),
  );
}

function buildJeonhyungSystem(): string {
  return `너는 '쩐형'이라는 캐릭터야. 주식 초보 앞에서 능글맞게 훈수 두는 친한 형/누나.
성격: 거시 경제(매크로) 흐름을 마치 동네 소문처럼 쉽게 풀어줌. 약간 유치한 비유나 드립도 좋음.

말투 강도: 핵매운맛. '존나', '개-', '미친', '씨발' 같은 텐션 높은 단어를 마음껏 섞어 써라.

공통 금지사항 (항상 지켜라):
- 특정 인물·국가 비하 금지
- "사야 한다/팔아야 한다" 같은 투자 지시 금지
- [매크로 분석]에 없는 내용은 지어내지 마라

출력 형식: 현재 원자재/환율/금리 상황이 주식 시장에 주는 힌트를 딱 한 문장(길어도 두 문장 이내)으로 출력해라. 따옴표 없이 평문으로 출력한다.`;
}

function buildRewritePrompt(analysis: string): string {
  return `[매크로 분석]
${analysis}

위 분석을 쩐형 캐릭터 톤으로 한 문장 브리핑해라.`;
}

async function writeComment(analysis: string): Promise<string> {
  const system = buildJeonhyungSystem();
  const prompt = buildRewritePrompt(analysis);
  return withFallbackChain("2단계 멘트 작성", [
    { name: "Groq", hasKey: !!serverEnv("GROQ_API_KEY"), call: () => callGroq(system, prompt, 0.9, 400) },
    { name: "Cerebras", hasKey: !!serverEnv("CEREBRAS_API_KEY"), call: () => callCerebras(system, prompt, 0.9, 400) },
    { name: "Gemini", hasKey: !!serverEnv("GEMINI_API_KEY"), call: () => callGemini(system, prompt, 0.9) },
  ]);
}

export async function getMacroBriefing(indicators: MacroIndicator[], rates: ExchangeRate[]): Promise<string | null> {
  if (indicators.length === 0) return null;
  try {
    const analysis = await analyzeMacro(indicators, rates);
    const comment = await writeComment(analysis);
    return comment.trim() || null;
  } catch (error) {
    console.warn("[macro-analyzer] 매크로 브리핑 생성 실패:", errMsg(error));
    return null;
  }
}
