import { describe, it, expect } from "vitest";
import { computeGoalIntelligence } from "../lib/goal-intelligence";

describe("Goal Intelligence (computeGoalIntelligence)", () => {
  it("G-06: velocity calculation with allocations", () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "20000", targetAmount: "100000", targetDate: "2027-12-31" },
      [
        { amount: "10000", allocatedAt: twoMonthsAgo },
        { amount: "10000", allocatedAt: oneMonthAgo },
      ]
    );

    expect(result.velocity).toBeGreaterThan(0);
  });

  it("G-07: projected finish date is set when velocity > 0", () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "50000", targetAmount: "100000", targetDate: "2028-12-31" },
      [{ amount: "50000", allocatedAt: twoMonthsAgo }]
    );

    expect(result.projectedFinishDate).not.toBeNull();
    expect(result.projectedFinishDate).toMatch(/^\d{4}-\d{2}$/);
  });

  it("G-08: On Track status when projected before target date", () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 10);
    const targetDate = farFuture.toISOString().split("T")[0];

    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "90000", targetAmount: "100000", targetDate },
      [{ amount: "90000", allocatedAt: twoMonthsAgo }]
    );

    expect(result.statusIndicator).toBe("On Track");
  });

  it("G-09: Behind status when projected far past target date", () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    const targetDate = pastDate.toISOString().split("T")[0];

    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "10000", targetAmount: "1000000", targetDate },
      [{ amount: "10000", allocatedAt: sixMonthsAgo }]
    );

    expect(result.statusIndicator).toBe("Behind");
  });

  it("G-10: Not Started status when no allocations and no target date", () => {
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "0", targetAmount: "100000", targetDate: null },
      []
    );

    expect(result.statusIndicator).toBe("Not Started");
    expect(result.velocity).toBe(0);
  });

  it("G-11: zero velocity when no allocations", () => {
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "5000", targetAmount: "100000", targetDate: "2027-12-31" },
      []
    );

    expect(result.velocity).toBe(0);
    expect(result.projectedFinishDate).toBeNull();
  });

  it("Achieved status when current >= target", () => {
    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "100000", targetAmount: "100000", targetDate: null },
      []
    );

    expect(result.statusIndicator).toBe("Achieved");
  });

  it("At Risk status when zero velocity but future target date", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const targetDate = futureDate.toISOString().split("T")[0];

    const result = computeGoalIntelligence(
      { id: 1, currentAmount: "0", targetAmount: "100000", targetDate },
      []
    );

    expect(result.statusIndicator).toBe("At Risk");
  });
});
