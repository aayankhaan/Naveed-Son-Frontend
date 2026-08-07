// ========================================
// BrandIcons.jsx
// Company logo mark and sidebar navigation icons shared across pages.
// ========================================

import { COLORS } from "../../constants/theme";

export function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="46" height="46" rx="10" fill={COLORS.inkSurface} />
      <rect x="1" y="1" width="46" height="46" rx="10" stroke={COLORS.gold} strokeWidth="1.2" />
      <rect x="12" y="27" width="24" height="6" rx="2" fill={COLORS.graphiteLight} opacity="0.35" />
      <rect x="12.5" y="21.5" width="23" height="6" rx="2" fill={COLORS.boneDim} opacity="0.55" />
      <rect x="13" y="16" width="22" height="6.5" rx="2" fill={COLORS.bone} />
      <line x1="16" y1="19.2" x2="32" y2="19.2" stroke={COLORS.gold} strokeWidth="1.1" strokeDasharray="1.6 1.8" strokeLinecap="round" />
      <path d="M30 16 L35 16 L35 21" stroke={COLORS.gold} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
    </svg>
  );
}

export function NavIcon({ name }) {
  const stroke = "currentColor";
  const common = { width: 18, height: 18, viewBox: "0 0 18 18", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
  switch (name) {
    case "overview":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="6" height="6" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="10" y="2" width="6" height="6" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="2" y="10" width="6" height="6" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="10" y="10" width="6" height="6" rx="1.2" stroke={stroke} strokeWidth="1.4" />
        </svg>
      );
    case "orders":
      return (
        <svg {...common}>
          <path d="M4 2h10l1 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5l1-3z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6 8h6M6 11h6" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "employees":
      return (
        <svg {...common}>
          <circle cx="9" cy="6" r="2.6" stroke={stroke} strokeWidth="1.4" />
          <path d="M3.5 16c.7-3.4 2.9-5.2 5.5-5.2s4.8 1.8 5.5 5.2" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "wages":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="7" stroke={stroke} strokeWidth="1.4" />
          <path d="M9 5.5v7M6.8 7.2c0-1 .9-1.7 2.2-1.7s2.2.6 2.2 1.5c0 2.2-4.4 1-4.4 3.2 0 .9 1 1.5 2.2 1.5s2.2-.6 2.2-1.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "shipment":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2.5 11.5V6.2L9 3l6.5 3.2v5.3L9 15l-6.5-3.5z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
          <path d="M2.5 6.2L9 9.4l6.5-3.2M9 9.4V15" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "invoicing":
      return (
        <svg {...common}>
          <path d="M5 2h8v14l-2-1.3L9 16l-2-1.3L5 16V2z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7 6h4M7 9h4" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "forecast":
      return (
        <svg {...common}>
          <path d="M2.5 14.5l4-5 3 3 5.5-7" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.5 5.5h3.5V9" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "costing":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke={stroke} strokeWidth="1.4" />
          <path d="M6 6.5h6M6 9.5h6M6 12.5h3" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "dailyEntry":
      return (
        <svg {...common}>
          <path d="M13 2H5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 5 16h8a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 13 2z" stroke={stroke} strokeWidth="1.4" />
          <path d="M6 5.5h6M6 8.5h6M6 11.5h4" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "expenses":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="12" height="10" rx="1.5" stroke={stroke} strokeWidth="1.4" />
          <path d="M3 7.5h12M7 4v3.5" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M8.5 11h3" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
