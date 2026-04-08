import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import Accounts from "./accounts";

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
});
