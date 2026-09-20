import yahooFinance from "yahoo-finance2";

export interface MacroIndicator {
  ticker: string;
  name: string;
  category: "energy" | "metal" | "agriculture" | "financial" | "crypto" | "index";
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
}

const TARGETS = [
  { ticker: "CL=F", name: "WTI 원유", category: "energy" as const },
  { ticker: "GC=F", name: "금", category: "metal" as const },
  { ticker: "HG=F", name: "구리", category: "metal" as const },
  { ticker: "ZC=F", name: "옥수수", category: "agriculture" as const },
  { ticker: "KE=F", name: "밀", category: "agriculture" as const },
  { ticker: "^TNX", name: "미 국채 10년물 금리", category: "financial" as const },
  { ticker: "DX-Y.NYB", name: "달러 인덱스", category: "financial" as const },
  { ticker: "^SOX", name: "필라델피아 반도체 지수", category: "index" as const },
  { ticker: "^VIX", name: "VIX 공포 지수", category: "financial" as const },
  { ticker: "BTC-USD", name: "비트코인", category: "crypto" as const },
  { ticker: "^NDX", name: "나스닥 100", category: "index" as const },
];

export async function fetchMacroIndicators(): Promise<MacroIndicator[]> {
  const results = await Promise.all(
    TARGETS.map(async (target) => {
      try {
        const data = (await yahooFinance.quote(target.ticker)) as any;
        return {
          ticker: target.ticker,
          name: target.name,
          category: target.category,
          price: data?.regularMarketPrice ?? null,
          change: data?.regularMarketChange ?? null,
          changePercent: data?.regularMarketChangePercent ?? null,
          currency: data?.currency ?? "USD",
        };
      } catch (error) {
        console.warn(`[macro-data] Failed to fetch ${target.ticker}:`, error);
        return {
          ...target,
          price: null,
          change: null,
          changePercent: null,
          currency: "USD",
        };
      }
    }),
  );
  return results;
}
