import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TypingIndicator } from "./TypingIndicator";

describe("TypingIndicator", () => {
  it("renders three typing dots", () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll(".ai-typing-dot");
    expect(dots.length).toBe(3);
  });

  it("renders within the correct wrapper", () => {
    const { container } = render(<TypingIndicator />);
    expect(container.querySelector(".ai-message-enter")).toBeInTheDocument();
  });
});
