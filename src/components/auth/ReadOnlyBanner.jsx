// ========================================
// ReadOnlyBanner.jsx
// Shown to management accounts on pages they can view but not change.
// ========================================

import { COLORS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

export default function ReadOnlyBanner({ className = "" }) {
  const { canWrite } = useAuth();
  if (canWrite) return null;
  return (
    <div
      className={`rounded-xl px-4 py-2.5 mb-4 text-[12.5px] font-medium ${className}`}
      style={{ background: COLORS.goldSoft, color: COLORS.goldDim, border: `1px solid ${COLORS.border}` }}
    >
      View-only (Management) — you can browse, but only an admin can add or change data.
    </div>
  );
}
