import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme, THEMES } from "./theme-context";

function TestConsumer() {
  const { themeId, theme, setThemeId, themes } = useTheme();
  return (
    <div>
      <span data-testid="theme-id">{themeId}</span>
      <span data-testid="theme-label">{theme.label}</span>
      <span data-testid="theme-count">{themes.length}</span>
      <button onClick={() => setThemeId("light")}>Set Light</button>
      <button onClick={() => setThemeId("glass-ui")}>Set Dark</button>
      <button onClick={() => setThemeId("invalid")}>Set Invalid</button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  it("defaults to glass-ui (Dark)", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-id")).toHaveTextContent("glass-ui");
    expect(screen.getByTestId("theme-label")).toHaveTextContent("Dark");
  });

  it("exposes all themes", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-count")).toHaveTextContent(String(THEMES.length));
  });

  it("can switch to light theme", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Light"));
    expect(screen.getByTestId("theme-id")).toHaveTextContent("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("adds dark class for glass-ui theme", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Light"));
    await user.click(screen.getByText("Set Dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignores invalid theme ids", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Invalid"));
    expect(screen.getByTestId("theme-id")).toHaveTextContent("glass-ui");
  });

  it("persists theme to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    await user.click(screen.getByText("Set Light"));
    expect(localStorage.getItem("surplusengine-theme")).toBe("light");
  });

  it("reads theme from localStorage", () => {
    localStorage.setItem("surplusengine-theme", "light");
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-id")).toHaveTextContent("light");
  });

  it("throws when useTheme used outside provider", () => {
    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useTheme must be used within ThemeProvider");
  });
});
