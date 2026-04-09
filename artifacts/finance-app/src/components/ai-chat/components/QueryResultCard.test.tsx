import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryResultCard } from "./QueryResultCard";
import type { ChatMessage } from "../types";

function makeMsgWithQuery(overrides: Partial<ChatMessage["queryData"]> = {}): ChatMessage {
  return {
    id: "qr1",
    type: "query_result",
    content: "Here are your results",
    timestamp: Date.now(),
    queryData: {
      queryType: "spend",
      title: "Monthly Spending",
      total: "₹25,000",
      items: [
        { label: "Food", value: "₹15,000" },
        { label: "Transport", value: "₹10,000", sublabel: "Uber rides" },
      ],
      summary: "You spent most on food this month.",
      ...overrides,
    },
  };
}

describe("QueryResultCard", () => {
  it("renders nothing when queryData is absent", () => {
    const msg: ChatMessage = { id: "q1", type: "query_result", content: "test", timestamp: Date.now() };
    const { container } = render(<QueryResultCard msg={msg} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the title", () => {
    render(<QueryResultCard msg={makeMsgWithQuery()} />);
    expect(screen.getByText("Monthly Spending")).toBeInTheDocument();
  });

  it("renders the total", () => {
    render(<QueryResultCard msg={makeMsgWithQuery()} />);
    expect(screen.getByText("₹25,000")).toBeInTheDocument();
  });

  it("renders items with labels and values", () => {
    render(<QueryResultCard msg={makeMsgWithQuery()} />);
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("₹15,000")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
  });

  it("renders sublabels when present", () => {
    render(<QueryResultCard msg={makeMsgWithQuery()} />);
    expect(screen.getByText("Uber rides")).toBeInTheDocument();
  });

  it("renders the summary", () => {
    render(<QueryResultCard msg={makeMsgWithQuery()} />);
    expect(screen.getByText("You spent most on food this month.")).toBeInTheDocument();
  });

  it("handles empty items array", () => {
    render(<QueryResultCard msg={makeMsgWithQuery({ items: [] })} />);
    expect(screen.getByText("Monthly Spending")).toBeInTheDocument();
  });
});
