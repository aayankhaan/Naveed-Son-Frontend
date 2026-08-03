// ========================================
// Sidebar.jsx
// Left navigation rail used by every authenticated page. Highlights the
// current route, links to the pages that exist, offers logout, and features
// a prominent "Insert Daily Data" quick action button linking to Bulk Daily Entry.
// ========================================

import { Link, useLocation } from "react-router-dom";
import { COLORS, FONT } from "../../constants/theme";
import { Logo, NavIcon } from "../icons/BrandIcons";
import { useAuth } from "../../context/AuthContext";

import { SparkIcon } from "../icons/CommonIcons";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "overview", path: "/overview" },
  { id: "orders", label: "Orders", icon: "orders", path: "/orders" },
  { id: "employees", label: "Employees", icon: "employees", path: "/employees" },
  { id: "daily-entry", label: "Bulk Daily Entry", icon: "dailyEntry", path: "/daily-entry" },
  { id: "costing", label: "Item Costing", icon: "costing", path: "/costing" },
  { id: "forecast", label: "Forecast", icon: "forecast", path: "/forecast" },
  { id: "reports", label: "Reports & Exports", icon: "reports", path: "/reports" },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />}
      <div
        className={`fixed md:sticky z-50 top-0 left-0 h-full md:h-screen w-64 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ background: COLORS.ink }}
      >
        <div>
          <div className="flex items-center gap-2.5 px-5 pt-6 pb-6">
            <Logo />
            <div>
              <div className="text-[13px] font-semibold leading-tight" style={{ color: COLORS.bone, fontFamily: FONT }}>
                Naveed &amp; Sons
              </div>
              <div className="text-[10px] tracking-[0.08em] uppercase" style={{ color: COLORS.graphiteLight }}>
                Management
              </div>
            </div>
          </div>

          {/* High-Visibility Noticeable CTA Button linking to Bulk Daily Entry Page */}
          <div className="px-3 mb-5">
            <Link
              to="/daily-entry"
              onClick={() => {
                if (onClose) onClose();
              }}
              className="btn-primary flex items-center justify-center gap-2 text-[13px] font-semibold px-3.5 py-2.5 rounded-lg w-full no-underline"
              style={{
                background: COLORS.gold,
                color: COLORS.ink,
                fontFamily: FONT,
              }}
            >
              <SparkIcon size={14} /> Insert Daily Data
            </Link>
          </div>

          <nav className="px-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isAvailable = Boolean(item.path);
              const isActive = isAvailable && pathname === item.path;
              const sharedStyle = {
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                background: isActive ? COLORS.inkSoft : "transparent",
                color: isAvailable ? COLORS.bone : COLORS.graphiteLight,
                fontFamily: FONT,
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                cursor: isAvailable ? "pointer" : "default",
                opacity: isAvailable ? 1 : 0.55,
                textDecoration: "none",
              };

              if (!isAvailable) {
                return (
                  <button key={item.id} type="button" disabled className="nav-item" style={sharedStyle}>
                    <NavIcon name={item.icon} />
                    {item.label}
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded" style={{ background: COLORS.inkSoft, color: COLORS.graphiteLight }}>
                      soon
                    </span>
                  </button>
                );
              }

              return (
                <Link key={item.id} to={item.path} className="nav-item" style={sharedStyle} onClick={onClose}>
                  <NavIcon name={item.icon} />
                  {item.label}
                  {isActive && <span className="ml-auto" style={{ width: 5, height: 5, borderRadius: 3, background: COLORS.gold }} />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-5 pb-6 pt-4 text-[10px]" style={{ color: COLORS.graphiteLight, borderTop: `1px solid ${COLORS.inkSoft}` }}>
          <button
            type="button"
            onClick={logout}
            className="btn-link text-[11px] font-medium"
            style={{ color: COLORS.graphiteLight, fontFamily: FONT }}
          >
            Log out
          </button>
          <div className="pt-4">Built by ALB Studio</div>
        </div>
      </div>
    </>
  );
}
