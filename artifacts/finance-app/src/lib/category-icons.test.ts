import { describe, it, expect } from "vitest";
import { getCategoryIcon } from "./category-icons";

describe("category-icons", () => {
  it("returns a component for Food", () => {
    const Icon = getCategoryIcon("Food");
    expect(Icon).toBeDefined();
  });

  it("returns a component for Transportation", () => {
    const Icon = getCategoryIcon("Transportation");
    expect(Icon).toBeDefined();
  });

  it("returns a component for Utilities", () => {
    const Icon = getCategoryIcon("Utilities");
    expect(Icon).toBeDefined();
  });

  it("returns a default icon for unknown categories", () => {
    const Icon = getCategoryIcon("SomeUnknownCategory");
    expect(Icon).toBeDefined();
  });

  it("is case-insensitive", () => {
    const icon1 = getCategoryIcon("food");
    const icon2 = getCategoryIcon("FOOD");
    expect(icon1).toBe(icon2);
  });

  it("trims whitespace", () => {
    const icon1 = getCategoryIcon("Food");
    const icon2 = getCategoryIcon("  Food  ");
    expect(icon1).toBe(icon2);
  });

  it("returns icons for all common categories", () => {
    const categories = ["Food", "Transportation", "Utilities", "Entertainment", "Shopping", "Rent", "Insurance"];
    categories.forEach((cat) => {
      const Icon = getCategoryIcon(cat);
      expect(Icon).toBeDefined();
    });
  });
});
