import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface ThemeDefinition {
  id: string;
  label: string;
  rootClassName: string;
  navClassName: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "glass-ui",
    label: "Dark",
    rootClassName: "mesh-gradient-bg ambient-orbs",
    navClassName: "glass-nav",
  },
  {
    id: "light",
    label: "Light",
    rootClassName: "mesh-gradient-bg-light ambient-orbs-light",
    navClassName: "glass-nav-light",
  },
];

const STORAGE_KEY = "surplusengine-theme";
const DEFAULT_THEME = "glass-ui";

function getStoredTheme(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get("theme");
    if (urlTheme && THEMES.some((t) => t.id === urlTheme)) return urlTheme;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  } catch {}
  return DEFAULT_THEME;
}

interface ThemeContextValue {
  themeId: string;
  theme: ThemeDefinition;
  setThemeId: (id: string) => void;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(getStoredTheme);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  const setThemeId = useCallback((id: string) => {
    if (!THEMES.some((t) => t.id === id)) return;
    setThemeIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.id);
    if (theme.id === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [theme.id]);

  return (
    <ThemeContext.Provider value={{ themeId, theme, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
