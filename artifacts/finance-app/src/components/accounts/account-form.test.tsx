import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountCreateFormFields, useAccountForm, accountFormSchema } from "./account-form";
import { TestWrapper } from "@/test/test-wrapper";

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

function FormWrapper({ onSubmit = vi.fn(), isPending = false, bankAccounts = [], existingGroups = [] }: any) {
  const form = useAccountForm();
  return (
    <TestWrapper>
      <AccountCreateFormFields form={form} onSubmit={onSubmit} isPending={isPending} bankAccounts={bankAccounts} existingGroups={existingGroups} />
    </TestWrapper>
  );
}

describe("accountFormSchema", () => {
  it("validates valid bank account", () => {
    const result = accountFormSchema.safeParse({ name: "Test", type: "bank" });
    expect(result.success).toBe(true);
  });

  it("fails when name is empty", () => {
    const result = accountFormSchema.safeParse({ name: "", type: "bank" });
    expect(result.success).toBe(false);
  });

  it("fails when loan has no original amount", () => {
    const result = accountFormSchema.safeParse({ name: "Loan", type: "loan" });
    expect(result.success).toBe(false);
  });

  it("validates loan with original amount", () => {
    const result = accountFormSchema.safeParse({ name: "Loan", type: "loan", originalLoanAmount: "100000" });
    expect(result.success).toBe(true);
  });

  it("fails when loan original amount is 0", () => {
    const result = accountFormSchema.safeParse({ name: "Loan", type: "loan", originalLoanAmount: "0" });
    expect(result.success).toBe(false);
  });

  it("validates credit_card type", () => {
    const result = accountFormSchema.safeParse({ name: "CC", type: "credit_card", creditLimit: "200000" });
    expect(result.success).toBe(true);
  });

  it("fails on invalid type", () => {
    const result = accountFormSchema.safeParse({ name: "Test", type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = accountFormSchema.safeParse({
      name: "Test",
      type: "bank",
      currentBalance: "50000",
      useInSurplus: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts loan with all optional fields", () => {
    const result = accountFormSchema.safeParse({
      name: "Home Loan",
      type: "loan",
      originalLoanAmount: "2000000",
      interestRate: "8.5",
      loanTenure: "240",
      emiAmount: "15000",
      emiDay: "5",
      loanStartDate: "2024-01-01",
      emisPaid: "24",
      linkedAccountId: "1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts credit_card with all optional fields", () => {
    const result = accountFormSchema.safeParse({
      name: "ICICI CC",
      type: "credit_card",
      creditLimit: "200000",
      billingDueDay: "15",
      sharedLimitGroup: "Group A",
      currentBalance: "-25000",
    });
    expect(result.success).toBe(true);
  });
});

describe("AccountCreateFormFields", () => {
  it("renders account name input", () => {
    render(<FormWrapper />);
    expect(screen.getByPlaceholderText("e.g. HDFC Savings")).toBeInTheDocument();
  });

  it("renders type selector", () => {
    render(<FormWrapper />);
    expect(screen.getAllByText("Bank Account").length).toBeGreaterThan(0);
  });

  it("renders create button", () => {
    render(<FormWrapper />);
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows pending state", () => {
    render(<FormWrapper isPending={true} />);
    expect(screen.getByText("Creating...")).toBeInTheDocument();
  });

  it("shows current balance field for bank type", () => {
    render(<FormWrapper />);
    expect(screen.getByText("Current Balance")).toBeInTheDocument();
  });

  it("shows surplus checkbox for bank type", () => {
    render(<FormWrapper />);
    expect(screen.getByText("Use in surplus calculation")).toBeInTheDocument();
  });

  it("can type account name", async () => {
    const user = userEvent.setup();
    render(<FormWrapper />);
    const input = screen.getByPlaceholderText("e.g. HDFC Savings");
    await user.type(input, "My Account");
    expect(input).toHaveValue("My Account");
  });

  it("disables submit button when pending", () => {
    render(<FormWrapper isPending={true} />);
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });

  it("can type current balance", async () => {
    const user = userEvent.setup();
    render(<FormWrapper />);
    const balanceInput = screen.getByPlaceholderText("0.00");
    await user.clear(balanceInput);
    await user.type(balanceInput, "75000");
    expect(balanceInput).toHaveValue(75000);
  });

  it("renders rupee symbol for balance input", () => {
    render(<FormWrapper />);
    expect(screen.getByText("₹")).toBeInTheDocument();
  });

  it("can toggle surplus checkbox", async () => {
    const user = userEvent.setup();
    render(<FormWrapper />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("renders form element with submit handler", () => {
    render(<FormWrapper />);
    const form = screen.getByRole("button", { name: /create account/i }).closest("form");
    expect(form).toBeInTheDocument();
  });

  it("renders Account Name label", () => {
    render(<FormWrapper />);
    expect(screen.getByText("Account Name")).toBeInTheDocument();
  });

  it("renders Type label", () => {
    render(<FormWrapper />);
    expect(screen.getByText("Type")).toBeInTheDocument();
  });

  it("balance input is number type with step", () => {
    render(<FormWrapper />);
    const balanceInput = screen.getByPlaceholderText("0.00");
    expect(balanceInput).toHaveAttribute("type", "number");
    expect(balanceInput).toHaveAttribute("step", "0.01");
  });

  it("renders default balance value of 0", () => {
    render(<FormWrapper />);
    const balanceInput = screen.getByPlaceholderText("0.00");
    expect(balanceInput).toHaveValue(0);
  });

  it("calls onSubmit when form is submitted with valid data", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FormWrapper onSubmit={onSubmit} />);
    const nameInput = screen.getByPlaceholderText("e.g. HDFC Savings");
    await user.type(nameInput, "Test Account");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });
});

describe("useAccountForm", () => {
  it("returns form object with default values", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("type")).toBe("bank");
    expect(result.current.getValues("name")).toBe("");
  });

  it("has default currentBalance of 0", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("currentBalance")).toBe("0");
  });

  it("has default emisPaid of 0", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("emisPaid")).toBe("0");
  });

  it("has default useInSurplus as false", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("useInSurplus")).toBe(false);
  });

  it("has empty default for creditLimit", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("creditLimit")).toBe("");
  });

  it("has empty default for emiAmount", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("emiAmount")).toBe("");
  });

  it("has empty default for interestRate", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("interestRate")).toBe("");
  });

  it("has empty default for loanTenure", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("loanTenure")).toBe("");
  });

  it("has empty default for originalLoanAmount", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("originalLoanAmount")).toBe("");
  });

  it("has empty default for sharedLimitGroup", () => {
    const wrapper = ({ children }: any) => <TestWrapper>{children}</TestWrapper>;
    const { result } = renderHook(() => useAccountForm(), { wrapper });
    expect(result.current.getValues("sharedLimitGroup")).toBe("");
  });
});

async function selectType(user: ReturnType<typeof userEvent.setup>, typeName: string) {
  const typeCombo = screen.getAllByRole("combobox")[0];
  await user.click(typeCombo);
  await waitFor(() => expect(screen.getAllByText(typeName).length).toBeGreaterThan(0));
  const options = screen.getAllByText(typeName);
  await user.click(options[options.length - 1]);
}

describe("AccountCreateFormFields - Loan type", () => {
  it("renders loan-specific fields when loan type selected", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper bankAccounts={[{ id: 1, name: "HDFC Savings" }]} />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByText("Original Loan Amount")).toBeInTheDocument();
      expect(screen.getByText(/Interest Rate/)).toBeInTheDocument();
      expect(screen.getByText(/Tenure/)).toBeInTheDocument();
      expect(screen.getByText("Loan Start Date")).toBeInTheDocument();
      expect(screen.getByText(/EMI Debit Day/)).toBeInTheDocument();
      expect(screen.getByText("EMI Debit Account")).toBeInTheDocument();
    });
  });

  it("renders linked account selector with bank accounts", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper bankAccounts={[{ id: 1, name: "HDFC Savings" }, { id: 2, name: "SBI" }]} />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByText("Select bank account")).toBeInTheDocument();
    });
  });

  it("does not show Current Balance field for loan type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByText("Original Loan Amount")).toBeInTheDocument();
    });
    expect(screen.queryByText("Current Balance")).not.toBeInTheDocument();
  });

  it("does not show surplus checkbox for loan type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByText("Original Loan Amount")).toBeInTheDocument();
    });
    expect(screen.queryByText("Use in surplus calculation")).not.toBeInTheDocument();
  });

  it("can type original loan amount after selecting loan type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. 2000000")).toBeInTheDocument();
    });
    const loanAmountInput = screen.getByPlaceholderText("e.g. 2000000");
    await user.type(loanAmountInput, "1500000");
    expect(loanAmountInput).toHaveValue(1500000);
  });

  it("can type interest rate after selecting loan type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. 10.5")).toBeInTheDocument();
    });
    const rateInput = screen.getByPlaceholderText("e.g. 10.5");
    await user.type(rateInput, "8.5");
    expect(rateInput).toHaveValue(8.5);
  });

  it("can type tenure after selecting loan type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. 36")).toBeInTheDocument();
    });
    const tenureInput = screen.getByPlaceholderText("e.g. 36");
    await user.type(tenureInput, "240");
    expect(tenureInput).toHaveValue(240);
  });
});

describe("AccountCreateFormFields - Credit Card type", () => {
  it("renders CC-specific fields when CC type selected", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper existingGroups={["Group A"]} />);
    await selectType(user, "Credit Card");
    await waitFor(() => {
      expect(screen.getByText("Credit Limit")).toBeInTheDocument();
      expect(screen.getByText(/Billing Due Day/)).toBeInTheDocument();
      expect(screen.getByText("Shared Limit Group")).toBeInTheDocument();
    });
  });

  it("shows Current Balance field for CC type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Credit Card");
    await waitFor(() => {
      expect(screen.getByText("Credit Limit")).toBeInTheDocument();
    });
    expect(screen.getByText("Current Balance")).toBeInTheDocument();
  });

  it("does not show surplus checkbox for CC type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Credit Card");
    await waitFor(() => {
      expect(screen.getByText("Credit Limit")).toBeInTheDocument();
    });
    expect(screen.queryByText("Use in surplus calculation")).not.toBeInTheDocument();
  });

  it("renders shared limit group input with datalist", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Credit Card");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type group name or leave empty")).toBeInTheDocument();
    });
  });

  it("can type billing due day after selecting CC type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Credit Card");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. 15")).toBeInTheDocument();
    });
    const dueDayInput = screen.getByPlaceholderText("e.g. 15");
    await user.type(dueDayInput, "20");
    expect(dueDayInput).toHaveValue(20);
  });
});

describe("AccountCreateFormFields - Loan auto-calculation", () => {
  it("auto-calculates EMI when principal and tenure are set", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. 2000000")).toBeInTheDocument();
    });
    const principalInput = screen.getByPlaceholderText("e.g. 2000000");
    await user.type(principalInput, "1000000");
    const rateInput = screen.getByPlaceholderText("e.g. 10.5");
    await user.type(rateInput, "10");
    const tenureInput = screen.getByPlaceholderText("e.g. 36");
    await user.type(tenureInput, "12");
    await waitFor(() => {
      expect(screen.getByText("Auto-Calculated")).toBeInTheDocument();
    });
    expect(screen.getByText("Monthly EMI")).toBeInTheDocument();
  });

  it("auto-calculates outstanding when startDate and emiDay are also set", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FormWrapper />);
    await selectType(user, "Loan");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. 2000000")).toBeInTheDocument();
    });
    const principalInput = screen.getByPlaceholderText("e.g. 2000000");
    await user.type(principalInput, "500000");
    const rateInput = screen.getByPlaceholderText("e.g. 10.5");
    await user.type(rateInput, "8");
    const tenureInput = screen.getByPlaceholderText("e.g. 36");
    await user.type(tenureInput, "24");
    const emiDayInput = screen.getByPlaceholderText("e.g. 5");
    await user.type(emiDayInput, "10");
    await waitFor(() => {
      expect(screen.getByText("Auto-Calculated")).toBeInTheDocument();
    });
    expect(screen.getByText("EMIs Paid")).toBeInTheDocument();
  });
});
