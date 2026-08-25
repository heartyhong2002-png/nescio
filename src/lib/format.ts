export function formatPrice(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("ko-KR");
}

export function changeDirection(rate: number | null): "up" | "down" | "flat" {
  if (rate === null || Number.isNaN(rate) || rate === 0) return "flat";
  return rate > 0 ? "up" : "down";
}

export function changeArrow(rate: number | null) {
  const direction = changeDirection(rate);
  return direction === "up" ? "▲" : direction === "down" ? "▼" : "—";
}

export function changeEmoji(rate: number | null) {
  if (rate === null) return "";
  if (rate >= 3) return " 🚀";
  if (rate <= -3) return " 😱";
  return "";
}

export function formatChangeRate(rate: number | null) {
  if (rate === null || Number.isNaN(rate)) return "데이터 없음";
  return `${changeArrow(rate)} ${Math.abs(rate).toFixed(2)}%${changeEmoji(rate)}`;
}

export function formatMarketCap(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  const jo = Math.floor(value / 1e12);
  const eok = Math.round((value % 1e12) / 1e8);
  if (jo > 0) return eok > 0 ? `${jo}조 ${eok}억` : `${jo}조`;
  if (eok > 0) return `${eok}억`;
  return `${value.toLocaleString("ko-KR")}원`;
}
