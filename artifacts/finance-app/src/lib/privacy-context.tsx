import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface PrivacyContextValue {
  isHidden: boolean;
  toggleVisibility: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isHidden: true,
  toggleVisibility: () => {},
});

const STORAGE_KEY = "surplusengine-privacy-shield";

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isHidden, setIsHidden] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isHidden));
    } catch { /* localStorage may be unavailable */ }
  }, [isHidden]);

  const toggleVisibility = useCallback(() => {
    setIsHidden((prev) => !prev);
  }, []);

  return (
    <PrivacyContext.Provider value={{ isHidden, toggleVisibility }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
