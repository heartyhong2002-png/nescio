import { SectorId, Stock } from "./types";

export const SECTORS: { id: SectorId; label: string; description: string }[] = [
  { id: "semiconductor", label: "반도체", description: "메모리 · 파운드리 · 장비" },
  { id: "battery", label: "2차전지", description: "배터리 셀 · 소재" },
  { id: "bio", label: "바이오", description: "제약 · 헬스케어" },
  { id: "finance", label: "금융", description: "은행 · 보험 · 증권" },
  { id: "auto", label: "자동차", description: "완성차 · 부품" },
  { id: "internet-ai", label: "인터넷 · AI", description: "플랫폼 · 소프트웨어" },
  { id: "entertainment", label: "엔터 · 미디어", description: "콘텐츠 · 엔터테인먼트" },
];

// KRX doesn't expose sector classification through the public daily-trade
// endpoint, so this is a curated demo mapping of well-known large caps per
// sector, used to power the recommendation/sector tabs in watchlist add.
export const SECTOR_STOCKS: Record<SectorId, Stock[]> = {
  semiconductor: [
    { name: "삼성전자", ticker: "005930", market: "KOSPI" },
    { name: "SK하이닉스", ticker: "000660", market: "KOSPI" },
    { name: "DB하이텍", ticker: "000990", market: "KOSPI" },
    { name: "리노공업", ticker: "058470", market: "KOSDAQ" },
    { name: "한미반도체", ticker: "042700", market: "KOSDAQ" },
  ],
  battery: [
    { name: "LG에너지솔루션", ticker: "373220", market: "KOSPI" },
    { name: "삼성SDI", ticker: "006400", market: "KOSPI" },
    { name: "LG화학", ticker: "051910", market: "KOSPI" },
    { name: "에코프로비엠", ticker: "247540", market: "KOSDAQ" },
    { name: "포스코퓨처엠", ticker: "003670", market: "KOSPI" },
  ],
  bio: [
    { name: "삼성바이오로직스", ticker: "207940", market: "KOSPI" },
    { name: "셀트리온", ticker: "068270", market: "KOSPI" },
    { name: "유한양행", ticker: "000100", market: "KOSPI" },
    { name: "알테오젠", ticker: "196170", market: "KOSDAQ" },
    { name: "SK바이오사이언스", ticker: "302440", market: "KOSPI" },
  ],
  finance: [
    { name: "KB금융", ticker: "105560", market: "KOSPI" },
    { name: "신한지주", ticker: "055550", market: "KOSPI" },
    { name: "하나금융지주", ticker: "086790", market: "KOSPI" },
    { name: "삼성화재", ticker: "000810", market: "KOSPI" },
    { name: "미래에셋증권", ticker: "006800", market: "KOSPI" },
  ],
  auto: [
    { name: "현대차", ticker: "005380", market: "KOSPI" },
    { name: "기아", ticker: "000270", market: "KOSPI" },
    { name: "현대모비스", ticker: "012330", market: "KOSPI" },
    { name: "한온시스템", ticker: "018880", market: "KOSPI" },
  ],
  "internet-ai": [
    { name: "NAVER", ticker: "035420", market: "KOSPI" },
    { name: "카카오", ticker: "035720", market: "KOSPI" },
    { name: "더존비즈온", ticker: "012510", market: "KOSDAQ" },
    { name: "크래프톤", ticker: "259960", market: "KOSPI" },
  ],
  entertainment: [
    { name: "하이브", ticker: "352820", market: "KOSPI" },
    { name: "JYP Ent.", ticker: "035900", market: "KOSDAQ" },
    { name: "CJ ENM", ticker: "035760", market: "KOSDAQ" },
    { name: "스튜디오드래곤", ticker: "253450", market: "KOSDAQ" },
  ],
};

export function recommendStocksForSectors(sectorIds: SectorId[]): Stock[] {
  const ids = sectorIds.length > 0 ? sectorIds : (Object.keys(SECTOR_STOCKS) as SectorId[]);
  const seen = new Set<string>();
  const result: Stock[] = [];
  for (const id of ids) {
    for (const stock of SECTOR_STOCKS[id] ?? []) {
      if (seen.has(stock.ticker)) continue;
      seen.add(stock.ticker);
      result.push(stock);
    }
  }
  return result;
}
