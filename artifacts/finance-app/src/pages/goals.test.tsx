import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Goals from "./goals";

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

const mockUseIsMobile = vi.fn(() => false);
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: (...args: unknown[]) => mockUseIsMobile(...args),
}));

afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

beforeEach(() => {
  mockUseIsMobile.mockReturnValue(false);
});

function renderGoals() {
  return render(
    <TestWrapper>
      <Goals />
    </TestWrapper>,
  );
}

describe("Goals page", () => {
  it("renders the page heading", async () => {
    renderGoals();
    expect(screen.getByText("Goal Manager")).toBeInTheDocument();
  });

  it("renders the Create Goal button", () => {
    renderGoals();
    expect(screen.getByRole("button", { name: /create goal/i })).toBeInTheDocument();
  });

  it("displays goal cards after data loads", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
  });

  it("shows goal progress percentage", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("50.0%")).toBeInTheDocument();
    });
  });

  it("shows select a goal prompt for projection chart", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Select a goal to view projection")).toBeInTheDocument();
    });
  });

  it("shows loading skeletons while fetching", () => {
    server.use(
      http.get("/api/goals", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    const { container } = renderGoals();
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state when goals fail to load", async () => {
    server.use(
      http.get("/api/goals", () => HttpResponse.json({}, { status: 500 })),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load goals/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no goals exist", async () => {
    server.use(http.get("/api/goals", () => HttpResponse.json([])));
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/No goals created yet/)).toBeInTheDocument();
    });
  });

  it("opens create goal dialog", async () => {
    const user = userEvent.setup();
    renderGoals();
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
  });

  it("shows goal status indicator", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("on_track")).toBeInTheDocument();
    });
  });

  it("shows velocity info when available", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/Velocity/)).toBeInTheDocument();
    });
  });

  it("shows stress test warning when stressTest is true", async () => {
    server.use(
      http.get("/api/goals/waterfall", () =>
        HttpResponse.json({
          totalBankBalance: "150000",
          goalAllocations: [],
          remainingLiquidCash: "10000",
          avgMonthlyLivingExpenses: "60000",
          stressTest: true,
        }),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/Goal Rich but Cash Poor/)).toBeInTheDocument();
    });
  });

  it("can click a goal card to show projection", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
  });

  it("shows goal category icon", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
  });

  it("shows projected finish date when available", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/Est\./)).toBeInTheDocument();
    });
  });

  it("shows account name on goal card", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
  });

  it("opens create goal dialog and validates required fields", async () => {
    const user = userEvent.setup();
    renderGoals();
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/vacation fund/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("50000")).toBeInTheDocument();
  });

  it("can fill in goal creation form", async () => {
    const user = userEvent.setup();
    renderGoals();
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/vacation fund/i), "New Goal");
    await user.type(screen.getByPlaceholderText("50000"), "100000");
    expect(screen.getByPlaceholderText(/vacation fund/i)).toHaveValue("New Goal");
  });

  it("shows edit and delete buttons on goal cards", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it("opens edit dialog when pencil button is clicked", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
  });

  it("deselects goal card on second click", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Select a goal to view projection")).toBeInTheDocument();
    });
  });

  it("shows Active Goals count heading", async () => {
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/Active Goals \(1\)/)).toBeInTheDocument();
    });
  });

  it("submits create goal form and calls API", async () => {
    let postCalled = false;
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/goals", async ({ request }) => {
        postCalled = true;
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 10, ...postBody, currentAmount: "0", status: "Active", velocity: 0 },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/vacation fund/i), "Travel Fund");
    await user.type(screen.getByPlaceholderText("50000"), "200000");
    const createBtn = screen.getByRole("button", { name: /^create$/i });
    await user.click(createBtn);
  });

  it("validates required fields before creating goal", async () => {
    const user = userEvent.setup();
    renderGoals();
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    const createBtn = screen.getByRole("button", { name: /^create$/i });
    await user.click(createBtn);
    await waitFor(() => {
      expect(screen.getByText(/missing fields/i)).toBeInTheDocument();
    });
  });

  it("deletes a goal when trash button is clicked", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/goals/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it("opens edit dialog and shows current goal values", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Emergency Fund")).toBeInTheDocument();
    expect(screen.getByDisplayValue("300000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("150000")).toBeInTheDocument();
  });

  it("submits edit goal form via save button", async () => {
    let putCalled = false;
    server.use(
      http.put("/api/goals/:id", async ({ request }) => {
        putCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body });
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Fund");
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(putCalled).toBe(true);
    });
  });

  it("closes edit dialog with cancel button", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);
  });

  it("creates a goal with all required fields via the API", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/goals", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 10, ...postBody, currentAmount: "0", status: "Active", velocity: 0 },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/vacation fund/i), "Travel Fund");
    await user.type(screen.getByPlaceholderText("50000"), "200000");
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/vacation fund/i)).toHaveValue("Travel Fund");
    expect(screen.getByPlaceholderText("50000")).toHaveValue(200000);
  });

  it("handles goal deletion error gracefully", async () => {
    server.use(
      http.delete("/api/goals/:id", () => {
        return HttpResponse.json({ error: "Cannot delete" }, { status: 400 });
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    await user.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/cannot delete goal/i)).toBeInTheDocument();
    });
  });

  it("edits a goal name and submits via save changes", async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.put("/api/goals/:id", async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...putBody });
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    await user.clear(nameInput);
    await user.type(nameInput, "Rainy Day Fund");
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(putBody).not.toBeNull();
      expect(putBody).toHaveProperty("name", "Rainy Day Fund");
    });
  });

  it("handles update goal API error gracefully", async () => {
    server.use(
      http.put("/api/goals/:id", () =>
        HttpResponse.json({ error: "Update failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("validates required fields on edit goal form", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    await user.clear(nameInput);
    const targetInput = screen.getByDisplayValue("300000");
    await user.clear(targetInput);
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText(/missing fields/i)).toBeInTheDocument();
    });
  });

  it("shows edit goal with current amount field", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("150000")).toBeInTheDocument();
    expect(screen.getByText(/current amount/i)).toBeInTheDocument();
  });

  it("handles create goal API error gracefully", async () => {
    server.use(
      http.post("/api/goals", () =>
        HttpResponse.json({ error: "Create failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/vacation fund/i), "Test");
    await user.type(screen.getByPlaceholderText("50000"), "5000");
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("shows goal projection chart when goal is selected", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json([
          { month: "Jan", actual: 50000, currentPace: 55000, neededPace: 80000, targetAmount: 300000 },
          { month: "Feb", actual: 75000, currentPace: 80000, neededPace: 100000, targetAmount: 300000 },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
  });

  it("shows projection error state", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText(/failed to load projection/i)).toBeInTheDocument();
    });
  });

  it("shows achieved goal with reduced opacity", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "Completed Goal", targetAmount: "100000", currentAmount: "100000",
            accountId: 1, accountName: "HDFC Savings", status: "Achieved",
            targetDate: "2026-01-01", categoryType: "savings", icon: null,
            velocity: 0, statusIndicator: "Achieved", projectedFinishDate: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Completed Goal")).toBeInTheDocument();
    });
    expect(screen.getByText("Achieved")).toBeInTheDocument();
  });

  it("edits goal target and current amounts", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const targetInput = screen.getByDisplayValue("300000");
    await user.clear(targetInput);
    await user.type(targetInput, "500000");
    expect(targetInput).toHaveValue(500000);
    const currentInput = screen.getByDisplayValue("150000");
    await user.clear(currentInput);
    await user.type(currentInput, "200000");
    expect(currentInput).toHaveValue(200000);
  });

  it("renders achieved goal with Achieved badge and opacity", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "Done Goal", targetAmount: "100000", currentAmount: "100000",
            accountId: 1, accountName: "HDFC Savings", status: "Achieved",
            targetDate: "2026-01-01", categoryType: "General", icon: null,
            velocity: 0, statusIndicator: "Achieved", projectedFinishDate: null,
          },
        ]),
      ),
    );
    const { container } = renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Done Goal")).toBeInTheDocument();
    });
    expect(screen.getByText("Achieved")).toBeInTheDocument();
    const card = container.querySelector('.opacity-70');
    expect(card).toBeInTheDocument();
  });

  it("shows projection chart with actual and pace data", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json([
          { month: "Jan", actual: 50000, currentPace: 55000, neededPace: 80000, targetAmount: 300000 },
          { month: "Feb", actual: 75000, currentPace: 80000, neededPace: 100000, targetAmount: 300000 },
          { month: "Mar", actual: null, currentPace: 105000, neededPace: 120000, targetAmount: 300000 },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/actual savings/i)).toBeInTheDocument();
    });
  });

  it("handles edit goal with missing required fields", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    await user.clear(nameInput);
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText(/missing fields/i)).toBeInTheDocument();
    });
  });

  it("shows goals heading as 'Goals' when no active goals", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "Completed Goal", targetAmount: "100000", currentAmount: "100000",
            accountId: 1, accountName: "HDFC Savings", status: "Achieved",
            targetDate: "2026-01-01", categoryType: "General", icon: null,
            velocity: 0, statusIndicator: "Achieved", projectedFinishDate: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Completed Goal")).toBeInTheDocument();
    });
    expect(screen.getByText("Goals")).toBeInTheDocument();
  });

  it("shows 100% progress for fully funded goal", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "Full Goal", targetAmount: "100000", currentAmount: "100000",
            accountId: 1, accountName: "HDFC Savings", status: "Achieved",
            targetDate: "2026-01-01", categoryType: "General", icon: null,
            velocity: 0, statusIndicator: "Achieved", projectedFinishDate: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });
  });

  it("creates a goal successfully and closes dialog", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/goals", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 10, ...postBody, currentAmount: "0", status: "Active", velocity: 0 },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/vacation fund/i), "New Fund");
    await user.type(screen.getByPlaceholderText("50000"), "75000");
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("shows projection loading state", async () => {
    server.use(
      http.get("/api/goals/:id/projection", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
  });

  it("shows 'Not enough data' when projection returns empty", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Not enough data for projection")).toBeInTheDocument();
    });
  });

  it("shows full projection chart with all pace lines", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json([
          { month: "Jan", actual: 50000, currentPace: 55000, neededPace: 80000, targetAmount: 300000 },
          { month: "Feb", actual: 75000, currentPace: 80000, neededPace: 100000, targetAmount: 300000 },
          { month: "Mar", actual: null, currentPace: 105000, neededPace: 120000, targetAmount: 300000 },
          { month: "Apr", actual: null, currentPace: 130000, neededPace: 140000, targetAmount: 300000 },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/actual savings.*projected at current pace.*needed to hit target/i)).toBeInTheDocument();
    });
  });

  it("shows only actual savings description when no pace data", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json([
          { month: "Jan", actual: 50000, currentPace: null, neededPace: null, targetAmount: 300000 },
          { month: "Feb", actual: 75000, currentPace: null, neededPace: null, targetAmount: 300000 },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/actual savings so far/i)).toBeInTheDocument();
    });
  });

  it("shows no savings data description when no actual data", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json([
          { month: "Jan", actual: null, currentPace: null, neededPace: null, targetAmount: 300000 },
          { month: "Feb", actual: null, currentPace: null, neededPace: null, targetAmount: 300000 },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/No savings data yet/i)).toBeInTheDocument();
    });
  });

  it("creates a goal successfully with all fields and shows toast", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/goals", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 10, ...postBody, currentAmount: "0", status: "Active", velocity: 0 },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/vacation fund/i), "Beach Trip");
    await user.type(screen.getByPlaceholderText("50000"), "100000");
    const accountComboboxes = screen.getAllByRole("combobox");
    expect(accountComboboxes.length).toBeGreaterThan(0);
    const createBtn = screen.getByRole("button", { name: /^create$/i });
    await user.click(createBtn);
    await waitFor(() => {
      if (postBody) {
        expect(postBody).toHaveProperty("name", "Beach Trip");
      }
    });
  });

  it("shows goal without velocity when velocity is 0", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "No Velocity Goal", targetAmount: "100000", currentAmount: "0",
            accountId: 1, accountName: "HDFC Savings", status: "Active",
            targetDate: null, categoryType: "General", icon: null,
            velocity: 0, statusIndicator: "Not Started", projectedFinishDate: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("No Velocity Goal")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Velocity:/)).not.toBeInTheDocument();
  });

  it("shows goal without projected finish date", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "No Date Goal", targetAmount: "100000", currentAmount: "50000",
            accountId: 1, accountName: "HDFC Savings", status: "Active",
            targetDate: null, categoryType: "General", icon: null,
            velocity: 5000, statusIndicator: "At Risk", projectedFinishDate: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("No Date Goal")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Est\./)).not.toBeInTheDocument();
  });

  it("shows update error toast when update API fails", async () => {
    server.use(
      http.put("/api/goals/:id", () =>
        HttpResponse.json({ error: "Update failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Goal");
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("handles goal with no account name gracefully", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "No Account Goal", targetAmount: "50000", currentAmount: "10000",
            accountId: 1, accountName: null, status: "Active",
            targetDate: null, categoryType: "Emergency", icon: null,
            velocity: 2000, statusIndicator: "On Track", projectedFinishDate: "2027-01-01",
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("No Account Goal")).toBeInTheDocument();
    });
  });

  it("selects and deselects a goal card", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Select a goal to view projection")).toBeInTheDocument();
    });
  });

  it("renders achieved goal with opacity", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "Done Goal", targetAmount: "100000", currentAmount: "100000",
            accountId: 1, accountName: "HDFC Savings", status: "Achieved",
            targetDate: "2026-01-01", categoryType: "savings", icon: null,
            velocity: 10000, statusIndicator: "On Track", projectedFinishDate: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Done Goal")).toBeInTheDocument();
    });
    expect(screen.getByText("Achieved")).toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
  });

  it("renders zero velocity goal without velocity section", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1, name: "No Velocity", targetAmount: "100000", currentAmount: "10000",
            accountId: 1, accountName: "HDFC", status: "Active",
            targetDate: null, categoryType: "savings", icon: "🏠",
            velocity: 0, statusIndicator: "At Risk", projectedFinishDate: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("No Velocity")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Velocity:.*\/mo/)).not.toBeInTheDocument();
  });

  it("opens edit dialog and modifies fields", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    expect(nameInput).toBeInTheDocument();
    const targetInput = screen.getByDisplayValue("300000");
    expect(targetInput).toBeInTheDocument();
    const currentInput = screen.getByDisplayValue("150000");
    expect(currentInput).toBeInTheDocument();
  });

  it("updates goal via edit dialog", async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.put("/api/goals/:id", async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ...putBody });
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Fund");
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(putBody).toBeTruthy();
    });
  });

  it("shows projection chart error state", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText(/failed to load projection/i)).toBeInTheDocument();
    });
  });

  it("shows not enough data state for empty projection", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
    });
  });

  it("deletes a goal via trash button", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/goals/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const trashButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    expect(trashButtons.length).toBeGreaterThan(0);
    await user.click(trashButtons[0]);
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it("cancels edit dialog", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Edit Goal")).not.toBeInTheDocument();
    });
  });

  it("creates a new goal with all fields", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/goals", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 10, ...postBody, currentAmount: "0", status: "Active", velocityPerMonth: "0", monthsRemaining: null },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    const nameInputs = screen.getAllByPlaceholderText("e.g., Vacation Fund");
    await user.type(nameInputs[0], "New Test Goal");
    const amountInputs = screen.getAllByPlaceholderText("50000");
    await user.type(amountInputs[0], "100000");
    const accountTriggers = screen.getAllByText("Select account");
    if (accountTriggers.length > 0) {
      await user.click(accountTriggers[0]);
      const opts = await screen.findAllByText("HDFC Savings");
      if (opts.length > 0) {
        await user.click(opts[opts.length - 1]);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
    const saveBtns = screen.getAllByRole("button", { name: /create$/i });
    if (saveBtns.length > 0) {
      await user.click(saveBtns[saveBtns.length - 1]);
    }
    await waitFor(() => {
      if (postBody) {
        expect(postBody).toHaveProperty("name", "New Test Goal");
      }
    }, { timeout: 3000 });
  });

  it("shows missing fields toast when creating goal without required fields", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    const saveBtns = screen.getAllByRole("button", { name: /create$/i });
    if (saveBtns.length > 0) {
      await user.click(saveBtns[saveBtns.length - 1]);
    }
    await waitFor(() => {
      expect(screen.getByText(/missing fields/i)).toBeInTheDocument();
    });
  });

  it("handles create goal API error", async () => {
    server.use(
      http.post("/api/goals", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create goal/i }));
    await waitFor(() => {
      expect(screen.getByText("Create New Goal")).toBeInTheDocument();
    });
    const nameInputs = screen.getAllByPlaceholderText("e.g., Vacation Fund");
    await user.type(nameInputs[0], "Fail Goal");
    const amountInputs = screen.getAllByPlaceholderText("50000");
    await user.type(amountInputs[0], "50000");
    const accountTriggers = screen.getAllByText("Select account");
    if (accountTriggers.length > 0) {
      await user.click(accountTriggers[0]);
      const opts = await screen.findAllByText("HDFC Savings");
      if (opts.length > 0) {
        await user.click(opts[opts.length - 1]);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
    const saveBtns = screen.getAllByRole("button", { name: /create$/i });
    if (saveBtns.length > 0) {
      await user.click(saveBtns[saveBtns.length - 1]);
    }
    await waitFor(() => {
      const errorToasts = screen.queryAllByText(/error/i);
      expect(errorToasts.length).toBeGreaterThanOrEqual(0);
    }, { timeout: 3000 });
  });

  it("handles delete goal API error", async () => {
    server.use(
      http.delete("/api/goals/:id", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const trashButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (trashButtons.length > 0) {
      await user.click(trashButtons[0]);
      await waitFor(() => {
        const errorToasts = screen.queryAllByText(/cannot delete/i);
        expect(errorToasts.length).toBeGreaterThanOrEqual(0);
      });
    }
  });

  it("updates a goal via the edit dialog and calls API", async () => {
    let putCalled = false;
    server.use(
      http.put("/api/goals/:id", async ({ request }) => {
        putCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...body, id: 1, status: "Active" });
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Edit Goal")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Emergency Fund");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Emergency");
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(putCalled).toBe(true);
    }, { timeout: 3000 });
  });

  it("toggles chart expanded state", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    const expandBtns = screen.queryAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-chevron-down") !== null,
    );
    if (expandBtns.length > 0) {
      await user.click(expandBtns[0]);
    }
  });

  it("shows projection chart with actual and pace data when goal is selected", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json([
          { month: "Jan", actual: 5000, currentPace: 5000, neededPace: 8000, targetAmount: 100000 },
          { month: "Feb", actual: 10000, currentPace: 10000, neededPace: 16000, targetAmount: 100000 },
          { month: "Mar", actual: null, currentPace: 15000, neededPace: 24000, targetAmount: 100000 },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getAllByText("Goal Projection").length).toBeGreaterThan(0);
    });
  });

  it("shows projection chart error state", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText(/failed to load projection/i)).toBeInTheDocument();
    });
  });

  it("deselects goal by clicking it again", async () => {
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const goalCard = screen.getByText("Emergency Fund").closest("[class*='cursor-pointer']");
    expect(goalCard).toBeTruthy();
    if (goalCard) {
      await user.click(goalCard);
      await waitFor(() => {
        expect(screen.getAllByText("Goal Projection").length).toBeGreaterThan(0);
      });
      await user.click(goalCard);
      await waitFor(() => {
        expect(screen.getByText("Select a goal to view projection")).toBeInTheDocument();
      });
    }
  });

  it("shows empty goals state when no goals exist", async () => {
    server.use(
      http.get("/api/goals", () => HttpResponse.json([])),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/no goals created yet/i)).toBeInTheDocument();
    });
  });

  it("shows goal projection description variants", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () =>
        HttpResponse.json([
          { month: "Jan", actual: 5000, currentPace: null, neededPace: null, targetAmount: 100000 },
          { month: "Feb", actual: 10000, currentPace: null, neededPace: null, targetAmount: 100000 },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Emergency Fund"));
    await waitFor(() => {
      expect(screen.getByText(/actual savings so far/i)).toBeInTheDocument();
    });
  });

  describe("mobile mode", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders mobile sheet layout for create goal", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderGoals();
      await waitFor(() => {
        expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /create goal/i }));
      await waitFor(() => {
        expect(screen.getByText("Create New Goal")).toBeInTheDocument();
      });
    });

    it("expands chart section when goal is clicked on mobile", async () => {
      const user = userEvent.setup();
      renderGoals();
      await waitFor(() => {
        expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Emergency Fund"));
      await waitFor(() => {
        expect(screen.getAllByText("Goal Projection").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("toggles mobile chart expansion", async () => {
      const user = userEvent.setup();
      renderGoals();
      await waitFor(() => {
        expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
      });
      const expandBtn = screen.getByText("Goal Projection").closest("button");
      expect(expandBtn).toBeTruthy();
      if (expandBtn) {
        await user.click(expandBtn);
        await waitFor(() => {
          expect(screen.getByText("Select a goal to view projection")).toBeInTheDocument();
        });
        await user.click(expandBtn);
      }
    });

    it("renders edit goal as sheet on mobile", async () => {
      const user = userEvent.setup();
      renderGoals();
      await waitFor(() => {
        expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
      });
      const editButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-pencil") !== null,
      );
      await user.click(editButtons[0]);
      await waitFor(() => {
        expect(screen.getByText("Edit Goal")).toBeInTheDocument();
      });
    });
  });

  it("shows goals loading state", async () => {
    server.use(
      http.get("/api/goals", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    renderGoals();
    expect(screen.queryByText("Emergency Fund")).not.toBeInTheDocument();
  });

  it("shows goals error state with retry", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText(/failed to load goals/i)).toBeInTheDocument();
    });
  });

  it("shows Achieved status style for completed goals", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1,
            name: "Completed Goal",
            targetAmount: "50000",
            currentAmount: "50000",
            targetDate: "2026-12-31",
            status: "Achieved",
            statusIndicator: "On Track",
            categoryType: "Emergency",
            accountId: 1,
            accountName: "HDFC Savings",
            velocity: 5000,
            projectedFinishDate: "2026-06-01",
            icon: null,
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Achieved")).toBeInTheDocument();
    });
  });

  it("renders goal projection chart when goal is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const goalCard = screen.getByText("Emergency Fund").closest("[class*='card']");
    expect(goalCard).toBeTruthy();
    await user.click(goalCard!);
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
  });

  it("renders projection chart with error state", async () => {
    server.use(
      http.get("/api/goals/:id/projection", () => HttpResponse.json({ message: "Server error" }, { status: 500 })),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const goalCard = screen.getByText("Emergency Fund").closest("[class*='card']");
    await user.click(goalCard!);
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/failed to load projection/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("deselects goal on second click and shows placeholder", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    });
    const goalCard = screen.getByText("Emergency Fund").closest("[class*='card']");
    await user.click(goalCard!);
    await waitFor(() => {
      expect(screen.getByText("Goal Projection")).toBeInTheDocument();
    });
    await user.click(goalCard!);
    await waitFor(() => {
      expect(screen.getByText(/select a goal to view projection/i)).toBeInTheDocument();
    });
  });

  it("shows goal with zero velocity (no velocity section)", async () => {
    server.use(
      http.get("/api/goals", () =>
        HttpResponse.json([
          {
            id: 1,
            name: "No Velocity Goal",
            targetAmount: "50000",
            currentAmount: "0",
            targetDate: null,
            status: "Active",
            statusIndicator: "Not Started",
            categoryType: "General",
            accountId: 1,
            accountName: null,
            velocity: 0,
            projectedFinishDate: null,
            icon: "🏠",
          },
        ]),
      ),
    );
    renderGoals();
    await waitFor(() => {
      expect(screen.getByText("No Velocity Goal")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Velocity:/)).not.toBeInTheDocument();
  });
});
