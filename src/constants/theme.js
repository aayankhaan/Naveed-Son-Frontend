// ========================================
// theme.js
// Single source of truth for the palette.
//
// COLORS is a live object: switching theme mutates it in place and mirrors
// every value onto CSS custom properties (--c-*) for index.css.
// Inline styles and SVG attributes keep real hex values, so charts and icons
// render correctly (var() is not allowed in SVG presentation attributes).
// ========================================

export const FONT =
  "'Manrope', 'Segoe UI', ui-sans-serif, system-ui, -apple-system, sans-serif";

export const THEME_STORAGE_KEY = "naveedson-theme";

/**
 * Token guide
 * - ink            primary text (flips with theme)
 * - inkSurface     surfaces that stay dark in both themes (sidebar, chips, tooltips)
 * - inkSoft        elevated layer on top of inkSurface
 * - onDark         text sitting on inkSurface / inkSoft
 * - bone           page background · boneDim subtle fill · card panel
 */
const LIGHT = {
  ink: "#1C1917",
  inkSoft: "#2A2622",
  inkSurface: "#1C1917",
  onDark: "#F5F1E8",
  bone: "#F5F1E8",
  boneDim: "#EAE3D3",
  boneBorder: "#DCD3BE",
  card: "#FFFFFF",
  gold: "#B8873D",
  goldDim: "#8C6A30",
  goldSoft: "#EFDFC0",
  rust: "#9C4A34",
  rustSoft: "#F1E1DB",
  green: "#4C7A5A",
  greenSoft: "#E1EAE3",
  graphite: "#6B655C",
  graphiteLight: "#948C7F",
  border: "#E7E0D2",
};

const DARK = {
  ink: "#F2EDE3",
  inkSoft: "#2C2723",
  inkSurface: "#141110",
  onDark: "#F2EDE3",
  bone: "#131110",
  boneDim: "#1E1A17",
  boneBorder: "#342C24",
  card: "#1B1815",
  gold: "#D6A960",
  goldDim: "#E3C182",
  goldSoft: "#3A2D1A",
  rust: "#DE8168",
  rustSoft: "#3B211A",
  green: "#6FB98D",
  greenSoft: "#1B2E23",
  graphite: "#B7AEA2",
  graphiteLight: "#8E8578",
  border: "#2F2922",
};

const LOGIN_LIGHT = {
  ink: "#1C1917",
  inkSoft: "#2A2622",
  inkSurface: "#1C1917",
  onDark: "#F5F1E8",
  rustSoft: "#F1E1DB",
  btnBg: "#1C1917",
  btnBgHover: "#2A2622",
  btnFg: "#F5F1E8",
  bone: "#F5F1E8",
  boneDim: "#EAE3D3",
  boneBorder: "#DCD3BE",
  gold: "#B8873D",
  goldDim: "#8C6A30",
  goldSoft: "#D9BE8C",
  rust: "#9C4A34",
  graphite: "#6B655C",
  graphiteLight: "#948C7F",
  white: "#FFFFFF",
};

const LOGIN_DARK = {
  ink: "#F2EDE3",
  inkSoft: "#2C2723",
  inkSurface: "#141110",
  onDark: "#F2EDE3",
  rustSoft: "#3B211A",
  btnBg: "#D6A960",
  btnBgHover: "#E3C182",
  btnFg: "#141110",
  bone: "#131110",
  boneDim: "#1E1A17",
  boneBorder: "#342C24",
  gold: "#D6A960",
  goldDim: "#E3C182",
  goldSoft: "#8A6A34",
  rust: "#DE8168",
  graphite: "#B7AEA2",
  graphiteLight: "#8E8578",
  white: "#1B1815",
};

/** Mutated in place on theme change — never replace this object. */
export const COLORS = { ...LIGHT };
export const LOGIN_COLORS = { ...LOGIN_LIGHT };

function cssVarName(key) {
  return `--c-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export function readStoredMode() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* private mode — fall through to system preference */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function applyTheme(mode) {
  const next = mode === "dark" ? DARK : LIGHT;
  Object.assign(COLORS, next);
  Object.assign(LOGIN_COLORS, mode === "dark" ? LOGIN_DARK : LOGIN_LIGHT);

  if (typeof document === "undefined") return mode;
  const root = document.documentElement;
  Object.entries(COLORS).forEach(([key, value]) => {
    root.style.setProperty(cssVarName(key), value);
  });
  root.dataset.theme = mode;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore write failures */
  }
  return mode;
}

// Paint the correct palette before React mounts so there is no flash.
applyTheme(readStoredMode());
