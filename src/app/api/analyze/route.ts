import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { getPriceForTicker } from "@/lib/krx";
import { Briefing, Cause, NewsItem, Price } from "@/lib/types";

type Lang = "ko" | "en";

const NAVER_URL = "https://openapi.naver.com/v1/search/news.json";

// 같은 종목을 짧은 시간 안에 다시 요청하면(평가 데모 등) 2단계 LLM 파이프라인을 다시 태우지 않고
// 캐시된 결과를 즉시 돌려준다. 서버리스 인스턴스가 살아있는 동안만 유지되는 best-effort 캐시라
// 인스턴스가 새로 뜨면 다시 처음부터 호출하지만, 같은 웜 인스턴스가 재사용될 땐 즉시 응답한다.
type CachedAnalysis = { data: Record<string, unknown>; expiresAt: number };
const ANALYSIS_CACHE = new Map<string, CachedAnalysis>();
const ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000; // 10분

function clean(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
}

async function getNews(query: string): Promise<NewsItem[]> {
  const clientId = serverEnv("NAVER_CLIENT_ID");
  const clientSecret = serverEnv("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 .env에 설정하세요.");
  const response = await fetch(`${NAVER_URL}?query=${encodeURIComponent(query)}&display=10&sort=date`, {
    headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`네이버 뉴스 API 오류 (${response.status})`);
  const items = (await response.json()).items ?? [];
  return items.map((item: { title: string; description: string; link: string; pubDate: string }) => ({
    title: clean(item.title), description: clean(item.description), link: item.link, pubDate: item.pubDate,
  }));
}

// 프론트(CauseCard/CauseDetailView 등)가 이미 이 스키마로 렌더링하고 있어서 그대로 유지한다.
// 2단계(쩐형) 응답도 이 스키마에 맞춰 나오도록 강제한다. (필드 이름은 언어와 무관하게 고정,
// 실제 값 텍스트만 lang에 따라 한국어/영어로 나온다 — 각 언어 시스템 프롬프트가 지시한다.)
const RESPONSE_SCHEMA = `{
  "oneLiner": string,               // 오늘 시세가 왜 그렇게 움직였는지 한 문장 (캐릭터 말투로, 임팩트 있게)
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
  "aiComment": string                // 전체 흐름 3~4문장 정리, 캐릭터 톤 유지, 투자 권유 문구 금지
}`;

function coerceBriefing(raw: unknown, news: NewsItem[], lang: Lang): Briefing {
  const data = (raw ?? {}) as Record<string, unknown>;
  const rawCauses = Array.isArray(data.causes) ? data.causes : [];
  const fallbackOneLiner = lang === "en" ? "Couldn't prepare a summary of today's move." : "오늘의 시세 변동 요약을 준비하지 못했어요.";
  const fallbackCauseTitle = (index: number) => (lang === "en" ? `Cause ${index + 1}` : `원인 ${index + 1}`);

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
      title: typeof cause.title === "string" && cause.title ? cause.title : fallbackCauseTitle(index),
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
    oneLiner: typeof data.oneLiner === "string" && data.oneLiner ? data.oneLiner : fallbackOneLiner,
    causes,
    aiComment: typeof data.aiComment === "string" ? data.aiComment : "",
  };
}

// ---------------------------------------------------------------------------
// LLM 제공자 호출부 — 기본 제공자 실패 시 Gemini로 폴백한다(GEMINI_API_KEY 있을 때만).
// ---------------------------------------------------------------------------

const errMsg = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** OpenAI 호환 chat/completions (NVIDIA · xAI 공용). */
async function callOpenAiCompatible(opts: {
  label: string;
  url: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  temperature: number;
  json?: boolean;
}): Promise<string> {
  const response = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${opts.label} API 오류 (${response.status}): ${await response.text()}`);
  const content = (await response.json()).choices?.[0]?.message?.content as string | undefined;
  if (!content) throw new Error(`${opts.label} 응답이 비어 있습니다.`);
  return content;
}

function callNvidia(system: string, prompt: string, temperature: number): Promise<string> {
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
  });
}

function callXai(system: string, prompt: string, temperature: number, json: boolean): Promise<string> {
  const apiKey = serverEnv("XAI_API_KEY");
  if (!apiKey) throw new Error("XAI_API_KEY를 .env에 설정하세요.");
  return callOpenAiCompatible({
    label: "xAI",
    url: "https://api.x.ai/v1/chat/completions",
    apiKey,
    model: serverEnv("XAI_MODEL") || "grok-4-1-fast-non-reasoning",
    system,
    prompt,
    temperature,
    json,
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

/** 기본 제공자를 먼저 시도하고, 실패하면 Gemini로 한 번 더 시도한다. */
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

// ---------------------------------------------------------------------------
// 1단계: NVIDIA (폴백 Gemini) — 사실 확인 목적의 원본 분석 (formal한 문체, 캐릭터 없음)
// ---------------------------------------------------------------------------
function buildRawAnalysisPrompt(name: string, ticker: string, price: Price, news: NewsItem[], lang: Lang) {
  if (lang === "en") {
    const priceText = `Close: ${price.close ?? "no data"}, Change: ${price.changeRate ?? "no data"}%, Market cap: ${price.marketCap ?? "no data"}`;
    const newsText = news.length
      ? news.map((item, index) => `${index}. ${item.title} (${item.pubDate})\n${item.description}`).join("\n")
      : "No related news";

    const system =
      "You are a research analyst covering Korean equities. Base your analysis only on the data provided, and clearly separate " +
      "confirmed facts from interpretation. Do not recommend buying or selling, and do not make definitive predictions.";
    const prompt = `Below is recent price data and Naver News coverage for ${name} (${ticker}).

[Price data]
${priceText}

[Related news]
${newsText}

Write a comprehensive analysis in English using the format below.
1. Recent price trend
2. Key news summary: 3-5 news items that could be moving the price
3. Cause of the price move: evidence-based analysis connecting the news to the price action
4. Positive and negative factors
5. Remaining risks to watch and indicators to monitor next
Write each section as a concise paragraph or bullet list, and note "insufficient evidence" wherever the basis is weak.`;
    return { system, prompt };
  }

  const priceText = `종가: ${price.close ?? "데이터 없음"}, 등락률: ${price.changeRate ?? "데이터 없음"}%, 시가총액: ${price.marketCap ?? "데이터 없음"}`;
  const newsText = news.length
    ? news.map((item, index) => `${index}. ${item.title} (${item.pubDate})\n${item.description}`).join("\n")
    : "관련 뉴스 없음";

  const system =
    "너는 한국 주식 리서치 애널리스트다. 제공된 데이터만 근거로 분석하고, 확인된 사실과 해석을 구분하라. " +
    "투자 매수·매도 권유나 확정적인 미래 예측은 하지 말라.";
  const prompt = `다음은 ${name}(${ticker})의 최근 시세와 네이버 뉴스다.

[시세 데이터]
${priceText}

[관련 뉴스]
${newsText}

아래 형식으로 한국어 종합 분석을 작성해라.
1. 최근 주가 흐름
2. 핵심 뉴스 요약: 주가에 영향을 줄 수 있는 뉴스 3~5개
3. 주가 변동 원인: 뉴스와 시세의 흐름을 연결한 근거 중심 분석
4. 긍정 요인과 부정 요인
5. 추가 확인할 리스크와 다음에 관찰할 지표
각 항목은 간결한 문단 또는 bullet로 작성하고, 근거가 부족하면 '판단 유보'라고 표시해라.`;
  return { system, prompt };
}

async function analyzeRaw(name: string, ticker: string, price: Price, news: NewsItem[], lang: Lang): Promise<string> {
  const { system, prompt } = buildRawAnalysisPrompt(name, ticker, price, news, lang);
  return withGeminiFallback(
    "1단계 원본 분석",
    () => callNvidia(system, prompt, 0.2),
    () => callGemini(system, prompt, { temperature: 0.2 }),
  );
}

// ---------------------------------------------------------------------------
// 2단계: xAI Grok (폴백 Gemini) — 캐릭터로 재작성 (1단계 사실은 그대로, 톤만 바꾼다)
// 한국어는 '쩐형', 영어는 그 캐릭터를 영어권 인터넷 밈 톤으로 옮긴 'Money Bro'.
// ---------------------------------------------------------------------------
type Tone = "mild" | "medium" | "spicy" | "nuclear";

const TONE_RULES: Record<Lang, Record<Tone, string>> = {
  ko: {
    mild: "말투 강도: 순한맛. 순화된 감탄사만 써라(헐, 미쳤다, 실화냐). 반말+장난기는 있지만 진짜 욕설은 절대 쓰지 마라.",
    medium: "말투 강도: 중간맛. 인터넷 밈체 허용(개- 접두어, ㅋㅋㅋ). 여전히 진짜 욕설은 쓰지 마라.",
    spicy: "말투 강도: 매운맛. '존나' 같은 순화된 강한 슬랭까지 써도 된다. 단 혐오·비하·특정 대상 조롱은 항상 금지.",
    nuclear:
      "말투 강도: 핵매운맛. 이 캐릭터의 최고 텐션 모드다. '존나', '개-', '미친', '씨발' 같은 표현을 감탄사로 마음껏 섞어 써도 좋다. " +
      "느낌표 남발, 과장된 리액션, 초딩 개그 다 좋다 — 텐션을 최대로 끌어올려라. 단, 아래 공통 금지사항은 강도와 무관하게 항상 지켜야 한다.",
  },
  en: {
    mild: "Tone intensity: mild. Only clean interjections (whoa, no way, wild). Casual and playful, but never real profanity.",
    medium: "Tone intensity: medium. Internet meme-speak is welcome (lowkey/highkey, fr fr, lol). Still no real profanity.",
    spicy:
      "Tone intensity: spicy. Strong-but-clean slang is fine (damn, hell, screw it). Never mock or demean a specific real " +
      "person, company, or group, no matter how spicy it gets.",
    nuclear:
      "Tone intensity: nuclear — max energy mode for this character. Sprinkle in words like 'damn', 'hell', 'freaking' as pure " +
      "interjections, pile on exclamation points, exaggerated reactions, corny jokes — go all out. The shared rules below still " +
      "always apply no matter the intensity.",
  },
};

// 톤 강도 선택 UI가 아직 없어서 기본값으로 고정 — 사용자 요청에 따라 nuclear(핵매운맛).
const DEFAULT_TONE: Tone = "nuclear";

// 캐릭터 톤과 무관하게 코드에서 항상 붙이는 면책 문구 (모델이 빼먹어도 항상 붙게).
const DISCLAIMER: Record<Lang, string> = {
  ko: "이 코멘트는 참고용 설명이며, 투자 판단과 책임은 본인에게 있습니다.",
  en: "This commentary is for informational purposes only — investment decisions and responsibility are your own.",
};

function buildJeonhyungSystem(tone: Tone, lang: Lang): string {
  if (lang === "en") {
    return `You are "Money Bro" — a cocky-but-lovable older-sibling type who loves giving stock tips to beginners, with a wink.
Personality: acts like a know-it-all, then plays it off smoothly. Drops the occasional corny joke. Never stiff or formal.

${TONE_RULES.en[tone]}

Reaction rules by direction:
- Sharp rally: slightly hyped tone + over-the-top excitement
- Sharp drop: pretend to be shocked, then calmly walk it back
- Sideways: unbothered, "eh, nothing to see here" energy

Rotate the analogy source each time — pick one of: dating, sports, video games, or school/exams.

Rules that always apply, no matter the intensity:
- Never mock or demean a specific real person or company
- Never use language that demeans or expresses hatred toward a gender, region, generation, or other group
- Never write a direct instruction like "you should buy/sell" — make it entertaining, but leave the call to the reader

Base everything only on the facts in the [Stage 1 analysis] and [news list] below. Do not invent new facts.
Separate fact from inference, and leave any value with insufficient evidence as an empty string or empty array.
Write every text value in English. Output nothing but the JSON.

Schema:
${RESPONSE_SCHEMA}`;
  }

  return `너는 '쩐형'이라는 캐릭터야. 주식 초보 앞에서 능글맞게 훈수 두는 친한 형/누나.
성격: 잘난 척하다가 능청스럽게 넘어감, 가끔 유치한 드립도 침. 절대 고지식하게 안 씀.

${TONE_RULES.ko[tone]}

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

function buildRewritePrompt(name: string, ticker: string, rawAnalysis: string, news: NewsItem[], lang: Lang) {
  if (lang === "en") {
    return `[Stage 1 analysis]
Stock: ${name} (${ticker})

${rawAnalysis}

[News list (index: title (published))]
${news.length ? news.map((item, index) => `${index}. ${item.title} (${item.pubDate})`).join("\n") : "None"}`;
  }

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
  lang: Lang,
): Promise<Briefing> {
  const system = buildJeonhyungSystem(tone, lang);
  const prompt = buildRewritePrompt(name, ticker, rawAnalysis, news, lang);

  const content = await withGeminiFallback(
    "2단계 캐릭터 재작성",
    () => callXai(system, prompt, 0.9, true),
    () => callGemini(system, prompt, { temperature: 0.9, json: true }),
  );

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error(`재작성 응답이 JSON이 아닙니다: ${(content ?? "").slice(0, 300)}`);
  }

  const briefing = coerceBriefing(raw, news, lang);
  briefing.aiComment = briefing.aiComment ? `${briefing.aiComment}\n\n${DISCLAIMER[lang]}` : DISCLAIMER[lang];
  return briefing;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, ticker, lang: rawLang } = body as { name?: unknown; ticker?: unknown; lang?: unknown };
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "종목명이 필요합니다." }, { status: 400 });

    const lang: Lang = rawLang === "en" ? "en" : "ko";

    const requestedTone = (body as { tone?: unknown }).tone;
    const tone: Tone =
      typeof requestedTone === "string" && requestedTone in TONE_RULES.ko ? (requestedTone as Tone) : DEFAULT_TONE;

    const tickerKey = typeof ticker === "string" ? ticker : "";
    const cacheKey = `${tickerKey || name}::${tone}::${lang}`;
    const cachedEntry = ANALYSIS_CACHE.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return NextResponse.json(cachedEntry.data);
    }

    const [news, price] = await Promise.all([getNews(name), getPriceForTicker(tickerKey)]);

    const raw = await analyzeRaw(name, tickerKey, price, news, lang);
    const briefing = await rewritePlain(name, tickerKey, raw, news, tone, lang);

    const responseData = {
      stock: { name, ticker: ticker || "" },
      price,
      news,
      briefing,
      generatedAt: new Date().toISOString(),
    };
    ANALYSIS_CACHE.set(cacheKey, { data: responseData, expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS });

    return NextResponse.json(responseData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
