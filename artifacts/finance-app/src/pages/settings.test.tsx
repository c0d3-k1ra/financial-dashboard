import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TestWrapper } from "@/test/test-wrapper";
import Settings from "./settings";

function renderSettings() {
  return render(
    <TestWrapper>
      <Settings />
    </TestWrapper>,
  );
}

describe("Settings page", () => {
  it("renders the page heading", () => {
    renderSettings();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("displays the API health indicator showing connected", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
  });

  it("renders API Status card", () => {
    renderSettings();
    expect(screen.getByText("API Status")).toBeInTheDocument();
  });
});
