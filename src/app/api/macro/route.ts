import { NextResponse } from "next/server";
import { fetchLatestExchangeRates } from "@/lib/exim";
import { fetchMacroIndicators } from "@/lib/macro-data";
import { getMacroBriefing } from "@/lib/macro-analyzer";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Note: In-memory caching and rate limiting doesn't share across serverless instances.
const cache = new Map<string, { data: Record<string, unknown>; expiry: number }>();
const inFlightPromises = new Map<string, Promise<Record<string, unknown>>>();

export async function GET(request: Request) {
  try {
    const ip = clientIp(request);
    const { ok, retryAfterMs } = rateLimit(`macro:${ip}`, 10, 60_000);
    if (!ok) {
      return NextResponse.json(
        { error: "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    const cacheKey = "macro_data";
    const now = Date.now();
    const cached = cache.get(cacheKey);

    if (cached && cached.expiry > now) {
      return NextResponse.json(cached.data);
    }

    if (inFlightPromises.has(cacheKey)) {
      try {
        const data = await inFlightPromises.get(cacheKey);
        return NextResponse.json(data);
      } catch {
        // Fallthrough on error to retry
      }
    }

    const fetchPromise = (async () => {
      try {
        const [eximData, macroIndicators] = await Promise.all([
          fetchLatestExchangeRates().catch((e) => {
            console.error("Failed to fetch exchange rates", e);
            return { date: "", rates: [] };
          }),
          fetchMacroIndicators().catch((e) => {
            console.error("Failed to fetch macro indicators", e);
            return [];
          }),
        ]);

        const sortedRates = [...eximData.rates].sort((a, b) => a.name.localeCompare(b.name, "ko"));
        const briefing = await getMacroBriefing(macroIndicators, sortedRates);

        const data = {
          date: eximData.date,
          rates: sortedRates,
          indicators: macroIndicators,
          briefing,
        };

        cache.set(cacheKey, { data, expiry: Date.now() + 5 * 60 * 1000 }); // 5 min TTL
        return data;
      } finally {
        inFlightPromises.delete(cacheKey);
      }
    })();

    inFlightPromises.set(cacheKey, fetchPromise);
    const data = await fetchPromise;

    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/macro]", error);
    return NextResponse.json({ error: "매크로 정보를 불러오지 못했습니다." }, { status: 502 });
  }
}
