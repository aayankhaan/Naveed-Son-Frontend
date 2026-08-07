// ========================================
// ThemeToggle.jsx
// Segmented light/dark switch with a sliding indicator.
// `tone="dark"` renders it for placement on a dark surface (sidebar).
// ========================================

import { COLORS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";

function SunIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ThemeToggle({ tone = "light", className = "" }) {
  const { mode, setMode, isDark } = useTheme();
  const onDarkSurface = tone === "dark";

  const trackBg = onDarkSurface ? "rgba(255,255,255,0.07)" : COLORS.boneDim;
  const trackBorder = onDarkSurface ? "rgba(255,255,255,0.10)" : COLORS.border;
  const idleColor = onDarkSurface ? "rgba(245,241,232,0.55)" : COLORS.graphiteLight;

  const options = [
    { id: "light", label: "Light", icon: <SunIcon /> },
    { id: "dark", label: "Dark", icon: <MoonIcon /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`relative grid grid-cols-2 gap-1 p-1 rounded-full ${className}`}
      style={{ background: trackBg, border: `1px solid ${trackBorder}` }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-full pointer-events-none"
        style={{
          left: 4,
          width: "calc(50% - 4px)",
          transform: isDark ? "translateX(100%)" : "translateX(0)",
          background: COLORS.gold,
          boxShadow: "0 2px 8px -3px rgba(0,0,0,0.45)",
          transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      {options.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(option.id)}
            className="relative z-10 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer"
            style={{
              background: "transparent",
              border: "none",
              color: active ? COLORS.inkSurface : idleColor,
              transition: "color 200ms ease",
            }}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
