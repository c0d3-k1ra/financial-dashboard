import { describe, it, expect, vi } from "vitest";
import { parseIntParam, isZodError, isParamError, isUniqueViolation } from "../lib/parse-params";
import { validateAccountFields } from "../lib/account-validation";
import { escapeLike, likeContains } from "../lib/escape-like";
import { getCycleDates, buildLast6Cycles, generateCycleOptions } from "../lib/billing-cycle";
import { getCurrencySymbol, formatCurrency, getAppSettings } from "../lib/settings-helper";
import { computeGoalIntelligence } from "../lib/goal-intelligence";
import { BUDGET_DEFAULTS, DEFAULT_PLANNED } from "../lib/budget-defaults";
import { asyncHandler } from "../lib/async-handler";
import { errorHandler } from "../lib/error-middleware";
import { calculateTotalEmiDue } from "../lib/emi-due";
import type { Account } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

describe("parseIntParam", () => {
  it("parses valid int", () => {
    expect(parseIntParam("5")).toBe(5);
  });
  it("throws on non-integer", () => {
    expect(() => parseIntParam("abc")).toThrow("Invalid id parameter");
  });
  it("throws on zero", () => {
    expect(() => parseIntParam("0")).toThrow();
  });
  it("throws on negative", () => {
    expect(() => parseIntParam("-1")).toThrow();
  });
  it("throws on float", () => {
    expect(() => parseIntParam("1.5")).toThrow();
  });
  it("uses custom name", () => {
    expect(() => parseIntParam("abc", "goalId")).toThrow("Invalid goalId parameter");
  });
});

describe("isZodError", () => {
  it("true for ZodError-like", () => {
    expect(isZodError({ name: "ZodError" })).toBe(true);
  });
  it("false for other", () => {
    expect(isZodError(new Error("x"))).toBe(false);
    expect(isZodError(null)).toBe(false);
    expect(isZodError(undefined)).toBe(false);
  });
});

describe("isParamError", () => {
  it("true for ParamError", () => {
    try {
      parseIntParam("bad");
    } catch (e) {
      expect(isParamError(e)).toBe(true);
    }
  });
  it("false for regular error", () => {
    expect(isParamError(new Error("x"))).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("detects code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });
  it("detects cause code 23505", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });
  it("detects unique constraint message", () => {
    expect(isUniqueViolation({ message: "unique constraint violation" })).toBe(true);
  });
  it("false for null", () => {
    expect(isUniqueViolation(null)).toBe(false);
  });
  it("false for regular error", () => {
    expect(isUniqueViolation({ code: "12345" })).toBe(false);
  });
});

describe("validateAccountFields", () => {
  it("valid bank", () => {
    expect(validateAccountFields({ type: "bank" })).toBeNull();
  });
  it("rejects billingDueDay > 31", () => {
    expect(validateAccountFields({ type: "credit_card", billingDueDay: 32 })).toContain("billingDueDay");
  });
  it("rejects billingDueDay < 1", () => {
    expect(validateAccountFields({ type: "credit_card", billingDueDay: 0 })).toContain("billingDueDay");
  });
  it("rejects negative creditLimit", () => {
    expect(validateAccountFields({ type: "credit_card", creditLimit: "-1" })).toContain("non-negative");
  });
  it("rejects emiDay out of range", () => {
    expect(validateAccountFields({ type: "loan", originalLoanAmount: "100000", emiDay: 32 })).toContain("emiDay");
  });
  it("loan requires originalLoanAmount", () => {
    expect(validateAccountFields({ type: "loan" })).toContain("Original loan amount");
  });
  it("loan rejects negative emiAmount", () => {
    expect(validateAccountFields({ type: "loan", originalLoanAmount: "10000", emiAmount: "-1" })).toContain("EMI amount");
  });
  it("loan rejects negative interestRate", () => {
    expect(validateAccountFields({ type: "loan", originalLoanAmount: "10000", interestRate: "-1" })).toContain("Interest rate");
  });
  it("loan rejects loanTenure < 1", () => {
    expect(validateAccountFields({ type: "loan", originalLoanAmount: "10000", loanTenure: 0 })).toContain("Loan tenure");
  });
  it("loan rejects negative emisPaid", () => {
    expect(validateAccountFields({ type: "loan", originalLoanAmount: "10000", emisPaid: -1 })).toContain("EMIs paid");
  });
  it("valid loan", () => {
    expect(validateAccountFields({ type: "loan", originalLoanAmount: "10000", emiAmount: "500", interestRate: "10", loanTenure: 24, emisPaid: 3 })).toBeNull();
  });
});

describe("escapeLike / likeContains", () => {
  it("escapes percent", () => {
    expect(escapeLike("50%")).toBe("50\\%");
  });
  it("escapes underscore", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });
  it("escapes backslash", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });
  it("likeContains wraps", () => {
    expect(likeContains("test")).toBe("%test%");
  });
});

describe("getCycleDates", () => {
  it("default cycle day 25", () => {
    const { startDate, endDate } = getCycleDates("2025-03");
    expect(startDate).toBe("2025-02-25");
    expect(endDate).toBe("2025-03-24");
  });
  it("cycle day 1", () => {
    const { startDate, endDate } = getCycleDates("2025-03", 1);
    expect(startDate).toBe("2025-02-01");
    expect(endDate).toBe("2025-02-28");
  });
  it("january wraps to previous year", () => {
    const { startDate } = getCycleDates("2025-01");
    expect(startDate).toBe("2024-12-25");
  });
});

describe("buildLast6Cycles", () => {
  it("returns 6 cycles", () => {
    const result = buildLast6Cycles("2025-06");
    expect(result).toHaveLength(6);
    expect(result[0]).toHaveProperty("label");
    expect(result[0]).toHaveProperty("startDate");
    expect(result[0]).toHaveProperty("endDate");
  });
});

describe("generateCycleOptions", () => {
  it("returns requested count", () => {
    const result = generateCycleOptions(3);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty("month");
  });
});

describe("getCurrencySymbol", () => {
  it("returns INR symbol", () => {
    expect(getCurrencySymbol("INR")).toBe("₹");
  });
  it("returns USD symbol", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
  });
  it("returns code for unknown", () => {
    expect(getCurrencySymbol("XYZ")).toBe("XYZ");
  });
  it("returns EUR symbol", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });
  it("returns GBP symbol", () => {
    expect(getCurrencySymbol("GBP")).toBe("£");
  });
});

describe("formatCurrency", () => {
  it("formats number", () => {
    const result = formatCurrency(1234.5, "INR");
    expect(result).toContain("₹");
    expect(result).toContain("1,234.50");
  });
  it("formats string amount", () => {
    const result = formatCurrency("500", "USD");
    expect(result).toContain("$");
  });
  it("handles NaN", () => {
    const result = formatCurrency("abc", "USD");
    expect(result).toBe("$0.00");
  });
});

describe("getAppSettings", () => {
  it("returns defaults when no settings", async () => {
    const result = await getAppSettings();
    expect(result.billingCycleDay).toBe(25);
    expect(result.currencyCode).toBe("INR");
  });
});

describe("computeGoalIntelligence", () => {
  it("not started with no allocations", () => {
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "0", targetAmount: "10000", targetDate: null },
      []
    );
    expect(result.statusIndicator).toBe("Not Started");
    expect(result.velocity).toBe(0);
  });

  it("achieved when current >= target", () => {
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "10000", targetAmount: "10000", targetDate: null },
      []
    );
    expect(result.statusIndicator).toBe("Achieved");
  });

  it("on track with velocity and no target date", () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 3);
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "3000", targetAmount: "10000", targetDate: null },
      [
        { amount: "1000", allocatedAt: pastDate },
        { amount: "1000", allocatedAt: new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000) },
        { amount: "1000", allocatedAt: new Date() },
      ]
    );
    expect(result.statusIndicator).toBe("On Track");
    expect(result.velocity).toBeGreaterThan(0);
  });

  it("behind when target date passed with no velocity", () => {
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "1000", targetAmount: "10000", targetDate: "2020-01-01" },
      []
    );
    expect(result.statusIndicator).toBe("Behind");
  });

  it("at risk when target date in future with no velocity", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "1000", targetAmount: "10000", targetDate: futureDate.toISOString().split("T")[0] },
      []
    );
    expect(result.statusIndicator).toBe("At Risk");
  });

  it("on track with velocity and target date far away", () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 2);
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 5);
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "5000", targetAmount: "10000", targetDate: futureDate.toISOString().split("T")[0] },
      [
        { amount: "2500", allocatedAt: pastDate },
        { amount: "2500", allocatedAt: new Date() },
      ]
    );
    expect(result.statusIndicator).toBe("On Track");
    expect(result.projectedFinishDate).toBeTruthy();
  });

  it("behind with velocity but target date passed", () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 2);
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "1000", targetAmount: "1000000", targetDate: "2020-01-01" },
      [
        { amount: "500", allocatedAt: pastDate },
        { amount: "500", allocatedAt: new Date() },
      ]
    );
    expect(result.statusIndicator).toBe("Behind");
  });

  it("at risk with velocity but tight target date", () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    const tightDate = new Date();
    tightDate.setMonth(tightDate.getMonth() + 1);
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "1000", targetAmount: "100000", targetDate: tightDate.toISOString().split("T")[0] },
      [
        { amount: "500", allocatedAt: pastDate },
        { amount: "500", allocatedAt: new Date() },
      ]
    );
    expect(["At Risk", "Behind"]).toContain(result.statusIndicator);
  });
});

describe("validateIdParam", () => {
  it("returns valid id", async () => {
    const { validateIdParam } = await import("../lib/validate-id");
    const req = { params: { id: "5" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    expect(validateIdParam(req, res)).toBe(5);
  });

  it("returns null for non-integer", async () => {
    const { validateIdParam } = await import("../lib/validate-id");
    const req = { params: { id: "abc" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    expect(validateIdParam(req, res)).toBeNull();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns null for zero", async () => {
    const { validateIdParam } = await import("../lib/validate-id");
    const req = { params: { id: "0" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    expect(validateIdParam(req, res)).toBeNull();
  });

  it("returns null for negative", async () => {
    const { validateIdParam } = await import("../lib/validate-id");
    const req = { params: { id: "-1" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    expect(validateIdParam(req, res)).toBeNull();
  });
});

describe("BUDGET_DEFAULTS", () => {
  it("has Food default", () => {
    expect(BUDGET_DEFAULTS["Food"]).toBe(8000);
  });
  it("DEFAULT_PLANNED is 1000", () => {
    expect(DEFAULT_PLANNED).toBe(1000);
  });
});

describe("asyncHandler", () => {
  it("catches async errors and calls next", async () => {
    const err = new Error("test error");
    const handler = asyncHandler(async () => { throw err; });
    const next = vi.fn();
    await handler({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe("errorHandler", () => {
  const mockReq = { log: { error: vi.fn() }, method: "GET", originalUrl: "/test" } as unknown as Request;
  const mockNext = vi.fn() as NextFunction;

  function createMockRes() {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    return res;
  }

  it("handles SyntaxError (invalid JSON)", () => {
    const res = createMockRes();
    const err = Object.assign(new SyntaxError("bad json"), { type: "entity.parse.failed" });
    errorHandler(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles ZodError", () => {
    const res = createMockRes();
    errorHandler({ name: "ZodError" }, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles ParamError", () => {
    const res = createMockRes();
    try { parseIntParam("abc"); } catch (e) {
      errorHandler(e, mockReq, res, mockNext);
    }
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles unique violation", () => {
    const res = createMockRes();
    errorHandler({ code: "23505" }, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles generic error", () => {
    const res = createMockRes();
    errorHandler(new Error("unknown"), mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("calculateTotalEmiDue", () => {
  it("returns 0 for no loan accounts", async () => {
    const result = await calculateTotalEmiDue([], "2025-01-25", "2025-02-24");
    expect(result.totalEmiDue).toBe(0);
    expect(result.activeLoanAccounts).toHaveLength(0);
  });

  it("filters out non-loan and inactive accounts", async () => {
    const accounts: Account[] = [
      { id: 1, name: "Bank", type: "bank", currentBalance: "50000", emiAmount: null, emiDay: null, interestRate: null, loanTenure: null, linkedAccountId: null, emisPaid: null, creditLimit: null, billingDueDay: null, useInSurplus: false, sharedLimitGroup: null, originalLoanAmount: null, loanStartDate: null, createdAt: new Date() },
    ];
    const result = await calculateTotalEmiDue(accounts, "2025-01-25", "2025-02-24");
    expect(result.totalEmiDue).toBe(0);
  });
});

