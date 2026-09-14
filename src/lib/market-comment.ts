import { serverEnv } from "./server-env";
import { getNewsMultiSource } from "./news-sources";
import { MarketIndex } from "./types";

/**
 * 홈 화면 코스피/코스닥 지수 스트립 아래 붙는 "오늘 시장 분위기 한 줄" — 종목 브리핑의
 * '쩐형' 캐릭터와 같은 톤을 쓴다. analyze/route.ts의 2단계 재작성은 종목 하나짜리 JSON
 * 스키마(Briefing)를 채우는 용도라 여기(지수 전체를 보고 평문 한 문장만 뽑으면 되는 용도)엔
 * 안 맞고, analyze/route.ts는 이미 500줄 넘게 커져서 거길 손대면 엉뚱한 회귀가 날 위험이
 * 크다. 그래서 제공자 호출부(Solar via OpenRouter/Gemini)만 최소한으로 복제해 이 파일 안에서
 * 자체 처리한다.
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
}): Promise<string> {
  const response = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
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

/**
 * Upstage Solar Pro 3(한국어 특화 MoE, OpenRouter 무료 티어) — OpenRouter 경유.
 * analyze/route.ts 2단계(쩐형 재작성)와 같은 이유로 xAI 대신 이걸 쓴다 — 계정 크레딧 만료+
 * 한국어 특화 + 계속 무료로 쓸 수 있다는 게 이유. 같은 OPENROUTER_API_KEY를 공유하니
 * 트래픽이 늘면(무료 티어는 계정당 하루 50회, $10 이상 충전 시 1000회) OpenRouter에
 * 소액 충전이 필요할 수 있다.
 */
function callSolar(system: string, prompt: string, temperature: number): Promise<string> {
  const apiKey = serverEnv("OPENROUTER_API_KEY") || serverEnv("OpenRouter_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY를 .env에 설정하세요. (발급: https://openrouter.ai/keys)");
  return callOpenAiCompatible({
    label: "Solar(OpenRouter)",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    model: serverEnv("SOLAR_MODEL") || "upstage/solar-pro-3:free",
    system,
    prompt,
    temperature,
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

/** 기본 제공자(xAI)를 먼저 시도하고, 실패하면 Gemini로 한 번 더 시도한다. */
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

function buildSystem(): string {
  return `너는 '쩐형'이라는 캐릭터야. 주식 초보 앞에서 능글맞게 훈수 두는 친한 형/누나.
성격: 잘난 척하다가 능청스럽게 넘어감, 가끔 유치한 드립도 침. 절대 고지식하게 안 씀.

말투 강도: 핵매운맛. 이 캐릭터의 최고 텐션 모드다. '존나', '개-', '미친', '씨발' 같은 표현을 감탄사로
마음껏 섞어 써도 좋다. 느낌표 남발, 과장된 리액션 다 좋다 — 텐션을 최대로 끌어올려라. 단, 아래 공통
금지사항은 항상 지켜야 한다.

공통 금지사항 (항상 지켜라):
- 특정 인물·기업을 비하하거나 조롱하는 표현 금지
- 성별·지역·세대 등 특정 집단을 향한 비하·혐오 표현 금지
- "사야 한다/팔아야 한다" 같은 직접적 투자 지시 문장 금지 — 재미있게 설명하되 판단은 독자 몫으로 남겨라
- 새로운 사실을 지어내지 마라 — 아래 지수 데이터와 뉴스 헤드라인만 근거로 써라

출력 형식: 코스피·코스닥을 합쳐 오늘 국내 증시 전체 분위기를 설명하는 딱 한 문장만 출력해라.
따옴표, 줄바꿈, 부가 설명 없이 문장 하나만 출력한다.`;
}

function formatIndexLine(index: MarketIndex): string {
  const rate =
    index.changeRate !== null ? `${index.changeRate > 0 ? "+" : ""}${index.changeRate.toFixed(2)}%` : "등락률 없음";
  return `${index.name}: ${index.close ?? "데이터 없음"} (${rate})`;
}

function buildPrompt(indices: MarketIndex[], headlines: string[]): string {
  const indexText = indices.map(formatIndexLine).join("\n");
  const newsText = headlines.length ? headlines.map((title, i) => `${i + 1}. ${title}`).join("\n") : "관련 뉴스 없음";

  return `오늘 코스피·코스닥 지수와 증권 뉴스 헤드라인이다. 이걸 보고 오늘 국내 증시 전체 분위기를
쩐형 캐릭터 톤으로 한 문장 코멘트해라.

[오늘의 지수]
${indexText}

[관련 뉴스 헤드라인]
${newsText}`;
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
 * 설명할 수 있다. 뉴스 수집이든 코멘트 생성이든 실패해도 예외를 던지지 않고 null을 돌려준다 —
 * 코멘트는 어디까지나 부가 기능이라, 실패해도 지수 스트립 자체는 코멘트 없이 계속 떠야 한다.
 */
export async function getMarketComment(indices: MarketIndex[]): Promise<string | null> {
  if (indices.length === 0) return null;
  try {
    const headlines = await collectMarketHeadlines();
    const system = buildSystem();
    const prompt = buildPrompt(indices, headlines);
    const comment = await withGeminiFallback(
      "시장 분위기 코멘트",
      () => callSolar(system, prompt, 0.9),
      () => callGemini(system, prompt, 0.9),
    );
    return comment.trim() || null;
  } catch (error) {
    console.warn("[market-comment] 코멘트 생성 실패(코멘트 없이 진행):", errMsg(error));
    return null;
  }
}
