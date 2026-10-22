import type { IpoListingItem } from "./types";

/** Grades a listing by its first-day closing price relative to the offer price. */
export function getFirstDayBadge(offerPrice: number, firstDayClose: number): IpoListingItem["badge"] {
  const returnRate = ((firstDayClose - offerPrice) / offerPrice) * 100;

  if (returnRate >= 300) return "TRIPLE";
  if (returnRate >= 100) return "DOUBLE";
  if (returnRate >= 0) return "PROFIT";
  return "LOSS";
}

export function formatReturnRate(offerPrice: number, price: number): string {
  const rate = ((price - offerPrice) / offerPrice) * 100;
  return `${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`;
}
