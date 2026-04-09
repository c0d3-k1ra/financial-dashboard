import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Accounts from "./accounts";

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

beforeEach(() => {
  mockUseIsMobile.mockReturnValue(false);
});

function renderAccounts() {
  return render(
    <TestWrapper>
      <Accounts />
    </TestWrapper>,
  );
}

describe("Accounts page", () => {
  it("renders the page heading", async () => {
    renderAccounts();
    expect(screen.getByText("Manage Accounts")).toBeInTheDocument();
    expect(screen.getByText(/track your bank accounts/i)).toBeInTheDocument();
  });

  it("renders account names after data loads", async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    expect(screen.getByText("SBI Savings")).toBeInTheDocument();
    expect(screen.getByText("ICICI Credit Card")).toBeInTheDocument();
    expect(screen.getByText("Home Loan")).toBeInTheDocument();
  });

  it("displays Add Account button", async () => {
    renderAccounts();
    expect(screen.getByRole("button", { name: /add account/i })).toBeInTheDocument();
  });

  it("displays Transfer button", async () => {
    renderAccounts();
    expect(screen.getByRole("button", { name: /transfer/i })).toBeInTheDocument();
  });

  it("displays Process EMIs button when loan accounts exist", async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
    });
  });

  it("shows loading state while accounts load", async () => {
    server.use(
      http.get("/api/accounts", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    const { container } = renderAccounts();
    const pulsingElements = container.querySelectorAll('[class*="animate-pulse"]');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("shows error state when account fetch fails", async () => {
    server.use(
      http.get("/api/accounts", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderAccounts();
    await waitFor(() => {
      const errors = screen.getAllByText(/failed to load accounts/i);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it("shows empty state when no accounts exist", async () => {
    server.use(http.get("/api/accounts", () => HttpResponse.json([])));
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText(/add your first bank account/i)).toBeInTheDocument();
    });
  });

  it("opens create account dialog when Add Account is clicked", async () => {
    const user = userEvent.setup();
    renderAccounts();
    const addBtn = screen.getByRole("button", { name: /add account/i });
    await user.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText("New Account")).toBeInTheDocument();
    });
  });

  it("shows create account form with name and type fields", async () => {
    const user = userEvent.setup();
    renderAccounts();
    const addBtn = screen.getByRole("button", { name: /add account/i });
    await user.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText("New Account")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("e.g. HDFC Savings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("allows typing an account name in the create form", async () => {
    const user = userEvent.setup();
    renderAccounts();
    const addBtn = screen.getByRole("button", { name: /add account/i });
    await user.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText("New Account")).toBeInTheDocument();
    });
    const nameInput = screen.getByPlaceholderText("e.g. HDFC Savings");
    await user.type(nameInput, "Test Account");
    expect(nameInput).toHaveValue("Test Account");
  });

  it("submits create account form and calls the API", async () => {
    let postCalled = false;
    server.use(
      http.post("/api/accounts", async ({ request }) => {
        postCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 200, ...body }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderAccounts();
    const addBtn = screen.getByRole("button", { name: /add account/i });
    await user.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText("New Account")).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText("e.g. HDFC Savings");
    await user.type(nameInput, "My New Bank");

    const createBtn = screen.getByRole("button", { name: /create account/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });

  it("opens edit modal when clicking the edit (pencil) button on an account", async () => {
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/edit:/i)).toBeInTheDocument();
    });
  });

  it("can modify account name in the edit form and save", async () => {
    let putCalled = false;
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.put("/api/accounts/:id", async ({ request }) => {
        putCalled = true;
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ...putBody });
      }),
    );

    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/edit:/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue("HDFC Savings");
    await user.clear(nameInput);
    await user.type(nameInput, "HDFC Primary");

    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(putCalled).toBe(true);
    });
    expect(putBody).toHaveProperty("name", "HDFC Primary");
  });

  it("shows account sections grouped by type", async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    expect(screen.getByText("Bank Accounts")).toBeInTheDocument();
    expect(screen.getByText("ICICI Credit Card")).toBeInTheDocument();
    expect(screen.getByText("Home Loan")).toBeInTheDocument();
  });

  it("opens delete confirmation dialog when delete button is clicked", async () => {
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/delete this account/i)).toBeInTheDocument();
      });
    }
  });

  it("deletes an account via API when confirmed", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/accounts/:id", () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/delete this account/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(deleteCalled).toBe(true);
      });
    }
  });

  it("opens reconcile dialog when reconcile button is clicked", async () => {
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const reconcileButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-scale") !== null,
    );
    if (reconcileButtons.length > 0) {
      await user.click(reconcileButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/reconcile/i)).toBeInTheDocument();
      });
    }
  });

  it("shows net worth card", async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    expect(screen.getByText(/net worth/i)).toBeInTheDocument();
  });

  it("process EMIs button calls API", async () => {
    let emiCalled = false;
    server.use(
      http.post("/api/accounts/process-emis", () => {
        emiCalled = true;
        return HttpResponse.json({ processed: 0, message: "All loans are up to date." });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /process emis/i }));
    await waitFor(() => {
      expect(emiCalled).toBe(true);
    });
  });

  it("process EMIs shows processed count when EMIs exist", async () => {
    server.use(
      http.post("/api/accounts/process-emis", () => {
        return HttpResponse.json({
          processed: 1,
          results: [{ accountName: "Home Loan", emiAmount: "15000" }],
        });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /process emis/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 EMI\(s\) processed/i)).toBeInTheDocument();
    });
  });

  it("process EMIs shows error toast on failure", async () => {
    server.use(
      http.post("/api/accounts/process-emis", () => {
        return HttpResponse.json({ error: "Server error" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /process emis/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to process emis/i)).toBeInTheDocument();
    });
  });

  it("reconcile dialog submits and shows adjustment", async () => {
    server.use(
      http.post("/api/accounts/:id/reconcile", () => {
        return HttpResponse.json({
          success: true,
          previousBalance: "100000",
          newBalance: "120000",
          adjustment: "20000",
        });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const reconcileButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-scale") !== null,
    );
    if (reconcileButtons.length > 0) {
      await user.click(reconcileButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/reconcile/i)).toBeInTheDocument();
      });
      const balanceInput = screen.getByPlaceholderText(/actual balance/i);
      if (balanceInput) {
        await user.type(balanceInput, "120000");
        const confirmBtn = screen.getByRole("button", { name: /^reconcile$/i });
        await user.click(confirmBtn);
        await waitFor(() => {
          expect(screen.getByText(/account reconciled/i)).toBeInTheDocument();
        });
      }
    }
  });

  it("create account shows error toast on failure", async () => {
    server.use(
      http.post("/api/accounts", () => {
        return HttpResponse.json({ error: "Duplicate name" }, { status: 400 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    const addBtn = screen.getByRole("button", { name: /add account/i });
    await user.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText("New Account")).toBeInTheDocument();
    });
    const nameInput = screen.getByPlaceholderText("e.g. HDFC Savings");
    await user.type(nameInput, "Duplicate Account");
    const createBtn = screen.getByRole("button", { name: /create account/i });
    await user.click(createBtn);
    await waitFor(() => {
      expect(screen.getByText(/failed to create account/i)).toBeInTheDocument();
    });
  });

  it("edit account shows error toast on update failure", async () => {
    server.use(
      http.put("/api/accounts/:id", () => {
        return HttpResponse.json({ error: "Update failed" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/edit:/i)).toBeInTheDocument();
      });
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveBtn);
      await waitFor(() => {
        expect(screen.getByText(/failed to update account/i)).toBeInTheDocument();
      });
    }
  });

  it("delete account shows error toast on failure", async () => {
    server.use(
      http.delete("/api/accounts/:id", () => {
        return HttpResponse.json({ error: "Delete failed" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/delete this account/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(screen.getByText(/failed to delete account/i)).toBeInTheDocument();
      });
    }
  });

  it("reconcile fails shows error toast", async () => {
    server.use(
      http.post("/api/accounts/:id/reconcile", () => {
        return HttpResponse.json({ error: "Reconcile failed" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const reconcileButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-scale") !== null,
    );
    if (reconcileButtons.length > 0) {
      await user.click(reconcileButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/reconcile/i)).toBeInTheDocument();
      });
      const balanceInput = screen.getByPlaceholderText(/actual balance/i);
      if (balanceInput) {
        await user.type(balanceInput, "120000");
        const confirmBtn = screen.getByRole("button", { name: /^reconcile$/i });
        await user.click(confirmBtn);
        await waitFor(() => {
          expect(screen.getByText(/reconciliation failed/i)).toBeInTheDocument();
        });
      }
    }
  });

  it("reconcile success shows adjustment toast", async () => {
    server.use(
      http.post("/api/accounts/:id/reconcile", () => {
        return HttpResponse.json({ adjustment: "5000", newBalance: "105000" });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const reconcileButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-scale") !== null,
    );
    if (reconcileButtons.length > 0) {
      await user.click(reconcileButtons[0]);
      await waitFor(() => {
        expect(screen.getByText(/reconcile/i)).toBeInTheDocument();
      });
      const balanceInput = screen.getByPlaceholderText(/actual balance/i);
      if (balanceInput) {
        await user.type(balanceInput, "105000");
        const confirmBtn = screen.getByRole("button", { name: /^reconcile$/i });
        await user.click(confirmBtn);
        await waitFor(() => {
          expect(screen.getByText(/account reconciled/i)).toBeInTheDocument();
        });
      }
    }
  });

  it("processes EMIs with zero processed count", async () => {
    server.use(
      http.post("/api/accounts/process-emis", () => {
        return HttpResponse.json({ processed: 0, message: "All loans up to date." });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /process emis/i }));
    await waitFor(() => {
      expect(screen.getByText(/no emis to process/i)).toBeInTheDocument();
    });
  });

  it("processes EMIs with nonzero processed count", async () => {
    server.use(
      http.post("/api/accounts/process-emis", () => {
        return HttpResponse.json({
          processed: 1,
          results: [{ accountName: "Home Loan", emiAmount: "15000" }],
        });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /process emis/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 EMI\(s\) processed/i)).toBeInTheDocument();
    });
  });

  it("processes EMIs failure shows error", async () => {
    server.use(
      http.post("/api/accounts/process-emis", () => {
        return HttpResponse.json({ error: "fail" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /process emis/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to process emis/i)).toBeInTheDocument();
    });
  });

  it("edits a bank account name via edit flow", async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.put("/api/accounts/:id", async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ...putBody });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);
      await waitFor(() => {
        expect(screen.getByDisplayValue("HDFC Savings")).toBeInTheDocument();
      });
      const nameInput = screen.getByDisplayValue("HDFC Savings");
      await user.clear(nameInput);
      await user.type(nameInput, "Renamed Bank");
      const saveBtn = screen.getByRole("button", { name: /save/i });
      await user.click(saveBtn);
      await waitFor(() => {
        expect(putBody).toBeTruthy();
      });
    }
  });

  it("edit account API error shows error toast", async () => {
    server.use(
      http.put("/api/accounts/:id", () => {
        return HttpResponse.json({ error: "update fail" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editButtons.length > 0) {
      await user.click(editButtons[0]);
      await waitFor(() => {
        expect(screen.getByDisplayValue("HDFC Savings")).toBeInTheDocument();
      });
      const saveBtn = screen.getByRole("button", { name: /save/i });
      await user.click(saveBtn);
      await waitFor(() => {
        expect(screen.getByText(/failed to update account/i)).toBeInTheDocument();
      });
    }
  });

  it("creates a bank account via add form", async () => {
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/accounts", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 10, ...postBody }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await user.click(screen.getByRole("button", { name: /add account/i }));
    await waitFor(() => {
      expect(screen.getByText(/new account/i)).toBeInTheDocument();
    });
    const nameInputs = screen.getAllByPlaceholderText(/HDFC Savings/i);
    await user.type(nameInputs[0], "New Bank Account");
    const balanceInputs = screen.getAllByPlaceholderText("0.00");
    if (balanceInputs.length > 0) {
      await user.type(balanceInputs[0], "50000");
    }
    const submitBtn = screen.getByRole("button", { name: /create account/i });
    await user.click(submitBtn);
    await waitFor(() => {
      if (postBody) {
        expect(postBody).toHaveProperty("name", "New Bank Account");
      }
    });
  });

  it("create account failure shows error toast", async () => {
    server.use(
      http.post("/api/accounts", () => {
        return HttpResponse.json({ error: "fail" }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await user.click(screen.getByRole("button", { name: /add account/i }));
    await waitFor(() => {
      expect(screen.getByText(/new account/i)).toBeInTheDocument();
    });
    const nameInputs = screen.getAllByPlaceholderText(/HDFC Savings/i);
    await user.type(nameInputs[0], "Fail Account");
    const submitBtn = screen.getByRole("button", { name: /create account/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/failed to create account/i)).toBeInTheDocument();
    });
  });

  describe("mobile mode", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders mobile sheet layout for add account", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /add account/i }));
      await waitFor(() => {
        expect(screen.getByText(/new account/i)).toBeInTheDocument();
      });
    });

    it("shows account cards on mobile", async () => {
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
    });
  });

  it("shows transfer button", async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const transferBtn = screen.getByRole("button", { name: /transfer/i });
    expect(transferBtn).toBeInTheDocument();
  });

  it("opens transfer modal when transfer button is clicked", async () => {
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const transferBtn = screen.getByRole("button", { name: /transfer/i });
    await user.click(transferBtn);
    await waitFor(() => {
      expect(screen.getAllByText(/transfer/i).length).toBeGreaterThan(1);
    });
  });

  it("shows process EMIs button when loans exist", async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("Home Loan")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /process emis/i })).toBeInTheDocument();
  });

  it("clicks process EMIs button and calls API", async () => {
    let emiCalled = false;
    server.use(
      http.post("/api/accounts/process-emis", () => {
        emiCalled = true;
        return HttpResponse.json({ processed: 1 });
      }),
    );
    const user = userEvent.setup();
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("Home Loan")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /process emis/i }));
    await waitFor(() => {
      expect(emiCalled).toBe(true);
    }, { timeout: 3000 });
  });

  it("shows error state with retry", async () => {
    server.use(
      http.get("/api/accounts", () => HttpResponse.json({ error: "fail" }, { status: 500 })),
    );
    renderAccounts();
    await waitFor(() => {
      expect(screen.getAllByText(/failed to load accounts/i).length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  });

  it("shows loading skeletons", async () => {
    server.use(
      http.get("/api/accounts", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json([]);
      }),
    );
    renderAccounts();
    expect(screen.queryByText("HDFC Savings")).not.toBeInTheDocument();
  });

  it("shows empty state when no accounts exist", async () => {
    server.use(
      http.get("/api/accounts", () => HttpResponse.json([])),
    );
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText(/add your first bank account/i)).toBeInTheDocument();
    });
  });

  it("opens delete confirmation when delete button clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const deleteBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
    );
    if (deleteBtns.length > 0) {
      await user.click(deleteBtns[0]);
      await waitFor(() => {
        expect(screen.getAllByText(/delete/i).length).toBeGreaterThan(1);
      });
    }
  });

  it("opens edit modal when edit button clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
    const editBtns = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg.lucide-pencil") !== null,
    );
    if (editBtns.length > 0) {
      await user.click(editBtns[0]);
      await waitFor(() => {
        expect(screen.getAllByText(/edit:/i).length).toBeGreaterThan(0);
      });
    }
  });

  it("reconcile early return when reconcileId is null", async () => {
    renderAccounts();
    await waitFor(() => {
      expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    });
  });

  describe("mobile mode - modals", () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it("renders mobile edit account sheet", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const editBtns = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-pencil") !== null,
      );
      if (editBtns.length > 0) {
        await user.click(editBtns[0]);
        await waitFor(() => {
          expect(screen.getAllByText(/edit:/i).length).toBeGreaterThan(0);
        });
      }
    });

    it("renders mobile delete account sheet", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const deleteBtns = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
      );
      if (deleteBtns.length > 0) {
        await user.click(deleteBtns[0]);
        await waitFor(() => {
          expect(screen.getAllByText(/delete/i).length).toBeGreaterThan(1);
        });
      }
    });

    it("renders mobile reconcile sheet", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const reconcileBtns = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-refresh-cw") !== null,
      );
      if (reconcileBtns.length > 0) {
        await user.click(reconcileBtns[0]);
        await waitFor(() => {
          expect(screen.getAllByText(/reconcile/i).length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe("reconcile flow", () => {
    it("opens reconcile modal and submits reconciliation", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const reconcileBtns = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-refresh-cw") !== null,
      );
      expect(reconcileBtns.length).toBeGreaterThan(0);
      await user.click(reconcileBtns[0]);
      await waitFor(() => {
        expect(screen.getAllByText(/reconcile/i).length).toBeGreaterThan(0);
      });
      const balanceInput = screen.getByRole("spinbutton");
      await user.clear(balanceInput);
      await user.type(balanceInput, "150000");
      const reconcileBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent === "Reconcile",
      );
      expect(reconcileBtn).toBeDefined();
      await user.click(reconcileBtn!);
      await waitFor(() => {
        expect(screen.getByText(/account reconciled/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it("handles reconcile API error gracefully", async () => {
      server.use(
        http.post("/api/accounts/:id/reconcile", () => HttpResponse.json({ message: "Server error" }, { status: 500 })),
      );
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const reconcileBtns = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-refresh-cw") !== null,
      );
      expect(reconcileBtns.length).toBeGreaterThan(0);
      await user.click(reconcileBtns[0]);
      await waitFor(() => {
        expect(screen.getAllByText(/reconcile/i).length).toBeGreaterThan(0);
      });
      const balanceInput = screen.getByRole("spinbutton");
      await user.clear(balanceInput);
      await user.type(balanceInput, "999999");
      const reconcileBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent === "Reconcile",
      );
      await user.click(reconcileBtn!);
      await waitFor(() => {
        expect(screen.getByText(/Reconciliation Failed/)).toBeInTheDocument();
      }, { timeout: 8000 });
    }, 15000);

    it("cancels reconcile modal", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const reconcileBtns = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-refresh-cw") !== null,
      );
      expect(reconcileBtns.length).toBeGreaterThan(0);
      await user.click(reconcileBtns[0]);
      await waitFor(() => {
        expect(screen.getAllByText(/reconcile/i).length).toBeGreaterThan(0);
      });
      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelBtn);
    });
  });

  describe("empty state", () => {
    it("shows empty state when no accounts exist", async () => {
      server.use(
        http.get("/api/accounts", () => HttpResponse.json([])),
      );
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText(/add your first bank account/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe("edit credit card account", () => {
    it("opens edit modal for a credit card account and populates CC fields", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("ICICI Credit Card")).toBeInTheDocument();
      });
      const ccCard = screen.getByText("ICICI Credit Card").closest("[class*='card']") || screen.getByText("ICICI Credit Card").parentElement?.parentElement?.parentElement;
      const editBtn = ccCard?.querySelector("button svg.lucide-pencil")?.closest("button");
      expect(editBtn).toBeTruthy();
      await user.click(editBtn!);
      await waitFor(() => {
        expect(screen.getByText(/Edit: ICICI Credit Card/)).toBeInTheDocument();
      });
      expect(screen.getByText("Credit Limit")).toBeInTheDocument();
      expect(screen.getByText(/Billing Due Day/)).toBeInTheDocument();
    });

    it("saves edited credit card account", async () => {
      let putBody: Record<string, unknown> | null = null;
      server.use(
        http.put("/api/accounts/:id", async ({ request }) => {
          putBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ id: 3, ...putBody });
        }),
      );
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("ICICI Credit Card")).toBeInTheDocument();
      });
      const ccCard = screen.getByText("ICICI Credit Card").closest("[class*='card']") || screen.getByText("ICICI Credit Card").parentElement?.parentElement?.parentElement;
      const editBtn = ccCard?.querySelector("button svg.lucide-pencil")?.closest("button");
      await user.click(editBtn!);
      await waitFor(() => {
        expect(screen.getByText(/Edit: ICICI Credit Card/)).toBeInTheDocument();
      });
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveBtn);
      await waitFor(() => {
        expect(putBody).not.toBeNull();
      });
      expect(putBody).toHaveProperty("type", "credit_card");
    });
  });

  describe("edit loan account", () => {
    it("opens edit modal for a loan account and populates loan fields", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("Home Loan")).toBeInTheDocument();
      });
      const loanCard = screen.getByText("Home Loan").closest("[class*='card']") || screen.getByText("Home Loan").parentElement?.parentElement?.parentElement;
      const editBtn = loanCard?.querySelector("button svg.lucide-pencil")?.closest("button");
      expect(editBtn).toBeTruthy();
      await user.click(editBtn!);
      await waitFor(() => {
        expect(screen.getByText(/Edit: Home Loan/)).toBeInTheDocument();
      });
      expect(screen.getByText("Monthly EMI")).toBeInTheDocument();
      expect(screen.getByText(/Interest Rate/)).toBeInTheDocument();
      expect(screen.getByText(/Tenure/)).toBeInTheDocument();
    });

    it("saves edited loan account", async () => {
      let putBody: Record<string, unknown> | null = null;
      server.use(
        http.put("/api/accounts/:id", async ({ request }) => {
          putBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ id: 4, ...putBody });
        }),
      );
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("Home Loan")).toBeInTheDocument();
      });
      const loanCard = screen.getByText("Home Loan").closest("[class*='card']") || screen.getByText("Home Loan").parentElement?.parentElement?.parentElement;
      const editBtn = loanCard?.querySelector("button svg.lucide-pencil")?.closest("button");
      await user.click(editBtn!);
      await waitFor(() => {
        expect(screen.getByText(/Edit: Home Loan/)).toBeInTheDocument();
      });
      const saveBtn = screen.getByRole("button", { name: /^save$/i });
      await user.click(saveBtn);
      await waitFor(() => {
        expect(putBody).not.toBeNull();
      });
      expect(putBody).toHaveProperty("type", "loan");
    });
  });

  describe("delete account flow", () => {
    it("opens delete modal when clicking delete button", async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const deleteButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
      );
      expect(deleteButtons.length).toBeGreaterThan(0);
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText("Delete Account")).toBeInTheDocument();
      });
      expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    });

    it("confirms and deletes account", async () => {
      let deleteCalled = false;
      server.use(
        http.delete("/api/accounts/:id", () => {
          deleteCalled = true;
          return HttpResponse.json({ success: true });
        }),
      );
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      renderAccounts();
      await waitFor(() => {
        expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
      });
      const deleteButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector("svg.lucide-trash-2") !== null,
      );
      await user.click(deleteButtons[0]);
      await waitFor(() => {
        expect(screen.getByText("Delete Account")).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmBtn);
      await waitFor(() => {
        expect(deleteCalled).toBe(true);
      });
    });
  });
});
