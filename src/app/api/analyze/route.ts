import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { getPriceForTicker } from "@/lib/krx";
import { Briefing, Cause, NewsItem } from "@/lib/types";

const NAVER_URL = "https://openapi.naver.com/v1/search/news.json";

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

const RESPONSE_SCHEMA = `{
  "oneLiner": string,               // 오늘 시세가 왜 그렇게 움직였는지 한 문장 (14세 눈높이, 존댓말)
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
  "aiComment": string                // 전체 흐름 3~4문장 정리, 투자 권유 문구 금지
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

async function askModel(prompt: string): Promise<unknown> {
  const apiKey = serverEnv("XAI_API_KEY");
  const url = "https://api.x.ai/v1/chat/completions";
  const model = serverEnv("XAI_MODEL") || "grok-4-1-fast-non-reasoning";
  if (!apiKey) throw new Error("XAI_API_KEY를 .env에 설정하세요.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "너는 한국 주식 뉴스 분석가다. 제공된 뉴스와 시세 데이터만 근거로 주가 변동의 원인을 분석해 아래 JSON 스키마에 맞춰 한국어로 응답한다. " +
            "사실과 추론을 구분하고 투자 권유는 하지 않는다. 근거가 부족한 값은 빈 문자열이나 빈 배열로 둔다. JSON 외의 텍스트는 출력하지 않는다.\n\n" +
            `스키마:\n${RESPONSE_SCHEMA}`,
        },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`LLM API 오류 (${response.status})`);
  const content = (await response.json()).choices?.[0]?.message?.content as string;
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("LLM 응답을 해석하지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const { name, ticker } = await request.json();
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "종목명이 필요합니다." }, { status: 400 });

    const [news, price] = await Promise.all([getNews(name), getPriceForTicker(typeof ticker === "string" ? ticker : "")]);
    const prompt = `${name}(${ticker || "티커 미등록"}) 분석 요청\n현재 등락률: ${price.changeRate ?? "데이터 없음"}%\n관련 뉴스 (인덱스: 제목 (게재일)):\n${news
      .map((item, index) => `${index}. ${item.title} (${item.pubDate})\n${item.description}`)
      .join("\n")}`;

    const raw = await askModel(prompt);
    const briefing = coerceBriefing(raw, news);

    return NextResponse.json({
      stock: { name, ticker: ticker || "" },
      price,
      news,
      briefing,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
