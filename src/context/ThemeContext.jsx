// ========================================
// ThemeContext.jsx
// Light / dark switching. The palette lives in theme.js as a live object, so
// flipping the mode remounts the page tree once to recompute inline styles.
// ========================================

import { createContext, useCallback, useContext, useMemo, useState, Fragment } from "react";
import { applyTheme, readStoredMode } from "../constants/theme";

const ThemeContext = createContext({ mode: "light", isDark: false, setMode: () => {}, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => readStoredMode());

  const setMode = useCallback((next) => {
    const resolved = next === "dark" ? "dark" : "light";
    applyTheme(resolved);
    setModeState(resolved);
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, isDark: mode === "dark", setMode, toggle }),
    [mode, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Remounts its subtree when the palette changes so pages that read COLORS.*
 * during render pick up the new hex values.
 */
export function ThemeScope({ children }) {
  const { mode } = useTheme();
  return <Fragment key={mode}>{children}</Fragment>;
}
