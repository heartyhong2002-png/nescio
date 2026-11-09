import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { serverEnv } from "@/lib/server-env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { MetricNote, ValuationInterpretation } from "@/lib/types";

// xAI 호출 1건이라 analyze보다는 가볍지만, 종목당 캐시(10분)를 우회해 다른 숫자 조합으로
// 계속 찔러 비용을 태우는 걸 막기 위해 IP당 분당 10회로 제한한다.
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

/**
 * 재무지표(PER/PBR/배당수익률/시가총액)를 주식 초보자 눈높이로 한두 문장씩 풀어준다.
 * 종목 페이지의 "회사 숫자로 보기" 카드 밑에 붙는 해설이라 캐릭터(쩐형) 톤은 쓰지 않고,
 * 친구가 옆에서 설명해주는 정도의 편한 존댓말로만 쓴다.
 *
 * 원칙: 주어진 숫자만 해석한다. 이 회사의 실적·뉴스·목표주가 같은 새 사실은 절대 지어내지 않는다.
 * (예금 금리, 코스피 평균 PER 같은 '일반적인 비교 기준'은 대략적인 눈금으로만 허용)
 */

type MetricsInput = {
  per: number | null;
  pbr: number | null;
  dividend: number | null; // 배당수익률 %
  marketCap: number | null; // 원 단위
};

type Body = {
  stock?: { name?: unknown; ticker?: unknown };
  metrics?: Partial<Record<keyof MetricsInput, unknown>>;
  currentPrice?: { close?: unknown; changeRate?: unknown };
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function eok(value: number) {
  return Math.round(value / 1e8).toLocaleString("ko-KR");
}

const RESPONSE_SCHEMA = `{
  "per":       { "meaning": string, "interpretation": string },
  "pbr":       { "meaning": string, "interpretation": string },
  "dividend":  { "meaning": string, "interpretation": string },
  "marketCap": { "meaning": string, "interpretation": string }
}`;

const SYSTEM = `너는 주식 투자 초보자를 위한 '지표 해석가'다.
PER, PBR, 배당수익률, 시가총액 네 가지 숫자를 받아서 "이게 뭐고 뭘 의미하는지"를 쉽게 풀어준다.

톤:
- 전문가처럼 어렵게 X, 친구가 옆에서 설명하듯 편한 존댓말 O
- 숫자 자체보다 "그래서 무슨 뜻인지"를 말해준다
- 판단에 도움되는 관점을 던지되, 사라/팔라 같은 지시는 하지 않는다

각 지표는 두 문장으로:
- meaning: 이 숫자가 뭘 뜻하는지 (예: "주가가 1주당 순이익의 12배 수준이라는 뜻이에요")
- interpretation: 그래서 저평가/고평가/평범한지, 무엇과 비교하면 감이 오는지 한 문장
  - PER/PBR: 낮으면 상대적으로 싸게, 높으면 비싸게 거래된다는 관점 (코스피 평균 PER은 대략 10~12배 수준)
  - dividend: 은행 예금 금리(대략 연 3% 안팎)나 주식 시장 평균 배당수익률(대략 2% 안팎)과 비교
  - marketCap: 회사 전체를 통째로 사는 데 드는 값. 규모가 큰지 작은지 감을 준다

엄격한 금지사항:
- 이 회사의 실적, 사업 내용, 뉴스, 실적 전망, 적정주가 등 "주어지지 않은 사실"을 지어내지 마라
- 주어진 네 숫자와, 위에 적힌 일반적인 비교 기준(예금 금리·시장 평균) 외의 정보는 쓰지 마라
- 값이 null(데이터 없음)인 지표는 meaning에 "지금은 이 값이 제공되지 않아요"라고 쓰고 interpretation은 빈 문자열로 둔다

JSON만 출력한다. 스키마:
${RESPONSE_SCHEMA}`;

function buildPrompt(name: string, ticker: string, metrics: MetricsInput, close: number | null, changeRate: number | null) {
  const lines = [
    `종목: ${name}${ticker ? ` (${ticker})` : ""}`,
    close !== null ? `현재가: ${close.toLocaleString("ko-KR")}원 (등락률 ${changeRate ?? "?"}%)` : "현재가: 데이터 없음",
    `PER: ${metrics.per !== null ? `${metrics.per}배` : "null"}`,
    `PBR: ${metrics.pbr !== null ? `${metrics.pbr}배` : "null"}`,
    `배당수익률: ${metrics.dividend !== null ? `${metrics.dividend}%` : "null"}`,
    `시가총액: ${metrics.marketCap !== null ? `약 ${eok(metrics.marketCap)}억 원` : "null"}`,
  ];
  return lines.join("\n");
}

function note(raw: unknown): MetricNote {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    meaning: typeof value.meaning === "string" ? value.meaning : "",
    interpretation: typeof value.interpretation === "string" ? value.interpretation : "",
  };
}

function coerce(raw: unknown): ValuationInterpretation {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    per: note(data.per),
    pbr: note(data.pbr),
    dividend: note(data.dividend),
    marketCap: note(data.marketCap),
  };
}

const EMPTY: MetricNote = { meaning: "지금은 이 값이 제공되지 않아요.", interpretation: "" };

// 같은 종목 페이지가 데스크톱/모바일 레이아웃을 둘 다 렌더링해서 요청이 두 번 온다.
// 지표는 10분 캐시(fetchValuation)라 짧게 캐시 + 인플라이트 합치기로 xAI 중복 호출을 막는다.
type CacheEntry = { promise: Promise<ValuationInterpretation>; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60_000;

function cacheKey(ticker: string, name: string, m: MetricsInput, close: number | null, changeRate: number | null) {
  const model = serverEnv("OLLAMA_MODEL") || serverEnv("GROQ_MODEL") || "openai/gpt-oss-120b";
  // close를 100원 단위로 반올림 — 미세한 가격 변동으로 캐시를 깨뜨리지 않으면서도,
  // 의미 있게 다른 가격에서는 다른 해설을 생성한다.
  const roundedClose = close !== null ? Math.round(close / 100) * 100 : "null";
  return [ticker, name.trim().toLowerCase(), m.per, m.pbr, m.dividend, m.marketCap, roundedClose, changeRate, model].join("|");
}

function buildRuleBasedFallback(metrics: MetricsInput): ValuationInterpretation {
  return {
    per:
      metrics.per !== null
        ? {
            meaning: `현재 주가가 1주당 순이익의 ${metrics.per}배 수준에서 거래되고 있다는 뜻이에요.`,
            interpretation:
              metrics.per < 10
                ? "코스피 평균(약 10~12배)보다 낮은 편이라 이익 대비 주가가 비교적 저렴한 구간으로 볼 수 있어요."
                : metrics.per <= 15
                  ? "코스피 평균(약 10~12배)과 비슷하거나 완만한 프리미엄이 반영된 수준이에요."
                  : "시장 평균보다 높은 배수로, 향후 성장성에 대한 기대가 주가에 반영되어 있어요.",
          }
        : EMPTY,
    pbr:
      metrics.pbr !== null
        ? {
            meaning: `주가가 회사의 순자산(장부가치) 대비 ${metrics.pbr}배 수준이라는 뜻이에요.`,
            interpretation:
              metrics.pbr < 1
                ? "1배 미만이면 회사가 가진 순자산보다 시가총액이 낮게 평가된 저PBR 구간이에요."
                : metrics.pbr <= 2
                  ? "순자산 대비 무난한 수준에서 거래되고 있어요."
                  : "자본 효율성이나 미래 성장 기대가 반영되어 장부가치보다 높게 거래되고 있어요.",
          }
        : EMPTY,
    dividend:
      metrics.dividend !== null
        ? {
            meaning: `현재 주가로 매수했을 때 1년간 기대할 수 있는 배당금 비율이 약 ${metrics.dividend}%예요.`,
            interpretation:
              metrics.dividend >= 3.5
                ? "은행 예금 금리(약 3% 안팎)나 시장 평균(약 2%)보다 높은 편이라 배당 매력이 돋보여요."
                : metrics.dividend >= 1.5
                  ? "주식 시장 평균(약 2% 안팎)과 비슷한 수준의 배당을 지급하고 있어요."
                  : "배당보다는 사업 재투자나 주가 성장에 무게를 두는 흐름에 가까워요.",
          }
        : EMPTY,
    marketCap:
      metrics.marketCap !== null
        ? {
            meaning: `이 회사 전체 주식을 모두 합친 시장 가치가 약 ${eok(metrics.marketCap)}억 원이라는 뜻이에요.`,
            interpretation:
              metrics.marketCap >= 10_000_000_000_000
                ? "시가총액 10조 원 이상의 대형주로 시장 대표성과 유동성이 매우 높은 편이에요."
                : metrics.marketCap >= 1_000_000_000_000
                  ? "시가총액 1조 원 이상의 중대형주로 기관 수급과 시장 관심이 활발한 규모예요."
                  : "중소형주 규모로 이슈나 수급 변화에 따라 주가 탄력이 비교적 크게 나타날 수 있어요.",
          }
        : EMPTY,
  };
}

async function callOpenAiCompatibleJson(opts: {
  url: string;
  apiKey?: string;
  model: string;
  prompt: string;
  reasoningEffort?: "low" | "medium" | "high";
}): Promise<ValuationInterpretation> {
  const response = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.4,
      ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: opts.prompt },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`LLM API 오류 (${response.status}): ${await response.text()}`);
  const content = (await response.json()).choices?.[0]?.message?.content as string;
  return coerce(JSON.parse(content));
}

async function generate(
  name: string,
  ticker: string,
  metrics: MetricsInput,
  close: number | null,
  changeRate: number | null,
): Promise<ValuationInterpretation> {
  const prompt = buildPrompt(name, ticker, metrics, close, changeRate);

  // 1. 명시적으로 OLLAMA_BASE_URL이 설정된 경우 우선 시도
  const ollamaBase = serverEnv("OLLAMA_BASE_URL");
  if (ollamaBase) {
    try {
      return await callOpenAiCompatibleJson({
        url: `${ollamaBase}/v1/chat/completions`,
        apiKey: serverEnv("OLLAMA_API_KEY"),
        model: serverEnv("OLLAMA_MODEL") || "qwen2.5:7b-instruct",
        prompt,
      });
    } catch (error) {
      console.warn("[valuation/interpret] Ollama 호출 실패, 다음 제공자로 폴백:", error);
    }
  }

  // 2. Groq (GPT-OSS 120B) 시도
  const groqKey = serverEnv("GROQ_API_KEY");
  if (groqKey) {
    try {
      return await callOpenAiCompatibleJson({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: groqKey,
        model: serverEnv("GROQ_MODEL") || "openai/gpt-oss-120b",
        prompt,
        reasoningEffort: "low",
      });
    } catch (error) {
      console.warn("[valuation/interpret] Groq 호출 실패, 다음 제공자로 폴백:", error);
    }
  }

  // 3. Gemini 시도
  const geminiKey = serverEnv("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      const model = serverEnv("GEMINI_MODEL") || "gemini-3.8-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            thinkingConfig: { thinkingLevel: "low" },
            responseMimeType: "application/json",
          },
        }),
        cache: "no-store",
      });
      if (response.ok) {
        const payload = await response.json();
        const text = payload.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
        if (text) return coerce(JSON.parse(text));
      }
    } catch (error) {
      console.warn("[valuation/interpret] Gemini 호출 실패, 룰베이스 폴백 적용:", error);
    }
  }

  // 4. 모든 제공자 장애 시에도 500 오류 대신 정량 기준 기반 해설을 반환
  return buildRuleBasedFallback(metrics);
}

// 로그인한 사용자에 한해, 새로 생성된 해설을 valuation_interpretations에 버전으로 남긴다.
// 캐시 히트(같은 종목·같은 지표 조합을 10분 내 재요청)면 이미 저장된 것이므로 호출부에서
// isNew일 때만 부른다. 부가 기능이라 실패해도 응답 자체는 막지 않는다.
async function saveInterpretationForUser(
  ticker: string,
  name: string,
  metrics: MetricsInput,
  interpretation: ValuationInterpretation,
  close: number | null,
  changeRate: number | null,
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("valuation_interpretations").insert({
    user_id: user.id,
    ticker,
    stock_name: name,
    // metrics jsonb에 입력 지표 + 요청 시점의 현재가·등락률을 함께 저장한다.
    // 나중에 "어떤 가격 기준으로 이 해설이 만들어졌는지" 추적할 수 있다.
    metrics: { ...metrics, currentPrice: { close, changeRate } },
    interpretation,
  });
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    const { ok, retryAfterMs } = rateLimit(`interpret:${clientIp(request)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
    if (!ok) {
      return NextResponse.json(
        { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    const auth = await requireAuth();
    if (auth.response) return auth.response;

    const body = (await request.json()) as Body;
    const name = typeof body.stock?.name === "string" ? body.stock.name.trim() : "";
    const ticker = typeof body.stock?.ticker === "string" ? body.stock.ticker : "";
    if (!name) return NextResponse.json({ error: "종목명이 필요합니다." }, { status: 400 });

    const metrics: MetricsInput = {
      per: num(body.metrics?.per),
      pbr: num(body.metrics?.pbr),
      dividend: num(body.metrics?.dividend),
      marketCap: num(body.metrics?.marketCap),
    };
    const close = num(body.currentPrice?.close);
    const changeRate = num(body.currentPrice?.changeRate);

    // 숫자가 하나도 없으면 모델 호출할 이유가 없다.
    if (metrics.per === null && metrics.pbr === null && metrics.dividend === null && metrics.marketCap === null) {
      return NextResponse.json({
        interpretation: { per: EMPTY, pbr: EMPTY, dividend: EMPTY, marketCap: EMPTY } satisfies ValuationInterpretation,
      });
    }

    const key = cacheKey(ticker || name, name, metrics, close, changeRate);
    const hit = cache.get(key);
    let promise: Promise<ValuationInterpretation>;
    let isNew = false;
    if (hit && Date.now() < hit.expiresAt) {
      promise = hit.promise;
    } else {
      isNew = true;
      promise = generate(name, ticker, metrics, close, changeRate);
      cache.set(key, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
      // 호출이 실패하면 다음 요청이 다시 시도할 수 있게 캐시에서 뺀다.
      promise.catch(() => cache.delete(key));
    }

    const interpretation = await promise;

    // 새로 생성된 해설만 히스토리로 남긴다(캐시 히트는 이미 저장된 것).
    if (isNew) {
      await saveInterpretationForUser(ticker, name, metrics, interpretation, close, changeRate).catch((error) => {
        console.warn("[valuation/interpret] 히스토리 저장 실패:", error);
      });
    }

    return NextResponse.json({ interpretation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "지표 해석을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
