import { serverEnv } from "./server-env";
import { getNewsMultiSource } from "./news-sources";
import { MarketIndex } from "./types";

/**
 * 홈 화면 코스피/코스닥 지수 스트립 아래 붙는 "오늘 시장 분위기 한 줄" — 종목 브리핑의
 * '쩐형' 캐릭터와 같은 톤을 쓴다. analyze/route.ts의 2단계 재작성은 종목 하나짜리 JSON
 * 스키마(Briefing)를 채우는 용도라 여기(지수 전체를 보고 평문 한 문장만 뽑으면 되는 용도)엔
 * 안 맞고, analyze/route.ts는 이미 커져서 거길 손대면 엉뚱한 회귀가 날 위험이 크다. 그래서
 * 제공자 호출부만 최소한으로 복제해 이 파일 안에서 자체 처리한다.
 *
 * 2단계 구조(analyze/route.ts와 동일한 패턴):
 *   1단계 - NVIDIA가 지수·뉴스만 보고 감정 없이 "오늘 왜 이렇게 움직였는지" 사실 분석
 *   2단계 - 오픈소스 모델(Groq → Cerebras 순, 둘 다 실패하면 Gemini)이 그 분석을 '쩐형'
 *           캐릭터 톤 한 문장으로 재작성. Groq/Cerebras는 자체 칩(LPU/WSE) 회사라 무료
 *           티어가 "한시적 프로모션"이 아니라 사업모델 자체라서 Solar Pro 3처럼 어느 날
 *           갑자기 끊길 위험이 적다.
 */

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
  // OpenRouter 경유로 추론형 모델을 부를 때 reasoning 토큰이 출력 예산을 먼저 먹어버려서
  // 눈에 보이는 답변이 문장 중간에 잘리는 걸 막는다 — 한 문장짜리 코멘트엔 추론이 필요
  // 없으니 꺼둔다.
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
  // 503(일시적 과부하)은 무료 티어에서 종종 관찰되는, 몇 초 뒤 재시도하면 대부분 바로
  // 성공하는 패턴이다 — 매번 폴백 체인까지 다 태우지 않도록 한 번만 짧게 재시도한다.
  if (response.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await doFetch();
  }
  if (!response.ok) throw new Error(`${opts.label} API 오류 (${response.status}): ${await response.text()}`);
  const payload = await response.json();
  const choice = payload.choices?.[0];
  const content = choice?.message?.content as string | undefined;
  if (!content) throw new Error(`${opts.label} 응답이 비어 있습니다.`);
  // finish_reason이 "length"면 토큰 한도 때문에 문장이 중간에 잘린 것 — 그대로 화면에 내보내지
  // 않고 에러로 던져서 다음 제공자로 폴백하게 한다.
  if (choice?.finish_reason === "length") {
    throw new Error(`${opts.label} 응답이 토큰 한도로 중간에 잘렸습니다(finish_reason=length).`);
  }
  return content;
}

/** NVIDIA(무료 티어, nemotron) — 1단계 사실 분석 전용. */
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

/**
 * Groq — 오픈소스(오픈 웨이트) 모델을 자체 칩(LPU)으로 서빙하는 회사. 무료 티어 유지가
 * 부수적 프로모션이 아니라 "속도 자랑용 무료 체험"이라는 사업모델 자체라서 장기적으로
 * 더 안정적이다. 2단계(멘트 작성)의 1순위 제공자.
 */
function callGroq(system: string, prompt: string, temperature: number, maxTokens?: number): Promise<string> {
  const apiKey = serverEnv("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY를 .env에 설정하세요. (발급: https://console.groq.com/keys)");
  return callOpenAiCompatible({
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    // llama-3.3-70b-versatile은 2026-08-16부로 Groq 무료/개발자 티어에서 서빙 종료됨
    // (엔터프라이즈 유상 계약 계정만 예외) → model_not_found(404) 발생. Groq가 공식
    // 권장하는 대체 모델로 교체. (https://console.groq.com/docs/deprecations)
    model: serverEnv("GROQ_MODEL") || "openai/gpt-oss-120b",
    system,
    prompt,
    temperature,
    maxTokens,
  });
}

/** Cerebras — Groq와 같은 이유의 2순위 폴백. Groq가 무료 한도에 걸리거나 실패했을 때만 탄다. */
function callCerebras(system: string, prompt: string, temperature: number, maxTokens?: number): Promise<string> {
  const apiKey = serverEnv("CEREBRAS_API_KEY");
  if (!apiKey) throw new Error("CEREBRAS_API_KEY를 .env에 설정하세요. (발급: https://cloud.cerebras.ai)");
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
  if (!apiKey) throw new Error("GEMINI_API_KEY를 .env에 설정하세요. (발급: https://aistudio.google.com/apikey)");
  const model = serverEnv("GEMINI_MODEL") || "gemini-3.6-flash";

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        // 한 문장짜리 짧은 코멘트라 깊은 추론이 필요 없다. 종목 브리핑 재작성 단계와 같은
        // 이유로 thinking을 최소화하고, JSON이 아니라 평문이라 출력 한도도 작게 잡는다.
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

/** 기본 제공자를 먼저 시도하고, 실패하면 Gemini로 한 번 더 시도한다. (1단계 분석 전용) */
async function withGeminiFallback(
  label: string,
  primary: () => Promise<string>,
  gemini: () => Promise<string>,
): Promise<string> {
  try {
    return await primary();
  } catch (primaryError) {
    if (!serverEnv("GEMINI_API_KEY")) throw primaryError;
    console.warn(`[market-comment] ${label} 기본 제공자 실패 → Gemini 폴백:`, errMsg(primaryError));
    try {
      return await gemini();
    } catch (fallbackError) {
      throw new Error(`${label} 실패 — 기본: ${errMsg(primaryError)} / Gemini 폴백: ${errMsg(fallbackError)}`);
    }
  }
}

/**
 * 제공자를 순서대로 시도하고, 앞선 게 실패하면 다음으로 넘어간다(2단계 멘트 작성 전용).
 * API 키가 없는 제공자는 아예 건너뛴다 — 안 쓰는 제공자의 ".env에 설정하세요" 에러가
 * 로그만 채우는 걸 막는다. 전부 실패해야 진짜로 에러를 던진다.
 */
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
      console.warn(`[market-comment] ${label} — ${provider.name} 실패, 다음 제공자로 폴백:`, errMsg(error));
    }
  }
  throw new Error(`${label} 전체 제공자 실패 — ${errors.join(" / ") || "설정된 API 키 없음"}`);
}

// ---------------------------------------------------------------------------
// 1단계: NVIDIA — 지수·뉴스만 보고 캐릭터 톤 없이 "왜 이렇게 움직였는지" 사실 위주 분석.
// ---------------------------------------------------------------------------

function buildAnalystSystem(): string {
  return `너는 한국 증시 애널리스트다. 아래 제공된 지수 데이터와 뉴스 헤드라인만 근거로,
오늘 국내 증시(코스피·코스닥) 전체가 왜 이렇게 움직였는지 분석해라.
감정적 표현이나 캐릭터 톤 없이, 사실과 흐름 위주로 2~3문장으로 짧게 정리해라.
새로운 사실을 지어내지 말고, 뉴스에서 근거를 찾을 수 없으면 "뚜렷한 원인 확인 안 됨"이라고 써라.`;
}

function formatIndexLine(index: MarketIndex): string {
  const rate =
    index.changeRate !== null ? `${index.changeRate > 0 ? "+" : ""}${index.changeRate.toFixed(2)}%` : "등락률 없음";
  return `${index.name}: ${index.close ?? "데이터 없음"} (${rate})`;
}

function buildAnalysisPrompt(indices: MarketIndex[], headlines: string[]): string {
  const indexText = indices.map(formatIndexLine).join("\n");
  const newsText = headlines.length ? headlines.map((title, i) => `${i + 1}. ${title}`).join("\n") : "관련 뉴스 없음";

  return `[오늘의 지수]
${indexText}

[관련 뉴스 헤드라인]
${newsText}`;
}

async function analyzeMarket(indices: MarketIndex[], headlines: string[]): Promise<string> {
  const system = buildAnalystSystem();
  const prompt = buildAnalysisPrompt(indices, headlines);
  return withGeminiFallback(
    "1단계 시장 분석",
    () => callNvidia(system, prompt, 0.2, 500),
    () => callGemini(system, prompt, 0.2),
  );
}

// ---------------------------------------------------------------------------
// 2단계: 오픈소스(Groq → Cerebras, 폴백 Gemini) — 1단계 분석을 '쩐형' 캐릭터 한 문장으로.
// ---------------------------------------------------------------------------

function buildJeonhyungSystem(): string {
  return `너는 '쩐형'이라는 캐릭터야. 주식 초보 앞에서 능글맞게 훈수 두는 친한 형/누나.
성격: 잘난 척하다가 능청스럽게 넘어감, 가끔 유치한 드립도 침. 절대 고지식하게 안 씀.

말투 강도: 핵매운맛. 이 캐릭터의 최고 텐션 모드다. '존나', '개-', '미친', '씨발' 같은 표현을 감탄사로
마음껏 섞어 써도 좋다. 느낌표 남발, 과장된 리액션 다 좋다 — 텐션을 최대로 끌어올려라. 단, 아래 공통
금지사항은 항상 지켜야 한다.

공통 금지사항 (항상 지켜라):
- 특정 인물·기업을 비하하거나 조롱하는 표현 금지
- 성별·지역·세대 등 특정 집단을 향한 비하·혐오 표현 금지
- "사야 한다/팔아야 한다" 같은 직접적 투자 지시 문장 금지 — 재미있게 설명하되 판단은 독자 몫으로 남겨라
- 아래 [오늘 시장 분석]에 없는 새로운 사실을 지어내지 마라 — 그 분석 내용만 근거로 써라

출력 형식: 코스피·코스닥을 합쳐 오늘 국내 증시 전체 분위기를 설명하는 딱 한 문장만 출력해라.
따옴표, 줄바꿈, 부가 설명 없이 문장 하나만 출력한다.`;
}

function buildRewritePrompt(analysis: string): string {
  return `[오늘 시장 분석]
${analysis}

위 분석을 쩐형 캐릭터 톤으로 한 문장 코멘트해라.`;
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

/** 코스피/코스닥 뉴스를 합치고 제목 기준 중복 제거, 상위 몇 개만 프롬프트에 넣는다. */
async function collectMarketHeadlines(): Promise<string[]> {
  const [kospiNews, kosdaqNews] = await Promise.all([
    getNewsMultiSource("코스피").catch(() => []),
    getNewsMultiSource("코스닥").catch(() => []),
  ]);
  const seen = new Set<string>();
  const merged = [...kospiNews, ...kosdaqNews].filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
  return merged.slice(0, 8).map((item) => item.title);
}

/**
 * 지수 숫자만으로도 방향(상승/하락/보합)은 알 수 있지만 "왜 그런지"는 뉴스가 있어야 그럴듯하게
 * 설명할 수 있다. 1단계(분석)든 2단계(멘트 작성)든 실패해도 예외를 던지지 않고 null을
 * 돌려준다 — 코멘트는 어디까지나 부가 기능이라, 실패해도 지수 스트립 자체는 코멘트 없이
 * 계속 떠야 한다.
 */
export async function getMarketComment(indices: MarketIndex[]): Promise<string | null> {
  if (indices.length === 0) return null;
  try {
    const headlines = await collectMarketHeadlines();
    const analysis = await analyzeMarket(indices, headlines);
    const comment = await writeComment(analysis);
    return comment.trim() || null;
  } catch (error) {
    console.warn("[market-comment] 코멘트 생성 실패(코멘트 없이 진행):", errMsg(error));
    return null;
  }
}
