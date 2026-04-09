import { describe, it, expect, beforeEach } from "vitest";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  formatCurrency,
  setActiveCurrency,
  getActiveCurrency,
  formatDate,
  getOrdinalSuffix,
  getApiErrorMessage,
} from "./constants";

describe("constants", () => {
  describe("category arrays", () => {
    it("EXPENSE_CATEGORIES has entries", () => {
      expect(EXPENSE_CATEGORIES.length).toBeGreaterThan(0);
      expect(EXPENSE_CATEGORIES).toContain("Food");
    });

    it("INCOME_CATEGORIES has entries", () => {
      expect(INCOME_CATEGORIES.length).toBeGreaterThan(0);
      expect(INCOME_CATEGORIES).toContain("Paycheck (Salary)");
    });
  });

  describe("currency", () => {
    beforeEach(() => {
      setActiveCurrency("INR");
    });

    it("getActiveCurrency returns current currency", () => {
      expect(getActiveCurrency()).toBe("INR");
    });

    it("setActiveCurrency changes the active currency", () => {
      setActiveCurrency("USD");
      expect(getActiveCurrency()).toBe("USD");
    });
  });

  describe("formatCurrency", () => {
    beforeEach(() => {
      setActiveCurrency("INR");
    });

    it("formats a number", () => {
      const result = formatCurrency(1000);
      expect(result).toContain("1,000");
    });

    it("formats a string", () => {
      const result = formatCurrency("2500.50");
      expect(result).toContain("2,500.50");
    });

    it("handles zero", () => {
      const result = formatCurrency(0);
      expect(result).toContain("0.00");
    });

    it("handles empty string as 0", () => {
      const result = formatCurrency("");
      expect(result).toContain("0.00");
    });

    it("respects active currency", () => {
      setActiveCurrency("USD");
      const result = formatCurrency(100);
      expect(result).toContain("$");
    });
  });

  describe("formatDate", () => {
    it("formats a date string", () => {
      const result = formatDate("2026-04-05");
      expect(result).toMatch(/Apr 5, 2026/);
    });
  });

  describe("getOrdinalSuffix", () => {
    it("returns st for 1", () => {
      expect(getOrdinalSuffix(1)).toBe("1st");
    });

    it("returns nd for 2", () => {
      expect(getOrdinalSuffix(2)).toBe("2nd");
    });

    it("returns rd for 3", () => {
      expect(getOrdinalSuffix(3)).toBe("3rd");
    });

    it("returns th for 4", () => {
      expect(getOrdinalSuffix(4)).toBe("4th");
    });

    it("returns th for 11", () => {
      expect(getOrdinalSuffix(11)).toBe("11th");
    });

    it("returns th for 12", () => {
      expect(getOrdinalSuffix(12)).toBe("12th");
    });

    it("returns th for 13", () => {
      expect(getOrdinalSuffix(13)).toBe("13th");
    });

    it("returns st for 21", () => {
      expect(getOrdinalSuffix(21)).toBe("21st");
    });
  });

  describe("getApiErrorMessage", () => {
    it("returns data.error string", () => {
      const err = { data: { error: "Custom error" } };
      expect(getApiErrorMessage(err)).toBe("Custom error");
    });

    it("returns data.message string", () => {
      const err = { data: { message: "Custom message" } };
      expect(getApiErrorMessage(err)).toBe("Custom message");
    });

    it("cleans Error message with HTTP prefix", () => {
      const err = new Error("HTTP 500 Internal Server Error: Something broke");
      expect(getApiErrorMessage(err)).toBe("Something broke");
    });

    it("returns string errors directly", () => {
      expect(getApiErrorMessage("simple error")).toBe("simple error");
    });

    it("returns fallback for unknown errors", () => {
      expect(getApiErrorMessage(null)).toBe("Something went wrong. Please try again.");
    });

    it("returns fallback for empty Error", () => {
      expect(getApiErrorMessage({})).toBe("Something went wrong. Please try again.");
    });

    it("trims whitespace", () => {
      expect(getApiErrorMessage("  spaced  ")).toBe("spaced");
    });
  });
});
