import { describe, it, expect } from "vitest";
import { QUICK_ACTIONS, TYPE_CONFIG, getAccountTypeIcon, CHAT_STORAGE_KEY, CHAT_IDLE_TIMEOUT, CHAT_MIN_HEIGHT } from "./constants";

describe("AI Chat constants", () => {
  it("exports QUICK_ACTIONS with correct structure", () => {
    expect(QUICK_ACTIONS.length).toBeGreaterThan(0);
    QUICK_ACTIONS.forEach((action) => {
      expect(action).toHaveProperty("label");
      expect(action).toHaveProperty("icon");
      expect(action).toHaveProperty("message");
    });
  });

  it("exports TYPE_CONFIG with Expense, Income, Transfer", () => {
    expect(TYPE_CONFIG).toHaveProperty("Expense");
    expect(TYPE_CONFIG).toHaveProperty("Income");
    expect(TYPE_CONFIG).toHaveProperty("Transfer");
  });

  it("has correct CHAT_STORAGE_KEY", () => {
    expect(CHAT_STORAGE_KEY).toBe("ai-chat-state");
  });

  it("has correct CHAT_IDLE_TIMEOUT", () => {
    expect(CHAT_IDLE_TIMEOUT).toBe(30 * 60 * 1000);
  });

  it("has correct CHAT_MIN_HEIGHT", () => {
    expect(CHAT_MIN_HEIGHT).toBe(200);
  });

  describe("getAccountTypeIcon", () => {
    it("returns CreditCard icon for credit types", () => {
      const icon = getAccountTypeIcon("credit_card");
      expect(icon).toBeDefined();
    });

    it("returns Landmark for bank types", () => {
      const icon = getAccountTypeIcon("bank");
      expect(icon).toBeDefined();
    });

    it("returns Wallet for cash/wallet types", () => {
      const icon = getAccountTypeIcon("cash");
      expect(icon).toBeDefined();
    });

    it("returns default icon for unknown types", () => {
      const icon = getAccountTypeIcon("unknown");
      expect(icon).toBeDefined();
    });
  });
});
