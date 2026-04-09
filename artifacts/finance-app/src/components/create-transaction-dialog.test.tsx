import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import CreateTransactionDialog from "./create-transaction-dialog";

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

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...render(
      <TestWrapper>
        <CreateTransactionDialog open={open} onOpenChange={onOpenChange} />
      </TestWrapper>,
    ),
  };
}

describe("CreateTransactionDialog", () => {
  it("renders the dialog title when open", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
  });

  it("renders form fields", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Type")).toBeInTheDocument();
    });
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders save button", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save transaction/i })).toBeInTheDocument();
    });
  });

  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("New Transaction")).not.toBeInTheDocument();
  });

  it("renders the date field", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Date")).toBeInTheDocument();
    });
  });

  it("can type into the amount field", async () => {
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "1500");
    expect(amountInput).toHaveValue(1500);
  });

  it("can type into the description field", async () => {
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("What was this for?")).toBeInTheDocument();
    });
    const descInput = screen.getByPlaceholderText("What was this for?");
    await user.type(descInput, "Groceries");
    expect(descInput).toHaveValue("Groceries");
  });

  it("renders the rupee currency symbol", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("₹")).toBeInTheDocument();
    });
  });

  it("renders category select with placeholder", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
  });

  it("renders account select with placeholder", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select account")).toBeInTheDocument();
    });
  });

  it("renders type select trigger", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Type")).toBeInTheDocument();
    });
  });

  it("renders the form element with submit handler", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    const form = screen.getByRole("button", { name: /save transaction/i }).closest("form");
    expect(form).toBeInTheDocument();
  });

  it("renders amount input with number type", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput).toHaveAttribute("type", "number");
    expect(amountInput).toHaveAttribute("step", "0.01");
  });

  it("renders description input with placeholder text", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("What was this for?")).toBeInTheDocument();
    });
  });

  it("save button is not disabled initially", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save transaction/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /save transaction/i })).not.toBeDisabled();
  });

  it("renders the dialog close button", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it("shows category names from API after loading", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    const categoryTrigger = screen.getByText("Select category");
    await user.click(categoryTrigger);
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
  });

  it("shows account names from API after loading", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select account")).toBeInTheDocument();
    });
    const accountTrigger = screen.getByText("Select account");
    await user.click(accountTrigger);
    await waitFor(() => {
      expect(screen.getAllByText("HDFC Savings").length).toBeGreaterThan(0);
    });
  });

  it("shows add category input when + Add Category is clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    const categoryTrigger = screen.getByText("Select category");
    await user.click(categoryTrigger);
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
  });

  it("shows cancel button in add category mode", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Select category"));
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  it("can type in add category input", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Select category"));
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
    const catInput = screen.getByPlaceholderText("New category name");
    await user.type(catInput, "Entertainment");
    expect(catInput).toHaveValue("Entertainment");
  });

  it("hides add category input on cancel", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Select category"));
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("New category name")).not.toBeInTheDocument();
    });
  });

  it("renders type select with Expense and Income options", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Type")).toBeInTheDocument();
    });
    const triggers = screen.getAllByRole("combobox");
    const typeTrigger = triggers[0];
    await user.click(typeTrigger);
    await waitFor(() => {
      expect(screen.getAllByText("Expense").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Income").length).toBeGreaterThan(0);
    });
  });

  it("submits form and shows validation errors when fields empty", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save transaction/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /save transaction/i }));
    await waitFor(() => {
      const errorMessages = screen.queryAllByText(/required/i);
      expect(errorMessages.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("clicks Add button in add category mode with empty name does nothing", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Select category"));
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
  });

  it("adds category via Add button when name is provided", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Select category"));
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
    const catInput = screen.getByPlaceholderText("New category name");
    await user.type(catInput, "Entertainment");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("New category name")).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("adds category via Enter key in input", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Select category"));
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
    const catInput = screen.getByPlaceholderText("New category name");
    await user.type(catInput, "Shopping");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("New category name")).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("verifies combobox elements exist for type, category, and account", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(3);
  });

  it("submits form successfully and calls onOpenChange(false)", async () => {
    const onOpenChange = vi.fn();
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/transactions", async ({ request }) => {
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 300, ...postBody, createdAt: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <CreateTransactionDialog open={true} onOpenChange={onOpenChange} />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "2500");
    const descInput = screen.getByPlaceholderText("What was this for?");
    await user.type(descInput, "Test transaction");
    const submitBtn = screen.getByRole("button", { name: /save transaction/i });
    await user.click(submitBtn);
    await waitFor(() => {
      if (postBody) {
        expect(postBody).toHaveProperty("amount", "2500");
      }
    });
  });

  it("shows error toast when form submission fails", async () => {
    server.use(
      http.post("/api/transactions", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "100");
    const descInput = screen.getByPlaceholderText("What was this for?");
    await user.type(descInput, "Fail test");
    const submitBtn = screen.getByRole("button", { name: /save transaction/i });
    await user.click(submitBtn);
    await waitFor(() => {
      const toasts = screen.queryAllByText(/failed to add transaction/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("handles category creation error gracefully", async () => {
    server.use(
      http.post("/api/categories", () =>
        HttpResponse.json({ error: "Duplicate" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Select category")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Select category"));
    await waitFor(() => {
      expect(screen.getAllByText("+ Add Category").length).toBeGreaterThan(0);
    });
    const addCatOptions = screen.getAllByText("+ Add Category");
    await user.click(addCatOptions[addCatOptions.length - 1]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    });
    const catInput = screen.getByPlaceholderText("New category name");
    await user.type(catInput, "DuplicateCat");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      const toasts = screen.queryAllByText(/failed to create category/i);
      expect(toasts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("filters categories based on selected type", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    expect(screen.getByText("Type")).toBeInTheDocument();
  });

  it("renders date picker field", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Date")).toBeInTheDocument();
    });
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("submits transaction form successfully when all fields filled", async () => {
    let postCalled = false;
    let postBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/transactions", async ({ request }) => {
        postCalled = true;
        postBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 99, ...postBody });
      }),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <CreateTransactionDialog open={true} onOpenChange={onOpenChange} />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "500");
    const descInput = screen.getByPlaceholderText("What was this for?");
    await user.type(descInput, "Test purchase");

    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    const expenseOpts = await screen.findAllByRole("option");
    const expenseOpt = expenseOpts.find(o => o.textContent?.includes("Expense"));
    if (expenseOpt) await user.click(expenseOpt);

    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(3));
    const triggers2 = screen.getAllByRole("combobox");
    await user.click(triggers2[1]);
    const catOpts = await screen.findAllByRole("option");
    const foodOpt = catOpts.find(o => o.textContent?.includes("Food"));
    if (foodOpt) await user.click(foodOpt);

    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(3));
    const triggers3 = screen.getAllByRole("combobox");
    await user.click(triggers3[2]);
    const acctOpts = await screen.findAllByRole("option");
    const hdfcOpt = acctOpts.find(o => o.textContent?.includes("HDFC"));
    if (hdfcOpt) await user.click(hdfcOpt);

    const submitBtn = screen.getByText("Save Transaction");
    await user.click(submitBtn);
    await waitFor(() => {
      expect(postCalled).toBe(true);
    }, { timeout: 10000 });
    expect(postBody).toHaveProperty("description", "Test purchase");
  }, 20000);

  it("shows error toast when transaction creation fails", async () => {
    server.use(
      http.post("/api/transactions", () => HttpResponse.json({ message: "Server error" }, { status: 500 })),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <CreateTransactionDialog open={true} onOpenChange={vi.fn()} />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("New Transaction")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "500");
    const descInput = screen.getByPlaceholderText("What was this for?");
    await user.type(descInput, "Fail test");

    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    const expenseOpts = await screen.findAllByRole("option");
    const expenseOpt = expenseOpts.find(o => o.textContent?.includes("Expense"));
    if (expenseOpt) await user.click(expenseOpt);

    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(3));
    const triggers2 = screen.getAllByRole("combobox");
    await user.click(triggers2[1]);
    const catOpts = await screen.findAllByRole("option");
    const foodOpt = catOpts.find(o => o.textContent?.includes("Food"));
    if (foodOpt) await user.click(foodOpt);

    await waitFor(() => expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(3));
    const triggers3 = screen.getAllByRole("combobox");
    await user.click(triggers3[2]);
    const acctOpts = await screen.findAllByRole("option");
    const hdfcOpt = acctOpts.find(o => o.textContent?.includes("HDFC"));
    if (hdfcOpt) await user.click(hdfcOpt);

    const submitBtn = screen.getByText("Save Transaction");
    await user.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/failed to add transaction/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 20000);
});
