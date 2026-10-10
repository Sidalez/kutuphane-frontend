import React, { createContext, useContext, useLayoutEffect, useEffect, useState } from "react";
import { applyTheme, readTheme, type Theme } from "./themeDom";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return readTheme();
  });

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    // Reassert colours after iOS restores a suspended Home Screen app.
    const sync = () => { if (document.visibilityState === "visible") applyTheme(theme); };
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { window.removeEventListener("pageshow", sync); document.removeEventListener("visibilitychange", sync); };
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
