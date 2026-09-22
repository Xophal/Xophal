"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
};

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children, defaultTheme = "system", enableSystem = true }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "light" || saved === "dark") {
      setThemeState(saved as Theme);
    } else if (defaultTheme) {
      setThemeState(defaultTheme);
    }
  }, [defaultTheme]);

  useEffect(() => {
    const apply = (t: Theme) => {
      let resolved: "light" | "dark" = "light";
      if (t === "system") {
        resolved = getSystemTheme();
      } else {
        resolved = t;
      }
      setResolvedTheme(resolved);
      const el = document.documentElement;
      if (resolved === "dark") el.classList.add("dark");
      else el.classList.remove("dark");
    };

    apply(theme);

    if (enableSystem) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply(theme);
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    }
  }, [theme, enableSystem]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
  };

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
