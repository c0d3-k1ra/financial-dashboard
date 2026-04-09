import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WarningsList } from "./WarningsList";

describe("WarningsList", () => {
  it("renders anomaly warning", () => {
    render(
      <WarningsList
        warnings={[
          {
            type: "anomaly",
            anomalyType: "merchant",
            ratio: 3,
            averageAmount: 150,
            typicalAmount: 150,
          },
        ]}
      />,
    );
    expect(screen.getByText("Unusual Amount")).toBeInTheDocument();
    expect(screen.getByText(/3x your typical spend/)).toBeInTheDocument();
  });

  it("renders category anomaly warning", () => {
    render(
      <WarningsList
        warnings={[
          {
            type: "anomaly",
            anomalyType: "category",
            ratio: 2.5,
            averageAmount: 200,
          },
        ]}
      />,
    );
    expect(screen.getByText(/2.5x the average for this category/)).toBeInTheDocument();
  });

  it("renders budget exceeded warning", () => {
    render(
      <WarningsList
        warnings={[
          {
            type: "budget",
            categoryName: "Food",
            isOverBudget: true,
            spentSoFar: 15000,
            afterTransaction: 16000,
            budgetAmount: 15000,
          },
        ]}
      />,
    );
    expect(screen.getByText("Budget Exceeded")).toBeInTheDocument();
    expect(screen.getByText(/Food budget already exceeded/)).toBeInTheDocument();
  });

  it("renders budget warning (not yet exceeded)", () => {
    render(
      <WarningsList
        warnings={[
          {
            type: "budget",
            categoryName: "Food",
            isOverBudget: false,
            spentSoFar: 12000,
            afterTransaction: 14000,
            budgetAmount: 15000,
          },
        ]}
      />,
    );
    expect(screen.getByText("Budget Warning")).toBeInTheDocument();
    expect(screen.getByText(/This will push Food to/)).toBeInTheDocument();
  });

  it("renders duplicate warning", () => {
    render(
      <WarningsList
        warnings={[
          {
            type: "duplicate",
            existingAmount: "450",
            existingDescription: "Starbucks",
            existingDate: "2026-04-05",
          },
        ]}
      />,
    );
    expect(screen.getByText("Possible Duplicate")).toBeInTheDocument();
    expect(screen.getByText(/Starbucks/)).toBeInTheDocument();
  });

  it("renders typical amount for merchant anomalies", () => {
    render(
      <WarningsList
        warnings={[
          {
            type: "anomaly",
            anomalyType: "merchant",
            ratio: 3,
            averageAmount: 150,
            typicalAmount: 150,
          },
        ]}
      />,
    );
    expect(screen.getByText(/You usually spend around/)).toBeInTheDocument();
  });
});
