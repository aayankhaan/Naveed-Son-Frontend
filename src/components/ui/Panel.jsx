// ========================================
// Panel.jsx
// Soft surface for charts / lists — not a heavy card stack.
// ========================================

import { COLORS } from "../../constants/theme";

export default function Panel({ children, className = "", padded = true, delay, style = {}, ...rest }) {
  return (
    <div
      className={`panel rounded-2xl overflow-hidden fade-in ${padded ? "p-5" : ""} ${className}`}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "var(--shadow-xs)",
        animationDelay: delay != null ? `${delay}ms` : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
