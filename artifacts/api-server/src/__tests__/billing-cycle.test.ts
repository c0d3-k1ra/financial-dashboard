import { describe, it, expect } from "vitest";
import { getCycleDates, generateCycleOptions } from "../lib/billing-cycle";

describe("Billing Cycle Logic", () => {
  it("BC-01: standard month boundaries (25th to 24th)", () => {
    const result = getCycleDates("2025-03");
    expect(result.startDate).toBe("2025-02-25");
    expect(result.endDate).toBe("2025-03-24");
  });

  it("BC-02: January cycle crosses year boundary", () => {
    const result = getCycleDates("2025-01");
    expect(result.startDate).toBe("2024-12-25");
    expect(result.endDate).toBe("2025-01-24");
  });

  it("BC-03: December cycle", () => {
    const result = getCycleDates("2025-12");
    expect(result.startDate).toBe("2025-11-25");
    expect(result.endDate).toBe("2025-12-24");
  });

  it("BC-04: February cycle", () => {
    const result = getCycleDates("2025-02");
    expect(result.startDate).toBe("2025-01-25");
    expect(result.endDate).toBe("2025-02-24");
  });

  it("BC-05: generateCycleOptions returns correct number of options", () => {
    const options = generateCycleOptions(6);
    expect(options).toHaveLength(6);
  });

  it("BC-06: generateCycleOptions returns proper structure", () => {
    const options = generateCycleOptions(3);
    for (const opt of options) {
      expect(opt).toHaveProperty("label");
      expect(opt).toHaveProperty("startDate");
      expect(opt).toHaveProperty("endDate");
      expect(opt).toHaveProperty("month");
      expect(opt.startDate).toMatch(/^\d{4}-\d{2}-25$/);
      expect(opt.endDate).toMatch(/^\d{4}-\d{2}-24$/);
    }
  });
});
