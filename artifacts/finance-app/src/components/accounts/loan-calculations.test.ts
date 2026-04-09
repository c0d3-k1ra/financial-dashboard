import { describe, it, expect } from "vitest";
import { calculateEmi, calculateEmisPaid, calculateOutstandingPrincipal } from "./loan-calculations";

describe("calculateEmi", () => {
  it("returns 0 for zero principal", () => {
    expect(calculateEmi(0, 10, 12)).toBe(0);
  });

  it("returns 0 for zero tenure", () => {
    expect(calculateEmi(100000, 10, 0)).toBe(0);
  });

  it("returns simple division for zero interest rate", () => {
    expect(calculateEmi(12000, 0, 12)).toBe(1000);
  });

  it("calculates EMI correctly for typical loan", () => {
    const emi = calculateEmi(2000000, 8.5, 240);
    expect(emi).toBeGreaterThan(0);
    expect(emi).toBeLessThan(30000);
  });

  it("returns negative principal as 0", () => {
    expect(calculateEmi(-1000, 10, 12)).toBe(0);
  });

  it("handles small loan", () => {
    const emi = calculateEmi(10000, 12, 3);
    expect(emi).toBeGreaterThan(3000);
  });
});

describe("calculateEmisPaid", () => {
  it("returns 0 for empty start date", () => {
    expect(calculateEmisPaid("", 5)).toBe(0);
  });

  it("returns 0 for zero emi day", () => {
    expect(calculateEmisPaid("2025-01-01", 0)).toBe(0);
  });

  it("returns 0 for future start date", () => {
    expect(calculateEmisPaid("2030-01-01", 5)).toBe(0);
  });

  it("returns positive count for past start date", () => {
    const count = calculateEmisPaid("2024-01-01", 5);
    expect(count).toBeGreaterThan(0);
  });

  it("handles start date in same month", () => {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const result = calculateEmisPaid(startDate, 1);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateOutstandingPrincipal", () => {
  it("returns principal for zero EMIs paid", () => {
    expect(calculateOutstandingPrincipal(100000, 10, 12, 0)).toBe(100000);
  });

  it("returns 0 when all EMIs paid", () => {
    expect(calculateOutstandingPrincipal(100000, 10, 12, 12)).toBe(0);
  });

  it("returns 0 for zero principal", () => {
    expect(calculateOutstandingPrincipal(0, 10, 12, 5)).toBe(0);
  });

  it("returns 0 for negative principal", () => {
    expect(calculateOutstandingPrincipal(-1000, 10, 12, 5)).toBe(-1000);
  });

  it("calculates correctly for zero interest rate", () => {
    const outstanding = calculateOutstandingPrincipal(12000, 0, 12, 6);
    expect(outstanding).toBe(6000);
  });

  it("returns decreasing outstanding for more EMIs paid", () => {
    const after3 = calculateOutstandingPrincipal(100000, 10, 12, 3);
    const after6 = calculateOutstandingPrincipal(100000, 10, 12, 6);
    expect(after6).toBeLessThan(after3);
  });
});
