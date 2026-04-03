import type React from "react";
import { useTheme } from "./theme-context";

interface ChartTheme {
  tooltip: React.CSSProperties;
  label: React.CSSProperties;
  item: React.CSSProperties;
  gridStroke: string;
  tickFill: string;
}

const DARK_THEME: ChartTheme = {
  tooltip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(60px) saturate(150%)",
    WebkitBackdropFilter: "blur(60px) saturate(150%)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: "8px",
    fontFamily: "var(--font-sans)",
    fontVariantNumeric: "tabular-nums lining-nums",
    fontSize: "12px",
    color: "rgba(255,255,255,0.92)",
    boxShadow: "0 2px 4px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.4)",
  },
  label: { color: "rgba(255,255,255,0.92)" },
  item: { color: "rgba(255,255,255,0.92)" },
  gridStroke: "rgba(255,255,255,0.04)",
  tickFill: "rgba(255,255,255,0.4)",
};

const LIGHT_THEME: ChartTheme = {
  tooltip: {
    backgroundColor: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(64px) saturate(115%)",
    WebkitBackdropFilter: "blur(64px) saturate(115%)",
    borderColor: "rgba(0,0,0,0.07)",
    borderRadius: "12px",
    fontFamily: "var(--font-sans)",
    fontVariantNumeric: "tabular-nums lining-nums",
    fontSize: "12px",
    color: "rgba(15,23,42,0.92)",
    boxShadow: "none",
  },
  label: { color: "rgba(15,23,42,0.92)" },
  item: { color: "rgba(15,23,42,0.92)" },
  gridStroke: "rgba(0,0,0,0.04)",
  tickFill: "rgba(15,23,42,0.4)",
};

export function useChartTheme(): ChartTheme {
  const { themeId } = useTheme();
  return themeId === "light" ? LIGHT_THEME : DARK_THEME;
}
