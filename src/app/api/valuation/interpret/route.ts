import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { MetricNote, ValuationInterpretation } from "@/lib/types";

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

function cacheKey(ticker: string, m: MetricsInput) {
  return [ticker, m.per, m.pbr, m.dividend, m.marketCap].join("|");
}

async function generate(
  name: string,
  ticker: string,
  metrics: MetricsInput,
  close: number | null,
  changeRate: number | null,
): Promise<ValuationInterpretation> {
  const apiKey = serverEnv("XAI_API_KEY");
  if (!apiKey) throw new Error("XAI_API_KEY를 .env에 설정하세요.");
  const model = serverEnv("XAI_MODEL") || "grok-4-1-fast-non-reasoning";

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(name, ticker, metrics, close, changeRate) },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`xAI API 오류 (${response.status}): ${await response.text()}`);
  const content = (await response.json()).choices?.[0]?.message?.content as string;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`xAI 응답이 JSON이 아닙니다: ${(content ?? "").slice(0, 300)}`);
  }
  return coerce(parsed);
}

export async function POST(request: Request) {
  try {
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

    const key = cacheKey(ticker || name, metrics);
    const hit = cache.get(key);
    let promise: Promise<ValuationInterpretation>;
    if (hit && Date.now() < hit.expiresAt) {
      promise = hit.promise;
    } else {
      promise = generate(name, ticker, metrics, close, changeRate);
      cache.set(key, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
      // 호출이 실패하면 다음 요청이 다시 시도할 수 있게 캐시에서 뺀다.
      promise.catch(() => cache.delete(key));
    }

    return NextResponse.json({ interpretation: await promise });
  } catch (error) {
    const message = error instanceof Error ? error.message : "지표 해석을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
