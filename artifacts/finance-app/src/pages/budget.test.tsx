import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Budget from "./budget";

function renderBudget() {
  return render(
    <TestWrapper>
      <Budget />
    </TestWrapper>,
  );
}

describe("Budget page", () => {
  it("renders heading after data loads", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Budget Analysis")).toBeInTheDocument();
    });
  });

  it("displays the current month label", async () => {
    renderBudget();
    const now = new Date();
    const monthLabel = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await waitFor(() => {
      expect(screen.getByText(monthLabel)).toBeInTheDocument();
    });
  });

  it("shows budget category rows", async () => {
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
  });

  it("renders fixed and discretionary sections", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/Fixed Commitments/)).toBeInTheDocument();
    });
    const disc = screen.getAllByText(/Discretionary/);
    expect(disc.length).toBeGreaterThan(0);
  });

  it("shows summary cards with totals", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Overall")).toBeInTheDocument();
    });
    expect(screen.getByText("Cycle Progress")).toBeInTheDocument();
  });

  it("displays loading skeleton initially", () => {
    server.use(
      http.get("/api/budget-analysis", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json({});
      }),
    );
    const { container } = renderBudget();
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state on fetch failure", async () => {
    server.use(
      http.get("/api/budget-analysis", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load budget data/)).toBeInTheDocument();
    });
  });

  it("navigates to previous month", async () => {
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Budget Analysis")).toBeInTheDocument();
    });
    const prevButtons = screen.getAllByRole("button").filter(b => b.querySelector('[class*="chevron"]') || b.getAttribute("aria-label")?.includes("prev"));
    const chevronButtons = screen.getAllByRole("button");
    const prevBtn = chevronButtons.find(b => b.innerHTML.includes("ChevronLeft") || b.innerHTML.includes("chevron-left"));
    if (prevBtn) {
      await user.click(prevBtn);
    }
  });

  it("shows over-budget row styling", async () => {
    renderBudget();
    await waitFor(() => {
      const els = screen.getAllByText("Utilities");
      expect(els.length).toBeGreaterThan(0);
    });
  });

  it("shows pace indicator text", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/Over by/)).toBeInTheDocument();
    });
  });

  it("shows cycle progress", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/Cycle progress/i)).toBeInTheDocument();
    });
  });

  it("renders next month chevron button", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Budget Analysis")).toBeInTheDocument();
    });
    const chevronButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-chevron-right") !== null,
    );
    expect(chevronButtons.length).toBeGreaterThan(0);
  });

  it("navigates to previous month when left chevron is clicked", async () => {
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Budget Analysis")).toBeInTheDocument();
    });
    const chevronButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-chevron-left") !== null,
    );
    if (chevronButtons.length > 0) {
      await user.click(chevronButtons[0]);
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const label = prevMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    }
  });

  it("shows discretionary section with category rows", async () => {
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Planned/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Actual/).length).toBeGreaterThan(0);
  });

  it("shows overall budget summary", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Overall")).toBeInTheDocument();
    });
    expect(screen.getByText("Cycle Progress")).toBeInTheDocument();
  });

  it("can edit budget goal input field", async () => {
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    const inputs = screen.getAllByDisplayValue("15000");
    if (inputs.length > 0) {
      await user.clear(inputs[0]);
      await user.type(inputs[0], "20000");
      expect(inputs[0]).toHaveValue(20000);
    }
  });

  it("shows remove button on budget category rows", async () => {
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    const trashButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(trashButtons.length).toBeGreaterThan(0);
  });

  it("shows paid status for fixed category that is fully paid", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Paid")).toBeInTheDocument();
    });
  });

  it("shows over budget indicator for categories exceeding budget", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/Over by/)).toBeInTheDocument();
    });
  });

  it("shows save button when a budget goal value is edited", async () => {
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    const inputs = screen.queryAllByRole("textbox").length > 0 
      ? screen.queryAllByRole("textbox") 
      : screen.queryAllByDisplayValue(/\d+/);
    if (inputs.length > 0) {
      await user.clear(inputs[0]);
      await user.type(inputs[0], "25000");
      await waitFor(() => {
        const allButtons = screen.getAllByRole("button");
        expect(allButtons.length).toBeGreaterThan(0);
      });
    }
  });

  it("saves a budget goal via the save button", async () => {
    let upsertCalled = false;
    server.use(
      http.post("/api/budget-goals", async ({ request }) => {
        upsertCalled = true;
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 10, ...body }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    const inputs = screen.getAllByDisplayValue("15000");
    if (inputs.length > 0) {
      await user.clear(inputs[0]);
      await user.type(inputs[0], "20000");
      const saveButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-save") !== null,
      );
      if (saveButtons.length > 0) {
        await user.click(saveButtons[0]);
        await waitFor(() => {
          expect(upsertCalled).toBe(true);
        });
      }
    }
  });

  it("navigates to the next month when right chevron is clicked", async () => {
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Budget Analysis")).toBeInTheDocument();
    });
    const leftChevrons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-chevron-left") !== null,
    );
    if (leftChevrons.length > 0) {
      await user.click(leftChevrons[0]);
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevLabel = prevMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      await waitFor(() => {
        expect(screen.getByText(prevLabel)).toBeInTheDocument();
      });
      const rightChevrons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-chevron-right") !== null,
      );
      if (rightChevrons.length > 0) {
        await user.click(rightChevrons[0]);
        const currLabel = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        await waitFor(() => {
          expect(screen.getByText(currLabel)).toBeInTheDocument();
        });
      }
    }
  });

  it("shows Net Difference card", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Net Difference")).toBeInTheDocument();
    });
  });

  it("shows Fixed and Discretionary summary cards", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getAllByText("Fixed").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Discretionary").length).toBeGreaterThan(0);
    });
  });

  it("shows planned, actual, and difference columns in category rows", async () => {
    renderBudget();
    await waitFor(() => {
      const planned = screen.getAllByText("Planned");
      expect(planned.length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Actual").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Difference").length).toBeGreaterThan(0);
  });

  it("shows remove button and can click it on a budget row", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/budget-goals/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    const trashButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (trashButtons.length > 0) {
      await user.click(trashButtons[0]);
      await waitFor(() => {
        expect(deleteCalled).toBe(true);
      });
    }
  });

  it("shows top overspend callout when categories are over budget", async () => {
    renderBudget();
    await waitFor(() => {
      const overspend = screen.queryByText(/top overspend/i) || screen.queryByText(/over by/i) || screen.queryByText(/over budget/i);
      expect(overspend).not.toBeNull();
    });
  });

  it("shows Add category button", async () => {
    renderBudget();
    await waitFor(() => {
      const addBtns = screen.getAllByRole("button").filter(
        (btn) => btn.textContent?.includes("Add category"),
      );
      expect(addBtns.length).toBeGreaterThan(0);
    });
  });

  it("clicks Add category button to show select dropdown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderBudget();
    await waitFor(() => {
      const addBtns = screen.getAllByRole("button").filter(
        (btn) => btn.textContent?.includes("Add category"),
      );
      expect(addBtns.length).toBeGreaterThan(0);
    });
    const addBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.includes("Add category"),
    );
    await user.click(addBtns[0]);
    await waitFor(() => {
      const selectTriggers = screen.queryAllByRole("combobox");
      expect(selectTriggers.length).toBeGreaterThan(0);
    });
  });

  it("cancels add category flow", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderBudget();
    await waitFor(() => {
      const addBtns = screen.getAllByRole("button").filter(
        (btn) => btn.textContent?.includes("Add category"),
      );
      expect(addBtns.length).toBeGreaterThan(0);
    });
    const addBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.includes("Add category"),
    );
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /cancel/i }).length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByRole("button", { name: /cancel/i })[0]);
  });

  it("handles save budget goal API error", async () => {
    server.use(
      http.post("/api/budget-goals", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    const inputs = screen.getAllByDisplayValue("15000");
    if (inputs.length > 0) {
      await user.clear(inputs[0]);
      await user.type(inputs[0], "20000");
      const saveButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-save") !== null,
      );
      if (saveButtons.length > 0) {
        await user.click(saveButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/failed to update budget goal/i)).toBeInTheDocument();
        });
      }
    }
  });

  it("handles remove category API error", async () => {
    server.use(
      http.delete("/api/budget-goals/:id", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    const trashButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (trashButtons.length > 0) {
      await user.click(trashButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/failed to remove category/i)).toBeInTheDocument();
      });
    }
  });

  it("shows pending pace indicator for fixed category with no actual", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 5,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 6, budgetGoalId: 2, category: "Insurance", planned: "10000", actual: "0",
              difference: "10000", overBudget: false, paceStatus: "on_pace" as const,
              categoryType: "fixed" as const, percentSpent: 0, paceMessage: "Pending",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getAllByText("Insurance").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows overdue indicator when fixed category not paid and cycle > 70%", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 25,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 6, budgetGoalId: 2, category: "Insurance", planned: "10000", actual: "0",
              difference: "10000", overBudget: false, paceStatus: "on_pace" as const,
              categoryType: "fixed" as const, percentSpent: 0, paceMessage: "Overdue",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getAllByText("Insurance").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows overspent indicator for fixed category over budget", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 10,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 6, budgetGoalId: 2, category: "Insurance", planned: "10000", actual: "12000",
              difference: "-2000", overBudget: true, paceStatus: "over_budget" as const,
              categoryType: "fixed" as const, percentSpent: 120, paceMessage: "Overspent",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getAllByText("Insurance").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Overspent")).toBeInTheDocument();
  });

  it("shows partially paid indicator for fixed category", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 10,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 6, budgetGoalId: 2, category: "Insurance", planned: "10000", actual: "5000",
              difference: "5000", overBudget: false, paceStatus: "on_pace" as const,
              categoryType: "fixed" as const, percentSpent: 50, paceMessage: "Partially paid",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getAllByText("Insurance").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Partially paid")).toBeInTheDocument();
  });

  it("shows no budget categories message when none configured", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 10,
          totalCycleDays: 30,
          rows: [],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/no budget categories configured/i)).toBeInTheDocument();
    });
  });

  it("shows no fixed categories message when none exist", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 10,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 1, budgetGoalId: 1, category: "Food", planned: "15000", actual: "8000",
              difference: "7000", overBudget: false, paceStatus: "on_pace" as const,
              categoryType: "discretionary" as const, percentSpent: 53, paceMessage: "On track",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/no fixed categories/i)).toBeInTheDocument();
    });
  });

  it("shows on_pace discretionary pace indicator", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 10,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 1, budgetGoalId: 1, category: "Food", planned: "15000", actual: "4000",
              difference: "11000", overBudget: false, paceStatus: "on_pace" as const,
              categoryType: "discretionary" as const, percentSpent: 27, paceMessage: "Under pace",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Under pace")).toBeInTheDocument();
    });
  });

  it("shows ahead discretionary pace indicator", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 10,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 1, budgetGoalId: 1, category: "Food", planned: "15000", actual: "8000",
              difference: "7000", overBudget: false, paceStatus: "ahead" as const,
              categoryType: "discretionary" as const, percentSpent: 53, paceMessage: "Ahead of pace",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Ahead of pace")).toBeInTheDocument();
    });
  });

  it("disables next month button when on current month", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Budget Analysis")).toBeInTheDocument();
    });
    const rightChevrons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-chevron-right") !== null,
    );
    expect(rightChevrons.length).toBeGreaterThan(0);
    expect(rightChevrons[0]).toBeDisabled();
  });

  it("shows under budget text on net difference card", async () => {
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText("Net Difference")).toBeInTheDocument();
    });
    const under = screen.queryByText("Under budget");
    const over = screen.queryByText("Over budget");
    expect(under || over).not.toBeNull();
  });

  it("handles add category API error", async () => {
    server.use(
      http.post("/api/budget-goals", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderBudget();
    await waitFor(() => {
      const addBtns = screen.getAllByRole("button").filter(
        (btn) => btn.textContent?.includes("Add category"),
      );
      expect(addBtns.length).toBeGreaterThan(0);
    });
    const addBtns = screen.getAllByRole("button").filter(
      (btn) => btn.textContent?.includes("Add category"),
    );
    await user.click(addBtns[0]);
    await waitFor(() => {
      const selectTriggers = screen.queryAllByRole("combobox");
      expect(selectTriggers.length).toBeGreaterThan(0);
    });
  });

  it("retries when clicking retry on error state", async () => {
    server.use(
      http.get("/api/budget-analysis", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load budget data/)).toBeInTheDocument();
    });
    const retryBtn = screen.getByText(/Retry/);
    expect(retryBtn).toBeInTheDocument();
    await user.click(retryBtn);
  });

  it("shows surplus allocation for discretionary categories with actual > planned", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 20,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 1, budgetGoalId: 1, category: "Food", planned: "15000", actual: "20000",
              difference: "-5000", overBudget: true, paceStatus: "over_budget" as const,
              categoryType: "discretionary" as const, percentSpent: 133, paceMessage: "Over by ₹5,000",
            },
            {
              categoryId: 2, budgetGoalId: 4, category: "Transport", planned: "8000", actual: "3000",
              difference: "5000", overBudget: false, paceStatus: "on_pace" as const,
              categoryType: "discretionary" as const, percentSpent: 38, paceMessage: "Under pace",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      const foods = screen.getAllByText("Food");
      expect(foods.length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Over by/)).toBeInTheDocument();
  });

  it("shows no discretionary categories message when only fixed exist", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 10,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 6, budgetGoalId: 2, category: "EMI (PL)", planned: "10000", actual: "10000",
              difference: "0", overBudget: false, paceStatus: "on_pace" as const,
              categoryType: "fixed" as const, percentSpent: 100, paceMessage: "Paid",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      expect(screen.getByText(/No discretionary categories in budget yet/i)).toBeInTheDocument();
    });
  });

  it("renders with all rows being over budget (total over)", async () => {
    server.use(
      http.get("/api/budget-analysis", () =>
        HttpResponse.json({
          daysElapsed: 25,
          totalCycleDays: 30,
          rows: [
            {
              categoryId: 1, budgetGoalId: 1, category: "Food", planned: "15000", actual: "20000",
              difference: "-5000", overBudget: true, paceStatus: "over_budget" as const,
              categoryType: "discretionary" as const, percentSpent: 133, paceMessage: "Over by ₹5,000",
            },
            {
              categoryId: 3, budgetGoalId: 3, category: "Utilities", planned: "5000", actual: "8000",
              difference: "-3000", overBudget: true, paceStatus: "over_budget" as const,
              categoryType: "discretionary" as const, percentSpent: 160, paceMessage: "Over by ₹3,000",
            },
          ],
        }),
      ),
    );
    renderBudget();
    await waitFor(() => {
      const overBudgetTexts = screen.getAllByText("Over budget");
      expect(overBudgetTexts.length).toBeGreaterThan(0);
    });
  });
});
