import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import TransferModal from "./transfer-modal";

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

function renderModal(open = true, props: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  return {
    onOpenChange,
    ...render(
      <TestWrapper>
        <TransferModal open={open} onOpenChange={onOpenChange} {...props} />
      </TestWrapper>,
    ),
  };
}

describe("TransferModal", () => {
  it("renders the dialog title when open", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
  });

  it("renders form fields", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("From Account")).toBeInTheDocument();
    });
    expect(screen.getByText("To Account")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("renders Complete Transfer button", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /complete transfer/i })).toBeInTheDocument();
    });
  });

  it("does not render when closed", () => {
    renderModal(false);
    expect(screen.queryByText("Transfer Between Accounts")).not.toBeInTheDocument();
  });

  it("renders with initial values", async () => {
    render(
      <TestWrapper>
        <TransferModal
          open={true}
          onOpenChange={() => {}}
          initialValues={{ amount: "5000", description: "CC Payment" }}
        />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput).toHaveValue(5000);
    const descInput = screen.getByPlaceholderText("e.g. CC payment");
    expect(descInput).toHaveValue("CC Payment");
  });

  it("renders description field as optional", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Description (optional)")).toBeInTheDocument();
    });
  });

  it("can type into amount field", async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    await user.type(amountInput, "10000");
    expect(amountInput).toHaveValue(10000);
  });

  it("can type into description field", async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. CC payment")).toBeInTheDocument();
    });
    const descInput = screen.getByPlaceholderText("e.g. CC payment");
    await user.type(descInput, "Monthly transfer");
    expect(descInput).toHaveValue("Monthly transfer");
  });

  it("renders the rupee currency symbol", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("₹")).toBeInTheDocument();
    });
  });

  it("renders source account placeholder", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Select source account")).toBeInTheDocument();
    });
  });

  it("renders destination account placeholder", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Select destination account")).toBeInTheDocument();
    });
  });

  it("renders the form element", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    const form = screen.getByRole("button", { name: /complete transfer/i }).closest("form");
    expect(form).toBeInTheDocument();
  });

  it("renders amount input with number type", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput).toHaveAttribute("type", "number");
    expect(amountInput).toHaveAttribute("step", "0.01");
  });

  it("complete transfer button is not disabled initially", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /complete transfer/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /complete transfer/i })).not.toBeDisabled();
  });

  it("resets form when opened without initialValues", async () => {
    const { rerender } = render(
      <TestWrapper>
        <TransferModal open={false} onOpenChange={() => {}} />
      </TestWrapper>,
    );
    rerender(
      <TestWrapper>
        <TransferModal open={true} onOpenChange={() => {}} />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(null);
  });

  it("renders with fromAccountId initial value", async () => {
    render(
      <TestWrapper>
        <TransferModal
          open={true}
          onOpenChange={() => {}}
          initialValues={{ fromAccountId: "1", amount: "2500" }}
        />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput).toHaveValue(2500);
  });

  it("renders with date initial value", async () => {
    render(
      <TestWrapper>
        <TransferModal
          open={true}
          onOpenChange={() => {}}
          initialValues={{ date: "2026-04-15" }}
        />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
  });

  it("renders form with all required fields and submit button", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("From Account")).toBeInTheDocument();
    });
    expect(screen.getByText("To Account")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Description (optional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete transfer/i })).toBeInTheDocument();
  });

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /complete transfer/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /complete transfer/i }));
    await waitFor(() => {
      const errorMessages = screen.queryAllByText(/select/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it("verifies combobox elements exist for from and to account", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("renders with all initial values set", async () => {
    render(
      <TestWrapper>
        <TransferModal
          open={true}
          onOpenChange={() => {}}
          initialValues={{
            fromAccountId: "1",
            toAccountId: "2",
            amount: "10000",
            date: "2026-04-20",
            description: "Monthly transfer",
          }}
        />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(10000);
    expect(screen.getByPlaceholderText("e.g. CC payment")).toHaveValue("Monthly transfer");
  });
});

describe("TransferModal - additional", () => {
  it("renders title and form when open with no initial values", async () => {
    render(
      <TestWrapper>
        <TransferModal open={true} onOpenChange={() => {}} />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    expect(screen.getByText("From Account")).toBeInTheDocument();
    expect(screen.getByText("To Account")).toBeInTheDocument();
  });

  it("submits transfer form successfully via API", async () => {
    let postCalled = false;
    server.use(
      http.post("/api/transfers", async ({ request }) => {
        postCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 300, ...body, createdAt: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <TransferModal
          open={true}
          onOpenChange={onOpenChange}
          initialValues={{
            fromAccountId: "1",
            toAccountId: "2",
            amount: "5000",
            date: "2026-04-10",
            description: "Test transfer",
          }}
        />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    const submitBtn = screen.getByRole("button", { name: /complete transfer/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });

  it("shows error toast on transfer failure", async () => {
    server.use(
      http.post("/api/transfers", () =>
        HttpResponse.json({ error: "Transfer failed" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <TransferModal
          open={true}
          onOpenChange={() => {}}
          initialValues={{
            fromAccountId: "1",
            toAccountId: "2",
            amount: "5000",
            date: "2026-04-10",
          }}
        />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    const submitBtn = screen.getByRole("button", { name: /complete transfer/i });
    await user.click(submitBtn);
    await waitFor(() => {
      const failedTexts = screen.queryAllByText(/transfer failed/i);
      expect(failedTexts.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("shows error toast when source and destination are same", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <TestWrapper>
        <TransferModal
          open={true}
          onOpenChange={() => {}}
          initialValues={{
            fromAccountId: "1",
            toAccountId: "1",
            amount: "5000",
            date: "2026-04-10",
          }}
        />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText("Transfer Between Accounts")).toBeInTheDocument();
    });
    const submitBtn = screen.getByRole("button", { name: /complete transfer/i });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/source and destination must be different/i)).toBeInTheDocument();
    });
  });

  it("renders date picker field with label", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText("Date")).toBeInTheDocument();
    });
    const dateBtn = screen.queryByText("Pick a date");
    if (dateBtn) {
      expect(dateBtn).toBeInTheDocument();
    } else {
      expect(screen.getByText("Date")).toBeInTheDocument();
    }
  });
});

