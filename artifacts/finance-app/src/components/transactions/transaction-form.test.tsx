import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formSchema, TransactionFormFields, TransactionFormWrapper, EditTransactionPanel } from "./transaction-form";
import { TestWrapper } from "@/test/test-wrapper";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FormValues } from "./transaction-form";

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

function FormFieldsHarness(overrides: Partial<React.ComponentProps<typeof TransactionFormFields>> = {}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: "2026-04-05",
      amount: "500",
      description: "Test",
      type: "Expense",
      category: "Food",
      accountId: "1",
    },
  });

  const defaults: React.ComponentProps<typeof TransactionFormFields> = {
    form,
    onSubmit: vi.fn(),
    onTypeChange: vi.fn(),
    filteredCategories: [
      { id: 1, name: "Food" },
      { id: 2, name: "Transport" },
    ],
    accounts: [
      { id: 1, name: "HDFC" },
      { id: 2, name: "SBI" },
    ],
    isAddingCategory: false,
    setIsAddingCategory: vi.fn(),
    newCatName: "",
    setNewCatName: vi.fn(),
    handleAddCategory: vi.fn(),
    createCategory: { isPending: false },
    createTx: { isPending: false },
    ...overrides,
  };

  return <TransactionFormFields {...defaults} />;
}

function WrapperHarness(overrides: Partial<React.ComponentProps<typeof TransactionFormWrapper>> = {}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: "2026-04-05",
      amount: "500",
      description: "Test",
      type: "Expense",
      category: "Food",
      accountId: "1",
    },
  });

  const defaults: React.ComponentProps<typeof TransactionFormWrapper> = {
    isOpen: false,
    onOpenChange: vi.fn(),
    form,
    onSubmit: vi.fn(),
    onTypeChange: vi.fn(),
    filteredCategories: [{ id: 1, name: "Food" }],
    accounts: [{ id: 1, name: "HDFC" }],
    isAddingCategory: false,
    setIsAddingCategory: vi.fn(),
    newCatName: "",
    setNewCatName: vi.fn(),
    handleAddCategory: vi.fn(),
    createCategory: { isPending: false },
    createTx: { isPending: false },
    ...overrides,
  };

  return <TransactionFormWrapper {...defaults} />;
}

function EditPanelHarness(overrides: Partial<React.ComponentProps<typeof EditTransactionPanel>> = {}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: "2026-04-05",
      amount: "500",
      description: "Test",
      type: "Expense",
      category: "Food",
      accountId: "1",
    },
  });

  const defaults: React.ComponentProps<typeof EditTransactionPanel> = {
    editingTx: null,
    onClose: vi.fn(),
    editForm: form,
    onEditSubmit: vi.fn(),
    onEditTypeChange: vi.fn(),
    editFilteredCategories: [{ id: 1, name: "Food" }],
    accounts: [{ id: 1, name: "HDFC" }],
    isAddingCategory: false,
    setIsAddingCategory: vi.fn(),
    newCatName: "",
    setNewCatName: vi.fn(),
    handleAddCategory: vi.fn(),
    createCategory: { isPending: false },
    updateTx: { isPending: false },
    ...overrides,
  };

  return <EditTransactionPanel {...defaults} />;
}

describe("formSchema", () => {
  it("validates correct form data", () => {
    const validData = {
      date: "2026-04-05",
      amount: "5000",
      description: "Groceries",
      type: "Expense",
      category: "Food",
      accountId: "1",
    };
    const result = formSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing date", () => {
    const data = {
      amount: "5000",
      description: "Groceries",
      type: "Expense",
      category: "Food",
      accountId: "1",
    };
    expect(formSchema.safeParse(data).success).toBe(false);
  });

  it("rejects empty amount", () => {
    const data = {
      date: "2026-04-05",
      amount: "",
      description: "Groceries",
      type: "Expense",
      category: "Food",
      accountId: "1",
    };
    expect(formSchema.safeParse(data).success).toBe(false);
  });

  it("rejects invalid type", () => {
    const data = {
      date: "2026-04-05",
      amount: "5000",
      description: "Groceries",
      type: "Transfer",
      category: "Food",
      accountId: "1",
    };
    expect(formSchema.safeParse(data).success).toBe(false);
  });

  it("accepts Income type", () => {
    const data = {
      date: "2026-04-05",
      amount: "100000",
      description: "Salary",
      type: "Income",
      category: "Paycheck",
      accountId: "1",
    };
    expect(formSchema.safeParse(data).success).toBe(true);
  });

  it("rejects empty description", () => {
    const data = {
      date: "2026-04-05",
      amount: "5000",
      description: "",
      type: "Expense",
      category: "Food",
      accountId: "1",
    };
    expect(formSchema.safeParse(data).success).toBe(false);
  });

  it("rejects empty category", () => {
    const data = {
      date: "2026-04-05",
      amount: "5000",
      description: "Groceries",
      type: "Expense",
      category: "",
      accountId: "1",
    };
    expect(formSchema.safeParse(data).success).toBe(false);
  });

  it("rejects empty accountId", () => {
    const data = {
      date: "2026-04-05",
      amount: "5000",
      description: "Groceries",
      type: "Expense",
      category: "Food",
      accountId: "",
    };
    expect(formSchema.safeParse(data).success).toBe(false);
  });
});

describe("TransactionFormFields", () => {
  it("renders all form labels", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders submit button with default label", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    expect(screen.getByText("Save Transaction")).toBeInTheDocument();
  });

  it("renders submit button with custom label", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness submitLabel="Update Transaction" />
      </TestWrapper>,
    );
    expect(screen.getByText("Update Transaction")).toBeInTheDocument();
  });

  it("shows Saving... when createTx is pending", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness createTx={{ isPending: true }} />
      </TestWrapper>,
    );
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("shows category add form when isAddingCategory is true", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness isAddingCategory={true} />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText("New category name")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows ... when createCategory is pending", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness isAddingCategory={true} createCategory={{ isPending: true }} />
      </TestWrapper>,
    );
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("calls setNewCatName when typing in new category input", async () => {
    const setNewCatName = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <FormFieldsHarness isAddingCategory={true} setNewCatName={setNewCatName} />
      </TestWrapper>,
    );
    await user.type(screen.getByPlaceholderText("New category name"), "x");
    expect(setNewCatName).toHaveBeenCalled();
  });

  it("calls handleAddCategory on Add button click", async () => {
    const handleAddCategory = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <FormFieldsHarness isAddingCategory={true} handleAddCategory={handleAddCategory} />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Add"));
    expect(handleAddCategory).toHaveBeenCalled();
  });

  it("calls Cancel to exit add category mode", async () => {
    const setIsAddingCategory = vi.fn();
    const setNewCatName = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <FormFieldsHarness
          isAddingCategory={true}
          setIsAddingCategory={setIsAddingCategory}
          setNewCatName={setNewCatName}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Cancel"));
    expect(setIsAddingCategory).toHaveBeenCalledWith(false);
    expect(setNewCatName).toHaveBeenCalledWith("");
  });

  it("renders description input", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText("What was this for?")).toBeInTheDocument();
  });

  it("renders amount input with rupee symbol", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    expect(screen.getByText("₹")).toBeInTheDocument();
  });
});

describe("TransactionFormWrapper", () => {
  it("renders Log Transaction button", () => {
    render(
      <TestWrapper>
        <WrapperHarness />
      </TestWrapper>,
    );
    expect(screen.getByText("Log Transaction")).toBeInTheDocument();
  });

  it("renders dialog when isOpen is true (desktop)", () => {
    render(
      <TestWrapper>
        <WrapperHarness isOpen={true} />
      </TestWrapper>,
    );
    expect(screen.getByText("New Transaction")).toBeInTheDocument();
  });
});

describe("EditTransactionPanel", () => {
  it("does not render when editingTx is null", () => {
    render(
      <TestWrapper>
        <EditPanelHarness editingTx={null} />
      </TestWrapper>,
    );
    expect(screen.queryByText("Edit Transaction")).not.toBeInTheDocument();
  });

  it("renders dialog when editingTx is provided (desktop)", () => {
    const tx = {
      id: 1,
      date: "2026-04-05",
      amount: "500",
      description: "Test",
      category: "Food",
      type: "Expense",
      accountId: 1,
      toAccountId: null,
      createdAt: "2026-04-05T10:00:00Z",
    };
    render(
      <TestWrapper>
        <EditPanelHarness editingTx={tx} />
      </TestWrapper>,
    );
    expect(screen.getByText("Edit Transaction")).toBeInTheDocument();
    expect(screen.getByText("Update Transaction")).toBeInTheDocument();
  });
});

describe("TransactionFormFields - select rendering", () => {
  it("renders type select with Expense/Income options", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("renders category select trigger", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders account select trigger", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders date picker", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("calls handleAddCategory when Enter is pressed in new category input", async () => {
    const handleAddCategory = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <FormFieldsHarness isAddingCategory={true} handleAddCategory={handleAddCategory} />
      </TestWrapper>,
    );
    const input = screen.getByPlaceholderText("New category name");
    await user.type(input, "Test{Enter}");
    expect(handleAddCategory).toHaveBeenCalled();
  });

  it("renders form with multiple categories listed", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness
          filteredCategories={[
            { id: 1, name: "Food" },
            { id: 2, name: "Transport" },
            { id: 3, name: "Utilities" },
          ]}
        />
      </TestWrapper>,
    );
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("renders form with multiple accounts", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness
          accounts={[
            { id: 1, name: "HDFC" },
            { id: 2, name: "SBI" },
            { id: 3, name: "ICICI" },
          ]}
        />
      </TestWrapper>,
    );
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});

describe("TransactionFormWrapper - open state", () => {
  it("renders form fields when dialog is open", () => {
    render(
      <TestWrapper>
        <WrapperHarness isOpen={true} />
      </TestWrapper>,
    );
    expect(screen.getByText("New Transaction")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
  });

  it("renders Log Transaction button with testid", () => {
    render(
      <TestWrapper>
        <WrapperHarness />
      </TestWrapper>,
    );
    expect(screen.getByTestId("btn-new-tx")).toBeInTheDocument();
  });

  it("opens dialog when clicking Log Transaction button", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <WrapperHarness onOpenChange={onOpenChange} />
      </TestWrapper>,
    );
    await user.click(screen.getByTestId("btn-new-tx"));
    expect(onOpenChange).toHaveBeenCalled();
  });
});

describe("TransactionFormFields - additional rendering", () => {
  it("renders with all default values filled in", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What was this for?")).toBeInTheDocument();
    const comboboxes = screen.queryAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders with empty categories list", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness filteredCategories={[]} />
      </TestWrapper>,
    );
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("renders with empty accounts list", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness accounts={[]} />
      </TestWrapper>,
    );
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});

describe("TransactionFormFields - form submission", () => {
  it("submits the form with valid data", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <FormFieldsHarness onSubmit={onSubmit} />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Save Transaction"));
  });

  it("renders amount field with rupee symbol and number input", () => {
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput).toHaveAttribute("type", "number");
    expect(screen.getByText("₹")).toBeInTheDocument();
  });
});

describe("TransactionFormFields - amount input change", () => {
  it("allows typing a new amount value", async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    const amountInput = screen.getByPlaceholderText("0.00");
    await user.clear(amountInput);
    await user.type(amountInput, "1200");
    expect(amountInput).toHaveValue(1200);
  });

  it("allows typing a description", async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <FormFieldsHarness />
      </TestWrapper>,
    );
    const descInput = screen.getByPlaceholderText("What was this for?");
    await user.clear(descInput);
    await user.type(descInput, "Lunch at office");
    expect(descInput).toHaveValue("Lunch at office");
  });
});

describe("TransactionFormWrapper - mobile rendering", () => {
  const mockUseMediaQuery = vi.fn(() => true);

  it("renders mobile sheet trigger when isMobile is true", () => {
    vi.mock("@/hooks/use-media-query", () => ({
      useMediaQuery: () => true,
    }));
    render(
      <TestWrapper>
        <WrapperHarness />
      </TestWrapper>,
    );
    expect(screen.getByTestId("btn-new-tx")).toBeInTheDocument();
  });
});

describe("EditTransactionPanel - with transaction", () => {
  it("renders Update Transaction button when editingTx is set", () => {
    const tx = {
      id: 1,
      date: "2026-04-05",
      amount: "500",
      description: "Test",
      category: "Food",
      type: "Expense",
      accountId: 1,
      toAccountId: null,
      createdAt: "2026-04-05T10:00:00Z",
    };
    render(
      <TestWrapper>
        <EditPanelHarness editingTx={tx} />
      </TestWrapper>,
    );
    expect(screen.getByText("Edit Transaction")).toBeInTheDocument();
    expect(screen.getByText("Update Transaction")).toBeInTheDocument();
  });

  it("calls onClose when dialog is closed", async () => {
    const onClose = vi.fn();
    const tx = {
      id: 1,
      date: "2026-04-05",
      amount: "500",
      description: "Test",
      category: "Food",
      type: "Expense",
      accountId: 1,
      toAccountId: null,
      createdAt: "2026-04-05T10:00:00Z",
    };
    render(
      <TestWrapper>
        <EditPanelHarness editingTx={tx} onClose={onClose} />
      </TestWrapper>,
    );
    expect(screen.getByText("Edit Transaction")).toBeInTheDocument();
  });
});
