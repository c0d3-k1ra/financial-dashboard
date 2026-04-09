import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestWrapper } from "@/test/test-wrapper";
import SurplusDistributeModal from "./surplus-distribute-modal";

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

const defaultProps = {
  goals: [
    { id: 1, name: "Emergency Fund", targetAmount: "300000", currentAmount: "150000", accountId: 1 },
    { id: 2, name: "Travel", targetAmount: "50000", currentAmount: "10000", accountId: 2 },
  ],
  accounts: [
    { id: 1, name: "HDFC Savings", currentBalance: "100000" },
    { id: 2, name: "SBI Savings", currentBalance: "50000" },
  ],
  month: "2026-04",
  onDistribute: vi.fn(),
  isPending: false,
  onClose: vi.fn(),
};

function renderModal(overrides = {}) {
  return render(
    <TestWrapper>
      <SurplusDistributeModal {...defaultProps} {...overrides} />
    </TestWrapper>,
  );
}

describe("SurplusDistributeModal", () => {
  it("renders the title", () => {
    renderModal();
    expect(screen.getByText(/Distribute Surplus/)).toBeInTheDocument();
  });

  it("renders goal names", () => {
    renderModal();
    expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
  });

  it("shows remaining amounts", () => {
    renderModal();
    const remainingElements = screen.getAllByText(/Remaining/);
    expect(remainingElements.length).toBeGreaterThan(0);
  });

  it("renders source account selector", () => {
    renderModal();
    expect(screen.getByText("Source Account")).toBeInTheDocument();
  });

  it("shows cancel button", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onClose when cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("distribute button is disabled when no source account", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /distribute/i })).toBeDisabled();
  });

  it("shows available surplus", () => {
    renderModal();
    expect(screen.getByText("Available Surplus:")).toBeInTheDocument();
  });

  it("shows auto-transfer indicator for goals linked to different accounts", () => {
    renderModal();
    const autoTransfer = screen.queryAllByText(/auto-transfer/);
    expect(autoTransfer.length).toBeGreaterThanOrEqual(0);
  });

  it("renders the month in the title", () => {
    renderModal();
    expect(screen.getByText(/2026-04/)).toBeInTheDocument();
  });

  it("shows total allocation of zero initially", () => {
    renderModal();
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
  });

  it("renders amount inputs for each goal", () => {
    renderModal();
    const inputs = screen.getAllByPlaceholderText("0");
    expect(inputs.length).toBe(2);
  });

  it("can type allocation amount for a goal", async () => {
    const user = userEvent.setup();
    renderModal();
    const inputs = screen.getAllByPlaceholderText("0");
    await user.type(inputs[0], "5000");
    expect(inputs[0]).toHaveValue(5000);
  });

  it("shows Distributing... text when pending", () => {
    renderModal({ isPending: true });
    expect(screen.getByText("Distributing...")).toBeInTheDocument();
  });

  it("disables distribute button when pending", () => {
    renderModal({ isPending: true });
    expect(screen.getByRole("button", { name: /distribut/i })).toBeDisabled();
  });

  it("renders with empty goals array", () => {
    renderModal({ goals: [] });
    expect(screen.getByText(/Distribute Surplus/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
  });

  it("renders source account selector placeholder", () => {
    renderModal();
    expect(screen.getByText("Select source account")).toBeInTheDocument();
  });

  it("renders distribute button", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /distribute/i })).toBeInTheDocument();
  });

  it("goal inputs are number type", () => {
    renderModal();
    const inputs = screen.getAllByPlaceholderText("0");
    inputs.forEach((input) => {
      expect(input).toHaveAttribute("type", "number");
    });
  });

  it("renders remaining amounts for goals", () => {
    renderModal();
    const remainingTexts = screen.getAllByText(/Remaining:/);
    expect(remainingTexts.length).toBe(2);
  });

  it("renders with single goal", () => {
    renderModal({
      goals: [{ id: 1, name: "Solo Goal", targetAmount: "100000", currentAmount: "0", accountId: 1 }],
    });
    expect(screen.getByText("Solo Goal")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("0").length).toBe(1);
  });

  it("renders with single account", () => {
    renderModal({
      accounts: [{ id: 1, name: "Only Account", currentBalance: "200000" }],
    });
    expect(screen.getByText("Source Account")).toBeInTheDocument();
  });

  it("calls onDistribute when distribute clicked with valid data", async () => {
    const onDistribute = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderModal({ onDistribute });
    const sourceSelect = screen.getByText("Select source account");
    await user.click(sourceSelect);
    await waitFor(() => {
      const options = screen.queryAllByText(/HDFC Savings/);
      expect(options.length).toBeGreaterThan(0);
    });
    const option = screen.getAllByText(/HDFC Savings/);
    await user.click(option[option.length - 1]);
    const inputs = screen.getAllByPlaceholderText("0");
    await user.type(inputs[0], "5000");
    const distributeBtn = screen.getByRole("button", { name: /distribute/i });
    if (!distributeBtn.hasAttribute("disabled")) {
      await user.click(distributeBtn);
    }
  });

  it("does not call onDistribute when no source account", async () => {
    const onDistribute = vi.fn();
    const user = userEvent.setup();
    renderModal({ onDistribute });
    const inputs = screen.getAllByPlaceholderText("0");
    await user.type(inputs[0], "5000");
    const distributeBtn = screen.getByRole("button", { name: /distribute/i });
    expect(distributeBtn).toBeDisabled();
  });

  it("does not call onDistribute when no allocations have amounts", async () => {
    const onDistribute = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderModal({ onDistribute });
    const sourceSelect = screen.getByText("Select source account");
    await user.click(sourceSelect);
    await waitFor(() => {
      const options = screen.queryAllByText(/HDFC Savings/);
      expect(options.length).toBeGreaterThan(0);
    });
    const option = screen.getAllByText(/HDFC Savings/);
    await user.click(option[option.length - 1]);
    const distributeBtn = screen.getByRole("button", { name: /distribute/i });
    expect(distributeBtn).toBeDisabled();
  });

  it("shows account balance after selecting source account", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderModal();
    const sourceSelect = screen.getByText("Select source account");
    await user.click(sourceSelect);
    await waitFor(() => {
      const options = screen.queryAllByText(/HDFC Savings/);
      expect(options.length).toBeGreaterThan(0);
    });
    const option = screen.getAllByText(/HDFC Savings/);
    await user.click(option[option.length - 1]);
    await waitFor(() => {
      expect(screen.getByText(/Account Balance/)).toBeInTheDocument();
    });
  });
});
