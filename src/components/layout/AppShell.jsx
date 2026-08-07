// ========================================
// AppShell.jsx
// Shared authenticated layout: sidebar + sticky page header + content frame.
// Replaces the copy-pasted shell every page was carrying.
// ========================================

import { useState } from "react";
import { COLORS, FONT } from "../../constants/theme";
import Sidebar from "./Sidebar";
import { useAuth } from "../../context/AuthContext";

function initials(name) {
  if (!name) return "A";
  return String(name)
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
  maxWidth = "1280px",
  showAvatar = true,
  contentClassName = "",
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, role } = useAuth();
  const adminName = user?.username || "Admin";
  const roleLabel = role === "management" ? "Management · view only" : "Administrator";

  return (
    <div className="min-h-screen w-full flex app-shell" style={{ background: COLORS.bone, fontFamily: FONT }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="page-header sticky top-0 z-30 backdrop-blur-md"
          style={{
            background: `color-mix(in srgb, ${COLORS.bone} 86%, transparent)`,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 md:px-8 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="md:hidden p-2 rounded-xl btn-secondary shrink-0"
                style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 4h12M2 8h12M2 12h12" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1
                  className="text-[17px] sm:text-[20px] font-semibold tracking-tight truncate"
                  style={{ color: COLORS.ink, letterSpacing: "-0.02em" }}
                >
                  {title}
                </h1>
                {subtitle ? (
                  <p className="text-[12px] mt-0.5 truncate" style={{ color: COLORS.graphiteLight }}>
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {actions}
              {showAvatar ? (
                <>
                  <div
                    className="hidden sm:flex flex-col items-end leading-tight pl-2 sm:pl-3"
                    style={{ borderLeft: `1px solid ${COLORS.border}` }}
                  >
                    <span className="text-[13px] font-medium" style={{ color: COLORS.ink }}>
                      {adminName}
                    </span>
                    <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                      {roleLabel}
                    </span>
                  </div>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0"
                    style={{
                      background: COLORS.inkSurface,
                      color: COLORS.gold,
                      border: `2px solid ${COLORS.goldSoft}`,
                    }}
                    title={`${adminName} (${roleLabel})`}
                  >
                    {initials(adminName)}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main
          className={`page-main page-enter flex-1 w-full mx-auto px-4 sm:px-6 md:px-8 py-5 md:py-7 ${contentClassName}`}
          style={{ maxWidth }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
