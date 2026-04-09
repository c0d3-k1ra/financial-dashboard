import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrivacyProvider, usePrivacy } from "./privacy-context";

function TestConsumer() {
  const { isHidden, toggleVisibility } = usePrivacy();
  return (
    <div>
      <span data-testid="status">{isHidden ? "hidden" : "visible"}</span>
      <button onClick={toggleVisibility}>Toggle</button>
    </div>
  );
}

describe("PrivacyContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to hidden", () => {
    render(
      <PrivacyProvider>
        <TestConsumer />
      </PrivacyProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("hidden");
  });

  it("toggles visibility", async () => {
    const user = userEvent.setup();
    render(
      <PrivacyProvider>
        <TestConsumer />
      </PrivacyProvider>,
    );
    await user.click(screen.getByText("Toggle"));
    expect(screen.getByTestId("status")).toHaveTextContent("visible");
  });

  it("persists to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <PrivacyProvider>
        <TestConsumer />
      </PrivacyProvider>,
    );
    await user.click(screen.getByText("Toggle"));
    expect(localStorage.getItem("surplusengine-privacy-shield")).toBe("false");
  });

  it("reads from localStorage on init", () => {
    localStorage.setItem("surplusengine-privacy-shield", "false");
    render(
      <PrivacyProvider>
        <TestConsumer />
      </PrivacyProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("visible");
  });
});
