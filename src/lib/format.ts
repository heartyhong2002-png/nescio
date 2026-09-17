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

export function formatMultiple(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}배`;
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatMarketCap(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  const jo = Math.floor(value / 1e12);
  const eok = Math.round((value % 1e12) / 1e8);
  if (jo > 0) return eok > 0 ? `${jo}조 ${eok}억` : `${jo}조`;
  if (eok > 0) return `${eok}억`;
  return `${value.toLocaleString("ko-KR")}원`;
}

export function formatSharesCompact(shares: number | null) {
  if (shares === null || Number.isNaN(shares)) return "—";
  if (shares >= 100_000_000) return `${(shares / 100_000_000).toFixed(1).replace(/\.0$/, "")}억주`;
  if (shares >= 10_000) return `${(shares / 10_000).toFixed(1).replace(/\.0$/, "")}만주`;
  return `${shares.toLocaleString("ko-KR")}주`;
}

export function formatAmountCompact(amount: number | null) {
  if (amount === null || Number.isNaN(amount)) return "—";
  const jo = Math.floor(amount / 1e12);
  const eok = Math.round((amount % 1e12) / 1e8);
  if (jo > 0) return eok > 0 ? `${jo}조 ${eok}억원` : `${jo}조원`;
  if (eok > 0) return `${eok}억원`;
  return `${amount.toLocaleString("ko-KR")}원`;
}
