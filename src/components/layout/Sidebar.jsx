// ========================================
// Sidebar.jsx
// Grouped navigation rail. Stays dark in both themes.
// ========================================

import { Link, useLocation } from "react-router-dom";
import { COLORS, FONT } from "../../constants/theme";
import { Logo, NavIcon } from "../icons/BrandIcons";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../ui/ThemeToggle";
import { SparkIcon } from "../icons/CommonIcons";

const NAV_GROUPS = [
  {
    label: "Floor",
    items: [
      { id: "overview", label: "Overview", icon: "overview", path: "/overview" },
      { id: "orders", label: "Orders", icon: "orders", path: "/orders" },
      { id: "shipment", label: "Shipment", icon: "shipment", path: "/shipment" },
      { id: "security", label: "Security History", icon: "invoicing", path: "/security" },
      { id: "expenses", label: "ATM Expenses", icon: "expenses", path: "/expenses" },
      { id: "daily-entry", label: "Bulk Daily Entry", icon: "dailyEntry", path: "/daily-entry", adminOnly: true },
    ],
  },
  {
    label: "People & pay",
    items: [
      { id: "employees", label: "Employees", icon: "employees", path: "/employees" },
      { id: "payouts", label: "Payouts", icon: "wages", path: "/payouts", adminOnly: true },
    ],
  },
  {
    label: "Catalog & plan",
    items: [
      { id: "costing", label: "Item Costing", icon: "costing", path: "/costing" },
      { id: "forecast", label: "Forecast", icon: "forecast", path: "/forecast" },
    ],
  },
];

const HAIRLINE = "rgba(255,255,255,0.08)";

export default function Sidebar({ mobileOpen, onClose }) {
  const { pathname } = useLocation();
  const { logout, canWrite, role } = useAuth();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canWrite || !item.adminOnly),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden modal-overlay" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={`fixed md:sticky z-50 top-0 left-0 h-full md:h-screen w-[15.5rem] flex flex-col overflow-y-auto no-scrollbar transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ background: COLORS.inkSurface, borderRight: `1px solid ${HAIRLINE}` }}
      >
        <div
          className="flex items-center gap-2.5 px-4 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <Logo />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-tight truncate" style={{ color: COLORS.onDark, fontFamily: FONT }}>
              Naveed &amp; Sons
            </div>
            <div className="text-[10px] tracking-[0.1em] uppercase" style={{ color: COLORS.graphiteLight }}>
              {role === "management" ? "Management" : "Floor desk"}
            </div>
          </div>
        </div>

        {canWrite ? (
          <div className="px-3 pt-4 pb-3">
            <Link
              to="/daily-entry"
              onClick={() => onClose?.()}
              className="btn-primary flex items-center justify-center gap-2 text-[13px] font-semibold px-3.5 py-2.5 rounded-xl w-full no-underline"
              style={{ background: COLORS.gold, color: COLORS.inkSurface, fontFamily: FONT }}
            >
              <SparkIcon size={14} /> Insert Daily Data
            </Link>
          </div>
        ) : (
          <div className="px-3 pt-4 pb-3">
            <div
              className="text-[11px] font-medium px-3 py-2.5 rounded-xl text-center"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,241,232,0.55)" }}
            >
              View-only access
            </div>
          </div>
        )}

        <nav className="px-3 flex-1 flex flex-col gap-5 pb-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div
                className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "rgba(245,241,232,0.38)" }}
              >
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className="nav-item relative"
                      onClick={onClose}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "9px 11px",
                        borderRadius: 10,
                        border: "none",
                        background: isActive ? "rgba(255,255,255,0.09)" : "transparent",
                        color: isActive ? COLORS.onDark : "rgba(245,241,232,0.72)",
                        fontFamily: FONT,
                        fontSize: 13.5,
                        fontWeight: isActive ? 600 : 500,
                        textDecoration: "none",
                      }}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                          style={{ width: 3, height: 16, background: COLORS.gold }}
                        />
                      )}
                      <NavIcon name={item.icon} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 pb-5 pt-3 mt-auto" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <ThemeToggle tone="dark" className="mb-3" />
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={logout}
              className="btn-link text-[11px] font-medium"
              style={{ color: COLORS.graphiteLight, fontFamily: FONT }}
            >
              Log out
            </button>
            <span className="text-[10px]" style={{ color: COLORS.graphiteLight, opacity: 0.7 }}>
              ALB Studio
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
