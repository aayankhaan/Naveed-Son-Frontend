// ========================================
// SectionHeader.jsx
// One job per section: title, short support line, optional right action.
// ========================================

import { COLORS } from "../../constants/theme";

export default function SectionHeader({ title, description, action, className = "" }) {
  return (
    <div className={`flex items-end justify-between gap-3 flex-wrap mb-3 ${className}`}>
      <div className="min-w-0">
        <h2
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: COLORS.ink, letterSpacing: "-0.015em" }}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-[12px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
