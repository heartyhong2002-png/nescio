import test from "node:test";
import assert from "node:assert/strict";
import { formatReturnRate, getFirstDayBadge } from "../src/lib/ipo-grading.ts";

test("first-day grade uses closing return and exact +100%/+300% boundaries", () => {
  assert.equal(getFirstDayBadge(10_000, 39_999), "DOUBLE");
  assert.equal(getFirstDayBadge(10_000, 40_000), "TRIPLE");
  assert.equal(getFirstDayBadge(10_000, 19_999), "PROFIT");
  assert.equal(getFirstDayBadge(10_000, 20_000), "DOUBLE");
  assert.equal(getFirstDayBadge(10_000, 9_999), "LOSS");
});

test("displayed return is calculated from first-day close against offer price", () => {
  assert.equal(formatReturnRate(10_000, 39_999), "+300.0%");
  assert.equal(formatReturnRate(10_000, 20_000), "+100.0%");
});
