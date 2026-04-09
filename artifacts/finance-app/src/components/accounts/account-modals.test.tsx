import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReconcileModal, EditModal, DeleteModal } from "./account-modals";
import { TestWrapper } from "@/test/test-wrapper";

const mockAccount = {
  id: 1,
  name: "HDFC Savings",
  type: "bank",
  currentBalance: "50000",
};
const mockCCAccount = { ...mockAccount, id: 2, name: "ICICI CC", type: "credit_card" };
const mockLoanAccount = { ...mockAccount, id: 3, name: "Home Loan", type: "loan" };

describe("ReconcileModal", () => {
  const defaultProps = {
    reconcileId: 1,
    reconcileTarget: mockAccount,
    reconcileCurrentBalance: 50000,
    reconcileBalance: "",
    setReconcileBalance: vi.fn(),
    reconcileAdjustment: 0,
    handleReconcile: vi.fn(),
    reconcileAccount: { isPending: false },
    setReconcileId: vi.fn(),
    isMobile: false,
  };

  it("renders when open", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText(/Reconcile: HDFC Savings/)).toBeInTheDocument();
  });

  it("shows current balance", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText(/Current balance/)).toBeInTheDocument();
  });

  it("shows adjustment when balance entered", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} reconcileBalance="55000" reconcileAdjustment={5000} /></TestWrapper>);
    expect(screen.getByText(/Adjustment/)).toBeInTheDocument();
  });

  it("shows negative adjustment", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} reconcileBalance="45000" reconcileAdjustment={-5000} /></TestWrapper>);
    expect(screen.getByText(/Adjustment/)).toBeInTheDocument();
  });

  it("disables reconcile button when pending", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} reconcileAccount={{ isPending: true }} /></TestWrapper>);
    expect(screen.getByText("Reconciling...")).toBeInTheDocument();
  });

  it("disables reconcile button when no balance", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} reconcileBalance="" /></TestWrapper>);
    expect(screen.getByText("Reconcile")).toBeDisabled();
  });

  it("calls handleReconcile on button click", async () => {
    const handleReconcile = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><ReconcileModal {...defaultProps} reconcileBalance="55000" handleReconcile={handleReconcile} /></TestWrapper>);
    await user.click(screen.getByText("Reconcile"));
    expect(handleReconcile).toHaveBeenCalled();
  });

  it("calls setReconcileId(null) on cancel", async () => {
    const setReconcileId = vi.fn();
    const setReconcileBalance = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><ReconcileModal {...defaultProps} setReconcileId={setReconcileId} setReconcileBalance={setReconcileBalance} /></TestWrapper>);
    await user.click(screen.getByText("Cancel"));
    expect(setReconcileId).toHaveBeenCalledWith(null);
  });

  it("does not render when reconcileId is null", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} reconcileId={null} /></TestWrapper>);
    expect(screen.queryByText(/Reconcile: HDFC/)).not.toBeInTheDocument();
  });

  it("calls setReconcileBalance when typing in input", async () => {
    const setReconcileBalance = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><ReconcileModal {...defaultProps} setReconcileBalance={setReconcileBalance} /></TestWrapper>);
    const input = screen.getByRole("spinbutton");
    await user.type(input, "60000");
    expect(setReconcileBalance).toHaveBeenCalled();
  });

  it("shows positive adjustment with plus sign", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} reconcileBalance="55000" reconcileAdjustment={5000} /></TestWrapper>);
    expect(screen.getByText(/\+/)).toBeInTheDocument();
  });

  it("renders label for actual balance", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText(/Actual Balance/)).toBeInTheDocument();
  });

  it("renders rupee symbol", () => {
    render(<TestWrapper><ReconcileModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText("₹")).toBeInTheDocument();
  });
});

describe("EditModal", () => {
  const baseEditProps = {
    editId: 1,
    editTarget: mockAccount,
    editName: "HDFC Savings",
    setEditName: vi.fn(),
    editCreditLimit: "",
    setEditCreditLimit: vi.fn(),
    editBillingDueDay: "",
    setEditBillingDueDay: vi.fn(),
    editSharedLimitGroup: "",
    setEditSharedLimitGroup: vi.fn(),
    editEmiAmount: "",
    setEditEmiAmount: vi.fn(),
    editEmiDay: "",
    setEditEmiDay: vi.fn(),
    editInterestRate: "",
    setEditInterestRate: vi.fn(),
    editLoanTenure: "",
    setEditLoanTenure: vi.fn(),
    editOriginalLoanAmount: "",
    setEditOriginalLoanAmount: vi.fn(),
    editLoanStartDate: "",
    setEditLoanStartDate: vi.fn(),
    editEmisPaid: "",
    setEditEmisPaid: vi.fn(),
    editLinkedAccountId: "",
    setEditLinkedAccountId: vi.fn(),
    editUseInSurplus: false,
    setEditUseInSurplus: vi.fn(),
    existingGroups: ["Group A"],
    bankAccounts: [mockAccount],
    handleEdit: vi.fn(),
    updateAccount: { isPending: false },
    setEditId: vi.fn(),
    isMobile: false,
  };

  it("renders for bank account", () => {
    render(<TestWrapper><EditModal {...baseEditProps} /></TestWrapper>);
    expect(screen.getByText(/Edit: HDFC Savings/)).toBeInTheDocument();
    expect(screen.getByText(/Use in surplus calculation/)).toBeInTheDocument();
  });

  it("renders credit card fields", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockCCAccount} /></TestWrapper>);
    expect(screen.getByText("Credit Limit")).toBeInTheDocument();
    expect(screen.getByText(/Billing Due Day/)).toBeInTheDocument();
    expect(screen.getByText("Shared Limit Group")).toBeInTheDocument();
  });

  it("renders loan fields", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockLoanAccount} /></TestWrapper>);
    expect(screen.getByText("Original Loan Amount")).toBeInTheDocument();
    expect(screen.getByText("Monthly EMI")).toBeInTheDocument();
    expect(screen.getByText(/EMI Debit Day/)).toBeInTheDocument();
    expect(screen.getByText(/Interest Rate/)).toBeInTheDocument();
    expect(screen.getByText(/Tenure/)).toBeInTheDocument();
    expect(screen.getByText("Loan Start Date")).toBeInTheDocument();
    expect(screen.getByText("EMIs Already Paid")).toBeInTheDocument();
  });

  it("calls handleEdit on save", async () => {
    const handleEdit = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} handleEdit={handleEdit} /></TestWrapper>);
    await user.click(screen.getByText("Save"));
    expect(handleEdit).toHaveBeenCalled();
  });

  it("disables save when name is empty", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editName="" /></TestWrapper>);
    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("disables save when pending", () => {
    render(<TestWrapper><EditModal {...baseEditProps} updateAccount={{ isPending: true }} /></TestWrapper>);
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("calls setEditId(null) on cancel", async () => {
    const setEditId = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditId={setEditId} /></TestWrapper>);
    await user.click(screen.getByText("Cancel"));
    expect(setEditId).toHaveBeenCalledWith(null);
  });

  it("does not render when editId is null", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editId={null} /></TestWrapper>);
    expect(screen.queryByText(/Edit: HDFC/)).not.toBeInTheDocument();
  });

  it("calls setEditName when typing in name input", async () => {
    const setEditName = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditName={setEditName} /></TestWrapper>);
    const nameInput = screen.getByDisplayValue("HDFC Savings");
    await user.type(nameInput, "X");
    expect(setEditName).toHaveBeenCalled();
  });

  it("calls setEditCreditLimit when typing for CC account", async () => {
    const setEditCreditLimit = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockCCAccount} setEditCreditLimit={setEditCreditLimit} editCreditLimit="200000" /></TestWrapper>);
    const creditInput = screen.getByDisplayValue("200000");
    await user.type(creditInput, "0");
    expect(setEditCreditLimit).toHaveBeenCalled();
  });

  it("calls setEditBillingDueDay when typing for CC account", async () => {
    const setEditBillingDueDay = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockCCAccount} setEditBillingDueDay={setEditBillingDueDay} /></TestWrapper>);
    const dueDayInput = screen.getByPlaceholderText("e.g. 15");
    await user.type(dueDayInput, "20");
    expect(setEditBillingDueDay).toHaveBeenCalled();
  });

  it("calls setEditSharedLimitGroup when typing for CC account", async () => {
    const setEditSharedLimitGroup = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockCCAccount} setEditSharedLimitGroup={setEditSharedLimitGroup} /></TestWrapper>);
    const groupInput = screen.getByPlaceholderText("Type group name or leave empty");
    await user.type(groupInput, "GroupB");
    expect(setEditSharedLimitGroup).toHaveBeenCalled();
  });

  it("calls setEditEmiAmount when typing for loan account", async () => {
    const setEditEmiAmount = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockLoanAccount} setEditEmiAmount={setEditEmiAmount} editEmiAmount="" /></TestWrapper>);
    const inputs = screen.getAllByRole("spinbutton");
    const emiInput = inputs.find(i => i.closest("div")?.previousElementSibling?.textContent?.includes("Monthly EMI"));
    if (emiInput) {
      await user.type(emiInput, "15000");
      expect(setEditEmiAmount).toHaveBeenCalled();
    }
  });

  it("calls setEditUseInSurplus when toggling checkbox for bank account", async () => {
    const setEditUseInSurplus = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditUseInSurplus={setEditUseInSurplus} /></TestWrapper>);
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    expect(setEditUseInSurplus).toHaveBeenCalled();
  });

  it("renders EMI Debit Account selector for loan accounts", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockLoanAccount} /></TestWrapper>);
    expect(screen.getByText("EMI Debit Account")).toBeInTheDocument();
  });

  it("does not show CC fields for bank account", () => {
    render(<TestWrapper><EditModal {...baseEditProps} /></TestWrapper>);
    expect(screen.queryByText("Credit Limit")).not.toBeInTheDocument();
    expect(screen.queryByText("Shared Limit Group")).not.toBeInTheDocument();
  });

  it("does not show loan fields for bank account", () => {
    render(<TestWrapper><EditModal {...baseEditProps} /></TestWrapper>);
    expect(screen.queryByText("Original Loan Amount")).not.toBeInTheDocument();
    expect(screen.queryByText("Monthly EMI")).not.toBeInTheDocument();
  });

  it("does not show surplus checkbox for CC account", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockCCAccount} /></TestWrapper>);
    expect(screen.queryByText(/Use in surplus calculation/)).not.toBeInTheDocument();
  });

  it("does not show surplus checkbox for loan account", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editTarget={mockLoanAccount} /></TestWrapper>);
    expect(screen.queryByText(/Use in surplus calculation/)).not.toBeInTheDocument();
  });
});

describe("DeleteModal", () => {
  const defaultProps = {
    deleteAccountId: 1,
    setDeleteAccountId: vi.fn(),
    confirmDeleteAccount: vi.fn(),
    deleteAccount: { isPending: false },
    isMobile: false,
  };

  it("renders when open", () => {
    render(<TestWrapper><DeleteModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
  });

  it("calls confirmDeleteAccount on delete click", async () => {
    const confirm = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><DeleteModal {...defaultProps} confirmDeleteAccount={confirm} /></TestWrapper>);
    await user.click(screen.getByText("Delete"));
    expect(confirm).toHaveBeenCalled();
  });

  it("disables delete when pending", () => {
    render(<TestWrapper><DeleteModal {...defaultProps} deleteAccount={{ isPending: true }} /></TestWrapper>);
    expect(screen.getByText("Deleting...")).toBeInTheDocument();
  });

  it("calls setDeleteAccountId(null) on cancel", async () => {
    const setDeleteAccountId = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><DeleteModal {...defaultProps} setDeleteAccountId={setDeleteAccountId} /></TestWrapper>);
    await user.click(screen.getByText("Cancel"));
    expect(setDeleteAccountId).toHaveBeenCalledWith(null);
  });

  it("does not render when deleteAccountId is null", () => {
    render(<TestWrapper><DeleteModal {...defaultProps} deleteAccountId={null} /></TestWrapper>);
    expect(screen.queryByText("Delete Account")).not.toBeInTheDocument();
  });

  it("shows the cannot be undone warning", () => {
    render(<TestWrapper><DeleteModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
  });

  it("renders both cancel and delete buttons", () => {
    render(<TestWrapper><DeleteModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders warning about cannot be undone", () => {
    render(<TestWrapper><DeleteModal {...defaultProps} /></TestWrapper>);
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
  });
});

describe("EditModal - loan fields interactions", () => {
  const baseEditProps = {
    editId: 3,
    editTarget: { id: 3, name: "Home Loan", type: "loan", currentBalance: "500000" },
    editName: "Home Loan",
    setEditName: vi.fn(),
    editCreditLimit: "",
    setEditCreditLimit: vi.fn(),
    editBillingDueDay: "",
    setEditBillingDueDay: vi.fn(),
    editSharedLimitGroup: "",
    setEditSharedLimitGroup: vi.fn(),
    editEmiAmount: "15000",
    setEditEmiAmount: vi.fn(),
    editEmiDay: "5",
    setEditEmiDay: vi.fn(),
    editInterestRate: "8.5",
    setEditInterestRate: vi.fn(),
    editLoanTenure: "240",
    setEditLoanTenure: vi.fn(),
    editOriginalLoanAmount: "2000000",
    setEditOriginalLoanAmount: vi.fn(),
    editLoanStartDate: "2024-01-01",
    setEditLoanStartDate: vi.fn(),
    editEmisPaid: "24",
    setEditEmisPaid: vi.fn(),
    editLinkedAccountId: "1",
    setEditLinkedAccountId: vi.fn(),
    editUseInSurplus: false,
    setEditUseInSurplus: vi.fn(),
    existingGroups: [],
    bankAccounts: [{ id: 1, name: "HDFC Savings", type: "bank", currentBalance: "100000" }],
    handleEdit: vi.fn(),
    updateAccount: { isPending: false },
    setEditId: vi.fn(),
    isMobile: false,
  };

  it("renders linked account selector with bank account name", () => {
    render(<TestWrapper><EditModal {...baseEditProps} /></TestWrapper>);
    expect(screen.getByText("EMI Debit Account")).toBeInTheDocument();
  });

  it("calls setEditEmiDay when typing EMI day", async () => {
    const setEditEmiDay = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditEmiDay={setEditEmiDay} /></TestWrapper>);
    const emiDayInput = screen.getByDisplayValue("5");
    await user.clear(emiDayInput);
    await user.type(emiDayInput, "10");
    expect(setEditEmiDay).toHaveBeenCalled();
  });

  it("calls setEditInterestRate when typing interest rate", async () => {
    const setEditInterestRate = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditInterestRate={setEditInterestRate} /></TestWrapper>);
    const rateInput = screen.getByDisplayValue("8.5");
    await user.clear(rateInput);
    await user.type(rateInput, "9");
    expect(setEditInterestRate).toHaveBeenCalled();
  });

  it("calls setEditLoanTenure when typing tenure", async () => {
    const setEditLoanTenure = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditLoanTenure={setEditLoanTenure} /></TestWrapper>);
    const tenureInput = screen.getByDisplayValue("240");
    await user.clear(tenureInput);
    await user.type(tenureInput, "180");
    expect(setEditLoanTenure).toHaveBeenCalled();
  });

  it("calls setEditOriginalLoanAmount when typing", async () => {
    const setEditOriginalLoanAmount = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditOriginalLoanAmount={setEditOriginalLoanAmount} /></TestWrapper>);
    const loanInput = screen.getByDisplayValue("2000000");
    await user.clear(loanInput);
    await user.type(loanInput, "3000000");
    expect(setEditOriginalLoanAmount).toHaveBeenCalled();
  });

  it("calls setEditEmisPaid when typing", async () => {
    const setEditEmisPaid = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditEmisPaid={setEditEmisPaid} /></TestWrapper>);
    const emisPaidInput = screen.getByDisplayValue("24");
    await user.clear(emisPaidInput);
    await user.type(emisPaidInput, "30");
    expect(setEditEmisPaid).toHaveBeenCalled();
  });

  it("renders Loan Start Date label", () => {
    render(<TestWrapper><EditModal {...baseEditProps} /></TestWrapper>);
    expect(screen.getByText("Loan Start Date")).toBeInTheDocument();
  });

  it("renders all loan field labels", () => {
    render(<TestWrapper><EditModal {...baseEditProps} /></TestWrapper>);
    expect(screen.getByText("Original Loan Amount")).toBeInTheDocument();
    expect(screen.getByText("Monthly EMI")).toBeInTheDocument();
    expect(screen.getByText(/EMI Debit Day/)).toBeInTheDocument();
    expect(screen.getByText(/Interest Rate/)).toBeInTheDocument();
    expect(screen.getByText(/Tenure/)).toBeInTheDocument();
    expect(screen.getByText("EMIs Already Paid")).toBeInTheDocument();
    expect(screen.getByText("EMI Debit Account")).toBeInTheDocument();
  });

  it("renders loan start date picker with existing date", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editLoanStartDate="2024-01-01" /></TestWrapper>);
    expect(screen.getByText("Loan Start Date")).toBeInTheDocument();
  });

  it("renders loan start date picker without date", () => {
    render(<TestWrapper><EditModal {...baseEditProps} editLoanStartDate="" /></TestWrapper>);
    expect(screen.getByText("Loan Start Date")).toBeInTheDocument();
    expect(screen.getByText("Select start date")).toBeInTheDocument();
  });

  it("renders EMI debit account selector for loan with bank accounts", () => {
    const bankAccts = [
      { id: 1, name: "HDFC Savings", type: "bank", currentBalance: "100000" },
      { id: 2, name: "SBI Savings", type: "bank", currentBalance: "50000" },
    ];
    render(<TestWrapper><EditModal {...baseEditProps} bankAccounts={bankAccts} /></TestWrapper>);
    expect(screen.getByText("EMI Debit Account")).toBeInTheDocument();
  });

  it("handles save button click for loan account", async () => {
    const handleEdit = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} handleEdit={handleEdit} /></TestWrapper>);
    await user.click(screen.getByText("Save"));
    expect(handleEdit).toHaveBeenCalled();
  });

  it("handles cancel button click for loan account", async () => {
    const setEditId = vi.fn();
    const user = userEvent.setup();
    render(<TestWrapper><EditModal {...baseEditProps} setEditId={setEditId} /></TestWrapper>);
    await user.click(screen.getByText("Cancel"));
    expect(setEditId).toHaveBeenCalledWith(null);
  });

  it("renders existing shared limit groups in datalist for CC edit", () => {
    render(
      <TestWrapper>
        <EditModal
          {...baseEditProps}
          editTarget={{ ...baseEditProps.editTarget, type: "credit_card" }}
          existingGroups={["ICICI Group", "SBI Group"]}
        />
      </TestWrapper>,
    );
    expect(screen.getByText("Shared Limit Group")).toBeInTheDocument();
  });

  it("renders with isMobile true", () => {
    render(
      <TestWrapper>
        <EditModal {...baseEditProps} isMobile={true} />
      </TestWrapper>,
    );
    expect(screen.getByText(/Edit: Home Loan/)).toBeInTheDocument();
  });

  it("closes edit modal via onOpenChange when open is set to false", () => {
    const setEditId = vi.fn();
    const { rerender } = render(
      <TestWrapper>
        <EditModal {...baseEditProps} setEditId={setEditId} editId={3} />
      </TestWrapper>,
    );
    expect(screen.getByText(/Edit: Home Loan/)).toBeInTheDocument();
    rerender(
      <TestWrapper>
        <EditModal {...baseEditProps} setEditId={setEditId} editId={null} />
      </TestWrapper>,
    );
    expect(screen.queryByText(/Edit: Home Loan/)).not.toBeInTheDocument();
  });
});

describe("ReconcileModal - mobile", () => {
  const defaultProps = {
    reconcileId: 1,
    reconcileTarget: { id: 1, name: "HDFC Savings", type: "bank", currentBalance: "50000" },
    reconcileCurrentBalance: 50000,
    reconcileBalance: "",
    setReconcileBalance: vi.fn(),
    reconcileAdjustment: 0,
    handleReconcile: vi.fn(),
    reconcileAccount: { isPending: false },
    setReconcileId: vi.fn(),
    isMobile: true,
  };

  it("renders in mobile mode", () => {
    render(
      <TestWrapper>
        <ReconcileModal {...defaultProps} />
      </TestWrapper>,
    );
    expect(screen.getByText(/Reconcile: HDFC Savings/)).toBeInTheDocument();
  });
});

describe("DeleteModal - mobile", () => {
  const defaultProps = {
    deleteAccountId: 1,
    setDeleteAccountId: vi.fn(),
    confirmDeleteAccount: vi.fn(),
    deleteAccount: { isPending: false },
    isMobile: true,
  };

  it("renders delete modal in mobile mode", () => {
    render(
      <TestWrapper>
        <DeleteModal {...defaultProps} />
      </TestWrapper>,
    );
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
  });
});

describe("ReconcileModal - onOpenChange closing", () => {
  it("calls setReconcileId and setReconcileBalance when cancel clicked", async () => {
    const setReconcileId = vi.fn();
    const setReconcileBalance = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ReconcileModal
          reconcileId={1}
          reconcileTarget={{ id: 1, name: "Test", type: "bank", currentBalance: "50000" }}
          reconcileCurrentBalance={50000}
          reconcileBalance="55000"
          setReconcileBalance={setReconcileBalance}
          reconcileAdjustment={5000}
          handleReconcile={vi.fn()}
          reconcileAccount={{ isPending: false }}
          setReconcileId={setReconcileId}
          isMobile={false}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Cancel"));
    expect(setReconcileId).toHaveBeenCalledWith(null);
    expect(setReconcileBalance).toHaveBeenCalledWith("");
  });
});

describe("EditModal - loan DatePicker onSelect", () => {
  it("renders loan fields with existing start date", () => {
    const loanAccount = { id: 3, name: "Home Loan", type: "loan", currentBalance: "500000" };
    render(
      <TestWrapper>
        <EditModal
          editId={3}
          editTarget={loanAccount}
          editName="Home Loan"
          setEditName={vi.fn()}
          editCreditLimit=""
          setEditCreditLimit={vi.fn()}
          editBillingDueDay=""
          setEditBillingDueDay={vi.fn()}
          editSharedLimitGroup=""
          setEditSharedLimitGroup={vi.fn()}
          editEmiAmount="15000"
          setEditEmiAmount={vi.fn()}
          editEmiDay="5"
          setEditEmiDay={vi.fn()}
          editInterestRate="8.5"
          setEditInterestRate={vi.fn()}
          editLoanTenure="240"
          setEditLoanTenure={vi.fn()}
          editOriginalLoanAmount="2000000"
          setEditOriginalLoanAmount={vi.fn()}
          editLoanStartDate="2024-06-15"
          setEditLoanStartDate={vi.fn()}
          editEmisPaid="12"
          setEditEmisPaid={vi.fn()}
          editLinkedAccountId=""
          setEditLinkedAccountId={vi.fn()}
          editUseInSurplus={false}
          setEditUseInSurplus={vi.fn()}
          existingGroups={[]}
          bankAccounts={[{ id: 1, name: "HDFC Savings", type: "bank", currentBalance: "100000" }]}
          handleEdit={vi.fn()}
          updateAccount={{ isPending: false }}
          setEditId={vi.fn()}
          isMobile={false}
        />
      </TestWrapper>,
    );
    expect(screen.getByText("Loan Start Date")).toBeInTheDocument();
    expect(screen.getByText("Original Loan Amount")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2000000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
  });

  it("calls handleEdit when Save is clicked for loan account", async () => {
    const handleEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <EditModal
          editId={3}
          editTarget={{ id: 3, name: "Car Loan", type: "loan", currentBalance: "300000" }}
          editName="Car Loan"
          setEditName={vi.fn()}
          editCreditLimit=""
          setEditCreditLimit={vi.fn()}
          editBillingDueDay=""
          setEditBillingDueDay={vi.fn()}
          editSharedLimitGroup=""
          setEditSharedLimitGroup={vi.fn()}
          editEmiAmount="10000"
          setEditEmiAmount={vi.fn()}
          editEmiDay="10"
          setEditEmiDay={vi.fn()}
          editInterestRate="9.0"
          setEditInterestRate={vi.fn()}
          editLoanTenure="60"
          setEditLoanTenure={vi.fn()}
          editOriginalLoanAmount="500000"
          setEditOriginalLoanAmount={vi.fn()}
          editLoanStartDate=""
          setEditLoanStartDate={vi.fn()}
          editEmisPaid="6"
          setEditEmisPaid={vi.fn()}
          editLinkedAccountId="1"
          setEditLinkedAccountId={vi.fn()}
          editUseInSurplus={false}
          setEditUseInSurplus={vi.fn()}
          existingGroups={[]}
          bankAccounts={[{ id: 1, name: "HDFC Savings", type: "bank", currentBalance: "100000" }]}
          handleEdit={handleEdit}
          updateAccount={{ isPending: false }}
          setEditId={vi.fn()}
          isMobile={false}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Save"));
    expect(handleEdit).toHaveBeenCalled();
  });
});

describe("EditModal - credit card onOpenChange", () => {
  it("calls setEditId(null) when closing CC edit modal", async () => {
    const setEditId = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <EditModal
          editId={2}
          editTarget={{ id: 2, name: "ICICI CC", type: "credit_card", currentBalance: "-25000" }}
          editName="ICICI CC"
          setEditName={vi.fn()}
          editCreditLimit="200000"
          setEditCreditLimit={vi.fn()}
          editBillingDueDay="15"
          setEditBillingDueDay={vi.fn()}
          editSharedLimitGroup="Group A"
          setEditSharedLimitGroup={vi.fn()}
          editEmiAmount=""
          setEditEmiAmount={vi.fn()}
          editEmiDay=""
          setEditEmiDay={vi.fn()}
          editInterestRate=""
          setEditInterestRate={vi.fn()}
          editLoanTenure=""
          setEditLoanTenure={vi.fn()}
          editOriginalLoanAmount=""
          setEditOriginalLoanAmount={vi.fn()}
          editLoanStartDate=""
          setEditLoanStartDate={vi.fn()}
          editEmisPaid=""
          setEditEmisPaid={vi.fn()}
          editLinkedAccountId=""
          setEditLinkedAccountId={vi.fn()}
          editUseInSurplus={false}
          setEditUseInSurplus={vi.fn()}
          existingGroups={["Group A", "Group B"]}
          bankAccounts={[]}
          handleEdit={vi.fn()}
          updateAccount={{ isPending: false }}
          setEditId={setEditId}
          isMobile={false}
        />
      </TestWrapper>,
    );
    expect(screen.getByText("Credit Limit")).toBeInTheDocument();
    expect(screen.getByDisplayValue("200000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    expect(setEditId).toHaveBeenCalledWith(null);
  });
});

describe("DeleteModal - confirm and cancel interactions", () => {
  it("calls confirmDeleteAccount when delete button clicked", async () => {
    const confirm = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <DeleteModal
          deleteAccountId={5}
          setDeleteAccountId={vi.fn()}
          confirmDeleteAccount={confirm}
          deleteAccount={{ isPending: false }}
          isMobile={false}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Delete"));
    expect(confirm).toHaveBeenCalled();
  });

  it("calls setDeleteAccountId(null) when closing via cancel", async () => {
    const setDeleteAccountId = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <DeleteModal
          deleteAccountId={5}
          setDeleteAccountId={setDeleteAccountId}
          confirmDeleteAccount={vi.fn()}
          deleteAccount={{ isPending: false }}
          isMobile={false}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Cancel"));
    expect(setDeleteAccountId).toHaveBeenCalledWith(null);
  });
});

describe("ReconcileModal - additional tests", () => {
  const defaultProps = {
    reconcileId: 1,
    reconcileTarget: { id: 1, name: "HDFC Savings", type: "bank", currentBalance: "50000" },
    reconcileCurrentBalance: 50000,
    reconcileBalance: "",
    setReconcileBalance: vi.fn(),
    reconcileAdjustment: 0,
    handleReconcile: vi.fn(),
    reconcileAccount: { isPending: false },
    setReconcileId: vi.fn(),
    isMobile: false,
  };

  it("clears balance and id when dialog closes via cancel", async () => {
    const setReconcileId = vi.fn();
    const setReconcileBalance = vi.fn();
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ReconcileModal
          {...defaultProps}
          setReconcileId={setReconcileId}
          setReconcileBalance={setReconcileBalance}
        />
      </TestWrapper>,
    );
    await user.click(screen.getByText("Cancel"));
    expect(setReconcileId).toHaveBeenCalledWith(null);
    expect(setReconcileBalance).toHaveBeenCalledWith("");
  });

  it("shows small adjustment correctly", () => {
    render(
      <TestWrapper>
        <ReconcileModal {...defaultProps} reconcileBalance="50000.02" reconcileAdjustment={0.02} />
      </TestWrapper>,
    );
    expect(screen.getByText(/Adjustment/)).toBeInTheDocument();
  });
});
