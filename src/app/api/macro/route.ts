import { NextResponse } from "next/server";
import { fetchLatestExchangeRates } from "@/lib/exim";
import { fetchMacroIndicators } from "@/lib/macro-data";
import { getMacroBriefing } from "@/lib/macro-analyzer";

export async function GET() {
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

    return NextResponse.json({
      date: eximData.date,
      rates: sortedRates,
      indicators: macroIndicators,
      briefing,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "매크로 정보를 불러오지 못했습니다.";
    console.error("[/api/macro]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
