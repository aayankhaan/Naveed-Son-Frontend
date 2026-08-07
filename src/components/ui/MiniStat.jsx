// ========================================
// MiniStat.jsx
// Compact stat card (label, value, icon, optional sub-line) used on the
// Employees and Orders pages.
// ========================================

import { COLORS, FONT } from "../../constants/theme";

export default function MiniStat({ label, value, sub, icon, index = 0 }) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 stat-card fade-in"
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "var(--shadow-xs)",
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: COLORS.graphiteLight }}>{label}</div>
        {icon ? (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: COLORS.boneDim, color: COLORS.goldDim }}>
            {icon}
          </div>
        ) : null}
      </div>
      <div className="text-[22px] sm:text-[24px] leading-tight font-semibold mt-3 tracking-tight" style={{ color: COLORS.ink, fontFamily: FONT, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div className="text-[12px] mt-1.5" style={{ color: COLORS.graphite }}>{sub}</div>}
    </div>
  );
}
