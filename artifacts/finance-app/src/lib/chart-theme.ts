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
    backdropFilter: "blur(24px) saturate(150%)",
    WebkitBackdropFilter: "blur(24px) saturate(150%)",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: "12px",
    fontFamily: "var(--font-sans)",
    fontVariantNumeric: "tabular-nums lining-nums",
    fontSize: "12px",
    color: "hsl(210 40% 98%)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  label: { color: "hsl(210 40% 98%)" },
  item: { color: "hsl(210 40% 98%)" },
  gridStroke: "rgba(255,255,255,0.04)",
  tickFill: "rgba(255,255,255,0.4)",
};

const LIGHT_THEME: ChartTheme = {
  tooltip: {
    backgroundColor: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(60px) saturate(160%)",
    WebkitBackdropFilter: "blur(60px) saturate(160%)",
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: "8px",
    fontFamily: "var(--font-sans)",
    fontVariantNumeric: "tabular-nums lining-nums",
    fontSize: "12px",
    color: "rgba(15,23,42,0.9)",
    boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08)",
  },
  label: { color: "rgba(15,23,42,0.9)" },
  item: { color: "rgba(15,23,42,0.9)" },
  gridStroke: "rgba(0,0,0,0.05)",
  tickFill: "rgba(15,23,42,0.35)",
};

export function useChartTheme(): ChartTheme {
  const { themeId } = useTheme();
  return themeId === "light" ? LIGHT_THEME : DARK_THEME;
}
