import { describe, expect, it } from "vitest";
import { calculateEquity } from "../src/jobs/equity-snapshot.js";

describe("calculateEquity", () => {
  it("combines cash and marked-to-market open positions", () => {
    expect(calculateEquity(7_500, [
      { quantity: 0.5, currentPrice: 4_000 },
      { quantity: 2, currentPrice: 250 },
    ])).toBe(10_000);
  });

  it("does not invent position value when there are no open positions", () => {
    expect(calculateEquity(1_234.567, [])).toBe(1_234.57);
  });

  it("preserves a negative marked value for invalid upstream data for observability", () => {
    expect(calculateEquity(100, [{ quantity: -1, currentPrice: 20 }])).toBe(80);
  });
});
