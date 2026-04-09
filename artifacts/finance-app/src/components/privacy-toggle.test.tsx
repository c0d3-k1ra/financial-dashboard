import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrivacyToggle } from "./privacy-toggle";

const mockToggleVisibility = vi.fn();
let mockIsHidden = false;

vi.mock("@/lib/privacy-context", () => ({
  usePrivacy: () => ({
    isHidden: mockIsHidden,
    toggleVisibility: mockToggleVisibility,
  }),
}));

describe("PrivacyToggle", () => {
  it("renders show state when not hidden", () => {
    mockIsHidden = false;
    render(<PrivacyToggle />);
    const btn = screen.getByTestId("privacy-toggle");
    expect(btn).toHaveAttribute("aria-label", "Hide sensitive values");
    expect(btn).toHaveAttribute("title", "Hide values");
  });

  it("renders hide state when hidden", () => {
    mockIsHidden = true;
    render(<PrivacyToggle />);
    const btn = screen.getByTestId("privacy-toggle");
    expect(btn).toHaveAttribute("aria-label", "Show sensitive values");
    expect(btn).toHaveAttribute("title", "Show values");
  });

  it("calls toggleVisibility when clicked", async () => {
    mockIsHidden = false;
    const user = userEvent.setup();
    render(<PrivacyToggle />);
    await user.click(screen.getByTestId("privacy-toggle"));
    expect(mockToggleVisibility).toHaveBeenCalled();
  });

  it("applies custom className", () => {
    mockIsHidden = false;
    render(<PrivacyToggle className="custom-class" />);
    const btn = screen.getByTestId("privacy-toggle");
    expect(btn.className).toContain("custom-class");
  });
});
