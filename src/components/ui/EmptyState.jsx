// ========================================
// EmptyState.jsx
// Calm empty / zero-data placeholder with optional CTA.
// ========================================

import { COLORS } from "../../constants/theme";

export default function EmptyState({ title, description, action, icon, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
      style={{ color: COLORS.graphiteLight }}
    >
      {icon ? (
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: COLORS.boneDim, color: COLORS.goldDim }}
        >
          {icon}
        </div>
      ) : null}
      {title ? (
        <div className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>
          {title}
        </div>
      ) : null}
      {description ? <p className="text-[12.5px] mt-1 max-w-sm m-0">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
