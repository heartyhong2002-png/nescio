import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { getPriceForTicker } from "@/lib/krx";
import { fetchMajorRatesSummary, fetchInternationalRatesSummary } from "@/lib/exim";
import { getNewsMultiSource } from "@/lib/news-sources";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { Briefing, Cause, NewsItem, Price } from "@/lib/types";

// 2단계 LLM 호출(NVIDIA + 오픈소스 모델)이라 요청 1건 비용이 크다. IP당 분당 5회로 제한해
// 스크립트로 캐시를 우회하며 계속 새 종목명을 찔러 API 비용을 태우는 걸 막는다.
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

// 이 라우트도 내부에서 exim.ts(한국수출입은행 API)를 호출한다. 리전 지정은
// (/api/exchange-rates 상단 주석 참고) 코드가 아니라 Vercel 대시보드 Function Region
// 설정으로 처리한다 — 이 프로젝트 전체가 그 설정 하나를 공유하므로 여기서 별도로
// preferredRegion을 지정할 필요는 없다.

// 같은 종목을 짧은 시간 안에 다시 요청하면(평가 데모 등) 2단계 LLM 파이프라인을 다시 태우지 않고
// 캐시된 결과를 즉시 돌려준다. 서버리스 인스턴스가 살아있는 동안만 유지되는 best-effort 캐시라
// 인스턴스가 새로 뜨면 다시 처음부터 호출하지만, 같은 웜 인스턴스가 재사용될 땐 즉시 응답한다.
type CachedAnalysis = { data: Record<string, unknown>; expiresAt: number };
const ANALYSIS_CACHE = new Map<string, CachedAnalysis>();
const ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000; // 10분

// 새 브리핑을 만들 때 같은 종목의 과거 분석(stock_analyses)을 몇 건까지 참고할지.
// 너무 많으면 이력 요약 프롬프트가 길어지고 비용도 늘어나니 최근 것 위주로 적당히만 본다.
const HISTORY_LIMIT = 5;

// 프론트(CauseCard/CauseDetailView 등)가 이미 이 스키마로 렌더링하고 있어서 그대로 유지한다.
// 2단계(쩐형) 응답도 이 스키마에 맞춰 나오도록 강제한다.
const RESPONSE_SCHEMA = `{
  "oneLiner": string,               // 오늘 시세가 왜 그렇게 움직였는지 한 문장 (쩐형 말투로, 임팩트 있게)
  "causes": [
    {
      "title": string,              // 원인 제목 (예: "공급 계약 체결")
      "impact": "high" | "medium" | "low",
      "summary": string,            // 카드에 보일 2문장 이내 요약
      "conclusion": string,         // "한 줄로 말하면" — 이 원인 하나를 한 문장으로
      "timeline": [{ "title": string, "desc": string }],  // 2~3단계 인과관계, 사실 -> 시장 반응 -> 주가로 이어진 흐름
      "newsIndices": number[],      // 아래 제공된 뉴스 목록 중 이 원인의 근거가 되는 기사의 0-based 인덱스
      "expertOpinions": {
        "bullish": { "count": number, "summary": string },
        "bearish": { "count": number, "summary": string }
      },
      "similarCase": string         // 과거 비슷한 사례 1~2줄 (없으면 빈 문자열)
    }
  ],
  "aiComment": string                // 전체 흐름 3~4문장 정리, 쩐형 캐릭터 톤 유지, 투자 권유 문구 금지
}`;

function coerceBriefing(raw: unknown, news: NewsItem[]): Briefing {
  const data = (raw ?? {}) as Record<string, unknown>;
  const rawCauses = Array.isArray(data.causes) ? data.causes : [];

  const causes: Cause[] = rawCauses.slice(0, 4).map((rawCause, index) => {
    const cause = (rawCause ?? {}) as Record<string, unknown>;
    const impact = cause.impact === "high" || cause.impact === "medium" || cause.impact === "low" ? cause.impact : "medium";
    const rawTimeline = Array.isArray(cause.timeline) ? cause.timeline : [];
    const rawOpinions = (cause.expertOpinions ?? {}) as Record<string, unknown>;
    const bullish = (rawOpinions.bullish ?? {}) as Record<string, unknown>;
    const bearish = (rawOpinions.bearish ?? {}) as Record<string, unknown>;
    const newsIndices = Array.isArray(cause.newsIndices)
      ? cause.newsIndices.filter((value): value is number => typeof value === "number" && value >= 0 && value < news.length)
      : [];

    return {
      id: `cause-${index + 1}`,
      title: typeof cause.title === "string" && cause.title ? cause.title : `원인 ${index + 1}`,
      impact,
      summary: typeof cause.summary === "string" ? cause.summary : "",
      conclusion: typeof cause.conclusion === "string" ? cause.conclusion : "",
      timeline: rawTimeline
        .filter((step): step is Record<string, unknown> => !!step && typeof step === "object")
        .map((step) => ({
          title: typeof step.title === "string" ? step.title : "",
          desc: typeof step.desc === "string" ? step.desc : "",
        })),
      newsIndices,
      expertOpinions: {
        bullish: { count: typeof bullish.count === "number" ? bullish.count : 0, summary: typeof bullish.summary === "string" ? bullish.summary : "" },
        bearish: { count: typeof bearish.count === "number" ? bearish.count : 0, summary: typeof bearish.summary === "string" ? bearish.summary : "" },
      },
      similarCase: typeof cause.similarCase === "string" ? cause.similarCase : "",
    };
  });

  return {
    oneLiner: typeof data.oneLiner === "string" && data.oneLiner ? data.oneLiner : "오늘의 시세 변동 요약을 준비하지 못했어요.",
    causes,
    aiComment: typeof data.aiComment === "string" ? data.aiComment : "",
  };
}

// ---------------------------------------------------------------------------
// LLM 제공자 호출부 — 기본 제공자 실패 시 Gemini로 폴백한다(GEMINI_API_KEY 있을 때만).
// ---------------------------------------------------------------------------

const errMsg = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** OpenAI 호환 chat/completions (NVIDIA · OpenRouter 공용). */
async function callOpenAiCompatible(opts: {
  label: string;
  url: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  temperature: number;
  json?: boolean;
  maxTokens?: number;
  // OpenRouter 경유로 추론형 모델을 부를 때, reasoning 토큰이 출력 토큰 예산을 먹어치워서
  // 정작 눈에 보이는 답변이 문장 중간에 잘리는 걸 막는다("Solar 응답이 문장 중간에 끊긴다"
  // 버그의 원인) — 재작성처럼 깊은 추론이 필요 없는 작업엔 꺼두는 게 안전하다.
  disableReasoning?: boolean;
}): Promise<string> {
  const doFetch = () =>
    fetch(opts.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
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
  // 503(일시적 과부하)은 NVIDIA 무료 티어에서 종종 관찰되는, 몇 초 뒤 재시도하면 대부분
  // 바로 성공하는 패턴이다 — 매번 Gemini 폴백(하루 20회 한도)까지 태우지 않도록 한 번만
  // 짧게 재시도한다.
  if (response.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await doFetch();
  }
  if (!response.ok) throw new Error(`${opts.label} API 오류 (${response.status}): ${await response.text()}`);
  const payload = await response.json();
  const choice = payload.choices?.[0];
  const content = choice?.message?.content as string | undefined;
  if (!content) throw new Error(`${opts.label} 응답이 비어 있습니다.`);
  // finish_reason이 "length"면 토큰 한도 때문에 답변이 문장 중간에 잘린 것 — 이걸 그냥
  // 돌려주면 "안 끝난 문장"이 화면에 그대로 나가버리니, 에러로 던져서 Gemini 폴백을 타게 한다.
  if (choice?.finish_reason === "length") {
    throw new Error(`${opts.label} 응답이 토큰 한도로 중간에 잘렸습니다(finish_reason=length).`);
  }
  return content;
}

/**
 * NVIDIA(무료 티어, nemotron) — 1단계(원본 사실 분석) 전용. 2단계(쩐형 재작성)는
 * "분석은 NVIDIA, 멘트는 오픈소스 LLM"이라는 요구사항에 따라 아래 callGroq/callCerebras로
 * 넘어갔다 — 자세한 경위는 이 파일 상단 및 2단계 섹션 주석 참고. opts는 과거 2단계에서
 * JSON 응답 + 넉넉한 토큰 한도용으로 쓰던 흔적이라 지금은 안 쓰이지만, 다른 호출부 호환을
 * 위해 시그니처는 그대로 둔다.
 */
function callNvidia(
  system: string,
  prompt: string,
  temperature: number,
  opts?: { json?: boolean; maxTokens?: number },
): Promise<string> {
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
    json: opts?.json,
    maxTokens: opts?.maxTokens,
  });
}

/**
 * OpenRouter — 과거 분석 이력 요약 전용. NVIDIA/xAI(사실 분석·캐릭터 재작성)와는 별도로,
 * 오픈소스 가중치 모델(기본 Qwen)만 이 단계에 쓰기 위해 분리했다. OpenAI 호환 엔드포인트라
 * callOpenAiCompatible을 그대로 재사용한다. 모델을 바꾸고 싶으면 OPENROUTER_MODEL 환경변수만
 * 다른 OpenRouter 모델 슬러그로 바꾸면 된다(https://openrouter.ai/models 참고).
 *
 * notebooks/.env에 이미 `OpenRouter_API_KEY`(파스칼_스네이크 혼용) 표기로 들어있는 경우가 있어
 * 표준 표기(OPENROUTER_API_KEY)를 못 찾으면 그 이름도 한 번 더 시도한다 — 다른 키들처럼
 * .env 쪽을 강제로 통일하기보다, 이미 넣어둔 값을 그대로 쓸 수 있게 코드가 맞춰준다.
 */
function callOpenRouter(system: string, prompt: string, temperature: number): Promise<string> {
  const apiKey = serverEnv("OPENROUTER_API_KEY") || serverEnv("OpenRouter_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY를 .env에 설정하세요. (발급: https://openrouter.ai/keys)");
  return callOpenAiCompatible({
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    model: serverEnv("OPENROUTER_MODEL") || "qwen/qwen-2.5-72b-instruct",
    system,
    prompt,
    temperature,
  });
}

/**
 * Groq — 오픈소스(오픈 웨이트) 모델을 자체 칩(LPU)으로 서빙하는 회사. 무료 티어 유지가
 * 한시적 프로모션이 아니라 "속도 자랑용 무료 체험"이라는 사업모델 자체라서, Solar Pro 3
 * 때처럼 어느 날 갑자기 끊길 위험이 적다. 2단계(쩐형 재작성)를 "오픈소스 LLM이 쓴다"는
 * 요구사항에 맞춰 1순위 제공자로 쓴다.
 */
function callGroq(
  system: string,
  prompt: string,
  temperature: number,
  opts?: { json?: boolean; maxTokens?: number },
): Promise<string> {
  const apiKey = serverEnv("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY를 .env에 설정하세요. (발급: https://console.groq.com/keys)");
  return callOpenAiCompatible({
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    model: serverEnv("GROQ_MODEL") || "llama-3.3-70b-versatile",
    system,
    prompt,
    temperature,
    json: opts?.json,
    maxTokens: opts?.maxTokens,
  });
}

/** Cerebras — Groq와 같은 이유의 2순위 폴백. Groq가 무료 한도에 걸리거나 실패했을 때만 탄다. */
function callCerebras(
  system: string,
  prompt: string,
  temperature: number,
  opts?: { json?: boolean; maxTokens?: number },
): Promise<string> {
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
    json: opts?.json,
    maxTokens: opts?.maxTokens,
  });
}

async function callGemini(
  system: string,
  prompt: string,
  opts: { temperature: number; json?: boolean },
): Promise<string> {
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
        temperature: opts.temperature,
        // 재작성·요약 작업이라 깊은 추론이 필요 없다. thinking 토큰이 출력 한도를 잡아먹어
        // 스키마 JSON이 잘리는 걸 막으려고 thinking을 최소화하고 출력 한도를 넉넉히 잡는다.
        thinkingConfig: { thinkingLevel: "low" },
        maxOutputTokens: 16384,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
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
  if (finishReason && finishReason !== "STOP") {
    throw new Error(`Gemini 응답이 온전하지 않습니다 (${finishReason}).`);
  }
  return content;
}

/** 기본 제공자를 먼저 시도하고, 실패하면 Gemini로 한 번 더 시도한다. (1단계 원본 분석 전용) */
async function withGeminiFallback(
  label: string,
  primary: () => Promise<string>,
  gemini: () => Promise<string>,
): Promise<string> {
  try {
    return await primary();
  } catch (primaryError) {
    if (!serverEnv("GEMINI_API_KEY")) throw primaryError;
    console.warn(`[analyze] ${label} 기본 제공자 실패 → Gemini 폴백:`, errMsg(primaryError));
    try {
      return await gemini();
    } catch (fallbackError) {
      throw new Error(`${label} 실패 — 기본: ${errMsg(primaryError)} / Gemini 폴백: ${errMsg(fallbackError)}`);
    }
  }
}

/**
 * 제공자를 순서대로 시도하고, 앞선 게 실패하면 다음으로 넘어간다(2단계 쩐형 재작성 전용).
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
      console.warn(`[analyze] ${label} — ${provider.name} 실패, 다음 제공자로 폴백:`, errMsg(error));
    }
  }
  throw new Error(`${label} 전체 제공자 실패 — ${errors.join(" / ") || "설정된 API 키 없음"}`);
}

// ---------------------------------------------------------------------------
// 0단계: OpenRouter(오픈소스 모델, 기본 Qwen) — 같은 종목의 과거 분석 이력을 짧게 요약해
// 1단계 프롬프트에 참고 컨텍스트로 얹는다. 로그인 사용자만 이력이 있으므로, 비로그인이거나
// 처음 보는 종목이면 rows가 비어 있고 이 단계는 그냥 빈 문자열을 돌려준다(호출 자체를 스킵).
// 이력 요약은 어디까지나 참고용 부가 컨텍스트라 실패해도 본 분석 파이프라인을 막지 않는다.
// ---------------------------------------------------------------------------
type HistoryRow = { stock_name: string; briefing: Briefing; generated_at: string };

async function fetchAnalysisHistory(ticker: string): Promise<HistoryRow[]> {
  if (!ticker) return [];
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return []; // 비로그인 요청은 히스토리 자체가 없다(저장도 안 하므로).

  const { data, error } = await supabase
    .from("stock_analyses")
    .select("stock_name, briefing, generated_at")
    .eq("user_id", user.id)
    .eq("ticker", ticker)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.warn("[analyze] 과거 이력 조회 실패(컨텍스트 없이 계속 진행):", error);
    return [];
  }
  return (data ?? []) as HistoryRow[];
}

function buildHistorySummaryPrompt(name: string, ticker: string, rows: HistoryRow[]) {
  // 오래된 것부터 최신 순으로 나열해야 "흐름이 어떻게 바뀌어왔는지"를 모델이 읽기 쉽다.
  const entries = rows
    .slice()
    .reverse()
    .map((row, index) => {
      const date = new Date(row.generated_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
      const causeTitles = row.briefing.causes.map((cause) => cause.title).join(", ") || "없음";
      const commentGist = (row.briefing.aiComment || "").split("\n")[0];
      return `${index + 1}. [${date}] 한줄요약: ${row.briefing.oneLiner}\n   원인: ${causeTitles}\n   코멘트 요지: ${commentGist}`;
    })
    .join("\n\n");

  const system =
    "너는 리서치 어시스턴트다. 한 종목에 대한 과거 여러 차례의 분석 기록을 받아서, 다음 분석가가 참고할 " +
    "핵심만 짧게 정리한다. 새로운 사실을 지어내지 말고 주어진 기록만 근거로 요약해라. 한국어로 답하라.";
  const prompt = `${name}(${ticker})에 대한 과거 분석 ${rows.length}건이다(오래된 순).

${entries}

위 기록을 보고 다음을 3~4문장으로 정리해라.
1. 반복적으로 등장하는 원인·테마가 있다면 무엇인지
2. 최근 분석 흐름이 어떤 방향으로 바뀌어왔는지(있다면)
3. 오늘 새 분석을 쓸 때 참고하면 좋을 맥락 한 가지
근거가 부족하면 "특별한 반복 패턴 없음"이라고 써라.`;
  return { system, prompt };
}

async function summarizeHistory(name: string, ticker: string, rows: HistoryRow[]): Promise<string> {
  if (rows.length === 0) return "";
  try {
    const { system, prompt } = buildHistorySummaryPrompt(name, ticker, rows);
    return await callOpenRouter(system, prompt, 0.3);
  } catch (error) {
    console.warn("[analyze] 이력 요약 생성 실패(컨텍스트 없이 계속 진행):", errMsg(error));
    return "";
  }
}

// ---------------------------------------------------------------------------
// 1단계: NVIDIA (폴백 Gemini) — 사실 확인 목적의 원본 분석 (formal한 문체, 캐릭터 없음)
// ---------------------------------------------------------------------------
function buildRawAnalysisPrompt(
  name: string,
  ticker: string,
  price: Price,
  news: NewsItem[],
  fxSummary: string,
  intlRateSummary: string,
  historySummary: string,
) {
  const priceText = `종가: ${price.close ?? "데이터 없음"}, 등락률: ${price.changeRate ?? "데이터 없음"}%, 시가총액: ${price.marketCap ?? "데이터 없음"}`;
  const newsText = news.length
    ? news.map((item, index) => `${index}. ${item.title} (${item.pubDate})\n${item.description}`).join("\n")
    : "관련 뉴스 없음";
  const fxText = fxSummary || "데이터 없음";
  const intlRateText = intlRateSummary || "데이터 없음";
  const historyText = historySummary
    ? `\n[이 사용자가 과거에 이 종목을 조회했을 때의 분석 이력 요약 — 참고용]\n${historySummary}\n`
    : "";

  const system =
    "너는 한국 주식 리서치 애널리스트다. 제공된 데이터만 근거로 분석하고, 확인된 사실과 해석을 구분하라. " +
    "투자 매수·매도 권유나 확정적인 미래 예측은 하지 말라.";
  const prompt = `다음은 ${name}(${ticker})의 최근 시세와 네이버 뉴스, 오늘의 주요 환율·국제금리다.

[시세 데이터]
${priceText}
${historyText}
[오늘의 환율(매매기준율, 참고용)]
${fxText}

[오늘의 국제금리(참고용)]
${intlRateText}

[관련 뉴스]
${newsText}

아래 형식으로 한국어 종합 분석을 작성해라.
1. 최근 주가 흐름
2. 핵심 뉴스 요약: 주가에 영향을 줄 수 있는 뉴스 3~5개
3. 주가 변동 원인: 뉴스와 시세의 흐름을 연결한 근거 중심 분석. 이 종목이 수출입 비중이 크거나
   외화 표시 원자재/부품을 다루는 등 환율 변동에 실제로 노출된 업종이고, 뉴스에서도 그 근거가
   확인될 때만 위 환율 데이터를 원인 중 하나로 연결해라 — 관련 없으면 환율은 언급하지 마라.
   국제금리도 마찬가지로, 이 종목이 금리에 민감한 업종(금융·성장주·부동산 등)이거나 뉴스에서
   금리 관련 이슈를 직접 다룰 때만 언급하고, 그렇지 않으면 억지로 끌어다 쓰지 마라.
4. 긍정 요인과 부정 요인
5. 추가 확인할 리스크와 다음에 관찰할 지표
과거 분석 이력이 주어졌다면, 이번 분석이 그 흐름과 어떻게 이어지는지(반복되는지, 달라졌는지)도
간단히 짚어줘라 — 단, 이력 자체를 새로운 사실로 취급하지 말고 어디까지나 오늘 데이터가 우선이다.
각 항목은 간결한 문단 또는 bullet로 작성하고, 근거가 부족하면 '판단 유보'라고 표시해라.`;
  return { system, prompt };
}

async function analyzeRaw(
  name: string,
  ticker: string,
  price: Price,
  news: NewsItem[],
  fxSummary: string,
  intlRateSummary: string,
  historySummary: string,
): Promise<string> {
  const { system, prompt } = buildRawAnalysisPrompt(name, ticker, price, news, fxSummary, intlRateSummary, historySummary);
  return withGeminiFallback(
    "1단계 원본 분석",
    () => callNvidia(system, prompt, 0.2),
    () => callGemini(system, prompt, { temperature: 0.2 }),
  );
}

// ---------------------------------------------------------------------------
// 2단계: 오픈소스(Groq → Cerebras, 폴백 Gemini) — "쩐형" 캐릭터로 재작성
// (1단계 사실은 그대로, 톤만 바꾼다). "NVIDIA가 분석하고 오픈소스가 멘트를 쓴다"는
// 요구사항에 맞춰 1단계(analyzeRaw)는 NVIDIA, 2단계(여기)는 Groq/Cerebras를 우선 쓰고
// 둘 다 실패했을 때만 Gemini로 넘어간다.
// ---------------------------------------------------------------------------
type Tone = "mild" | "medium" | "spicy" | "nuclear";

const TONE_RULES: Record<Tone, string> = {
  mild: "말투 강도: 순한맛. 순화된 감탄사만 써라(헐, 미쳤다, 실화냐). 반말+장난기는 있지만 진짜 욕설은 절대 쓰지 마라.",
  medium: "말투 강도: 중간맛. 인터넷 밈체 허용(개- 접두어, ㅋㅋㅋ). 여전히 진짜 욕설은 쓰지 마라.",
  spicy: "말투 강도: 매운맛. '존나' 같은 순화된 강한 슬랭까지 써도 된다. 단 혐오·비하·특정 대상 조롱은 항상 금지.",
  nuclear:
    "말투 강도: 핵매운맛. 이 캐릭터의 최고 텐션 모드다. '존나', '개-', '미친', '씨발' 같은 표현을 감탄사로 마음껏 섞어 써도 좋다. " +
    "느낌표 남발, 과장된 리액션, 초딩 개그 다 좋다 — 텐션을 최대로 끌어올려라. 단, 아래 공통 금지사항은 강도와 무관하게 항상 지켜야 한다.",
};

// 톤 강도 선택 UI가 아직 없어서 기본값으로 고정 — 사용자 요청에 따라 nuclear(핵매운맛).
const DEFAULT_TONE: Tone = "nuclear";

// 캐릭터 톤과 무관하게 코드에서 항상 붙이는 면책 문구 (모델이 빼먹어도 항상 붙게).
const DISCLAIMER = "이 코멘트는 참고용 설명이며, 투자 판단과 책임은 본인에게 있습니다.";

function buildJeonhyungSystem(tone: Tone): string {
  return `너는 '쩐형'이라는 캐릭터야. 주식 초보 앞에서 능글맞게 훈수 두는 친한 형/누나.
성격: 잘난 척하다가 능청스럽게 넘어감, 가끔 유치한 드립도 침. 절대 고지식하게 안 씀.

${TONE_RULES[tone]}

방향별 리액션 규칙:
- 급등: 살짝 들뜬 톤 + 호들갑
- 급락: 놀란 척하다 침착하게 수습하는 톤
- 횡보: 심드렁하게, "에이 뭐 볼 거 있다고" 식

비유 소재 풀: 연애, 스포츠, 게임, 학교/시험 중 하나를 매번 다르게 골라서 써라.

공통 금지사항 (강도 무관, 항상 지켜라):
- 특정 인물·기업을 비하하거나 조롱하는 표현 금지
- 성별·지역·세대 등 특정 집단을 향한 비하·혐오 표현 금지
- "사야 한다/팔아야 한다" 같은 직접적 투자 지시 문장 금지 — 재미있게 설명하되 판단은 독자 몫으로 남겨라

아래 [1단계 분석]과 [뉴스 목록]에 있는 사실만 근거로 써라. 새로운 사실을 지어내지 마라.
사실과 추론을 구분하고, 근거가 부족한 값은 빈 문자열이나 빈 배열로 둔다. JSON 외의 텍스트는 출력하지 않는다.

스키마:
${RESPONSE_SCHEMA}`;
}

function buildRewritePrompt(name: string, ticker: string, rawAnalysis: string, news: NewsItem[]) {
  return `[1단계 분석]
종목: ${name}(${ticker})

${rawAnalysis}

[뉴스 목록 (인덱스: 제목 (게재일))]
${news.length ? news.map((item, index) => `${index}. ${item.title} (${item.pubDate})`).join("\n") : "없음"}`;
}

async function rewritePlain(
  name: string,
  ticker: string,
  rawAnalysis: string,
  news: NewsItem[],
  tone: Tone,
): Promise<Briefing> {
  const system = buildJeonhyungSystem(tone);
  const prompt = buildRewritePrompt(name, ticker, rawAnalysis, news);

  const content = await withFallbackChain("2단계 쩐형 재작성", [
    { name: "Groq", hasKey: !!serverEnv("GROQ_API_KEY"), call: () => callGroq(system, prompt, 0.9, { json: true, maxTokens: 4096 }) },
    { name: "Cerebras", hasKey: !!serverEnv("CEREBRAS_API_KEY"), call: () => callCerebras(system, prompt, 0.9, { json: true, maxTokens: 4096 }) },
    { name: "Gemini", hasKey: !!serverEnv("GEMINI_API_KEY"), call: () => callGemini(system, prompt, { temperature: 0.9, json: true }) },
  ]);

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error(`재작성 응답이 JSON이 아닙니다: ${(content ?? "").slice(0, 300)}`);
  }

  const briefing = coerceBriefing(raw, news);
  briefing.aiComment = briefing.aiComment ? `${briefing.aiComment}\n\n${DISCLAIMER}` : DISCLAIMER;
  return briefing;
}

// ---------------------------------------------------------------------------
// 히스토리 저장 — 로그인한 사용자에 한해, 새로 생성된 브리핑을 stock_analyses에 버전으로 남긴다.
// 캐시 히트로 응답한 경우엔 이미 이전 호출에서 저장됐을 것이므로 다시 저장하지 않는다(호출부에서
// isNew일 때만 이 함수를 부른다). 저장은 부가 기능이라 실패해도 브리핑 응답 자체를 막지 않는다 —
// 그래서 호출부는 이 함수를 항상 .catch로 감싸 에러를 삼킨다.
// ---------------------------------------------------------------------------
async function saveAnalysisForUser(
  ticker: string,
  name: string,
  data: { price: Price; news: NewsItem[]; briefing: Briefing; generatedAt: string },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // 비로그인 요청은 지금까지처럼 DB에 남기지 않는다.

  const { error } = await supabase.from("stock_analyses").insert({
    user_id: user.id,
    ticker,
    stock_name: name,
    price: data.price,
    news: data.news,
    briefing: data.briefing,
    generated_at: data.generatedAt,
  });
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    const { ok, retryAfterMs } = rateLimit(`analyze:${clientIp(request)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
    if (!ok) {
      return NextResponse.json(
        { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    const body = await request.json();
    const { name, ticker } = body as { name?: unknown; ticker?: unknown };
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "종목명이 필요합니다." }, { status: 400 });

    const requestedTone = (body as { tone?: unknown }).tone;
    const tone: Tone =
      typeof requestedTone === "string" && requestedTone in TONE_RULES ? (requestedTone as Tone) : DEFAULT_TONE;

    const tickerKey = typeof ticker === "string" ? ticker : "";
    const cacheKey = `${tickerKey || name}::${tone}`;
    const cachedEntry = ANALYSIS_CACHE.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return NextResponse.json(cachedEntry.data);
    }

    const [news, price, fxSummary, intlRateSummary, historySummary] = await Promise.all([
      getNewsMultiSource(name),
      getPriceForTicker(tickerKey),
      // 환율·국제금리는 참고용 보조 데이터라 실패해도 브리핑 전체를 막지 않는다 — 조용히 빈
      // 문자열로. 다만 원인 추적을 위해 로그는 남긴다(클라이언트 응답에는 영향 없음).
      fetchMajorRatesSummary().catch((error) => {
        console.warn("[analyze] 환율 조회 실패(브리핑은 계속 진행):", error);
        return "";
      }),
      fetchInternationalRatesSummary().catch((error) => {
        console.warn("[analyze] 국제금리 조회 실패(브리핑은 계속 진행):", error);
        return "";
      }),
      // 0단계(이력 요약)도 같이 병렬로 — 뉴스/시세 조회를 기다리는 동안 같이 끝나서 전체
      // 응답 시간이 거의 늘어나지 않는다. 실패해도 빈 문자열이라 아래 흐름은 그대로 간다.
      fetchAnalysisHistory(tickerKey)
        .then((rows) => summarizeHistory(name, tickerKey, rows))
        .catch((error) => {
          console.warn("[analyze] 이력 컨텍스트 준비 실패(계속 진행):", error);
          return "";
        }),
    ]);

    const raw = await analyzeRaw(name, tickerKey, price, news, fxSummary, intlRateSummary, historySummary);
    const briefing = await rewritePlain(name, tickerKey, raw, news, tone);

    const responseData = {
      stock: { name, ticker: ticker || "" },
      price,
      news,
      briefing,
      generatedAt: new Date().toISOString(),
    };
    ANALYSIS_CACHE.set(cacheKey, { data: responseData, expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS });

    // 새로 생성된 브리핑만 히스토리로 남긴다(캐시 히트 응답은 위에서 이미 return됨).
    // 응답 이후 서버리스 인스턴스가 곧바로 정리될 수 있어 fire-and-forget 대신 await로 저장을
    // 기다린 다음 응답한다 — 실패해도 catch로 삼켜서 브리핑 응답 자체는 항상 나가게 한다.
    await saveAnalysisForUser(tickerKey, name, responseData).catch((error) => {
      console.warn("[analyze] 히스토리 저장 실패:", error);
    });

    return NextResponse.json(responseData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
