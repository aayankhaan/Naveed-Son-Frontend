// ========================================
// Toolbar.jsx
// Filter / search strip used under page headers.
// ========================================

import { COLORS } from "../../constants/theme";

export default function Toolbar({ children, meta, className = "" }) {
  return (
    <div
      className={`toolbar rounded-2xl px-3.5 py-3 mb-5 flex flex-wrap items-center gap-2.5 ${className}`}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">{children}</div>
      {meta != null ? (
        <div className="text-[11.5px] shrink-0 ml-auto" style={{ color: COLORS.graphiteLight }}>
          {meta}
        </div>
      ) : null}
    </div>
  );
}
