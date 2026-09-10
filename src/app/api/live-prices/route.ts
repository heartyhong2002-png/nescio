import { NextResponse } from "next/server";
import { fetchCurrentPrices } from "@/lib/kis";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// 홈 대시보드의 LiveSparkline이 몇 초 간격으로 이 엔드포인트를 두드린다. KIS 쪽 초당
// 호출 수는 kis.ts의 전역 스로틀(callQueue)이 이미 눌러주지만, 그것과 별개로 이 라우트
// 자체를 너무 자주 때리는 클라이언트(여러 탭 등)도 IP당 분당 호출 수로 한 번 더 막는다.
// analyze 라우트(분당 5회)보다 훨씬 여유 있게 잡았다 — 이건 폴링용이라 자주 불려야 한다.
const RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const MAX_TICKERS = 20;

export async function POST(request: Request) {
  const { ok, retryAfterMs } = rateLimit(`live-prices:${clientIp(request)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!ok) {
    return NextResponse.json(
      { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const { tickers } = (await request.json()) as { tickers?: string[] };
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ prices: {} });
    }
    const capped = tickers.filter((ticker) => typeof ticker === "string").slice(0, MAX_TICKERS);
    const prices = await fetchCurrentPrices(capped);
    return NextResponse.json({ prices: Object.fromEntries(prices) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "실시간 시세를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
