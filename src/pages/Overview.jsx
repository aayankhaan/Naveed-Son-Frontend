// ========================================
// Overview.jsx
// Dashboard landing page shown after login: production stats, dues by
// department, cross-department order pipeline, and recent entries.
// ========================================

import { useState, useMemo, Fragment } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";

const ITEMS = ["All items", "Bedsheet — King", "Bedsheet — Queen", "Pillow cover", "Cushion cover"];
const RANGES = [
  { label: "Last 3 days", days: 3 },
  { label: "Last 5 days", days: 5 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
];

const STAGE_META = [
  { name: "Cutting", color: COLORS.graphiteLight },
  { name: "Stitching", color: COLORS.gold },
  { name: "Checking", color: COLORS.goldDim },
  { name: "Packing", color: COLORS.green },
  { name: "Invoicing", color: COLORS.rust },
];

function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildProductionData(days, itemIndex) {
  const rand = seedRandom(42 + itemIndex * 7);
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const base = itemIndex === 0 ? 620 : 180;
    const variance = itemIndex === 0 ? 220 : 70;
    out.push({ date: label, units: Math.round(base + rand() * variance) });
  }
  return out;
}

function buildStationData(days) {
  const rand = seedRandom(11);
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    out.push({
      date: label,
      Cutting: Math.round(180 + rand() * 60),
      Stitching: Math.round(150 + rand() * 55),
      Checking: Math.round(120 + rand() * 40),
      Packing: Math.round(100 + rand() * 45),
    });
  }
  return out;
}

const DEPARTMENT_DUES = [
  { name: "Cutting", due: 32400 },
  { name: "Stitching", due: 54200 },
  { name: "Checking", due: 11800 },
  { name: "Packing", due: 43700 },
];
const TOTAL_DUES = DEPARTMENT_DUES.reduce((sum, d) => sum + d.due, 0);
const MAX_DUE = Math.max(...DEPARTMENT_DUES.map((d) => d.due));

const ORDERS = [
  { id: "ORD-2291", customer: "Al-Rehman Textiles", item: "Bedsheet — King", qty: 240, stage: 0, priority: "High", due: "Today" },
  { id: "ORD-2288", customer: "Karim Home Linens", item: "Pillow cover", qty: 480, stage: 0, priority: "Medium", due: "Tomorrow" },
  { id: "ORD-2285", customer: "Noor Fabrics Co.", item: "Cushion cover", qty: 150, stage: 1, priority: "Medium", due: "Today" },
  { id: "ORD-2283", customer: "Al-Rehman Textiles", item: "Bedsheet — Queen", qty: 200, stage: 1, priority: "High", due: "Tomorrow" },
  { id: "ORD-2279", customer: "Zainab Interiors", item: "Bedsheet — King", qty: 180, stage: 1, priority: "Low", due: "Aug 6" },
  { id: "ORD-2276", customer: "Sialkot Exports", item: "Cushion cover", qty: 320, stage: 2, priority: "Medium", due: "Today" },
  { id: "ORD-2271", customer: "Karim Home Linens", item: "Bedsheet — Queen", qty: 260, stage: 2, priority: "High", due: "Tomorrow" },
  { id: "ORD-2266", customer: "Noor Fabrics Co.", item: "Pillow cover", qty: 400, stage: 3, priority: "Medium", due: "Aug 3" },
  { id: "ORD-2260", customer: "Zainab Interiors", item: "Bedsheet — King", qty: 150, stage: 3, priority: "Low", due: "Aug 4" },
  { id: "ORD-2254", customer: "Al-Rehman Textiles", item: "Cushion cover", qty: 210, stage: 4, priority: "High", due: "Today" },
  { id: "ORD-2249", customer: "Sialkot Exports", item: "Bedsheet — Queen", qty: 190, stage: 4, priority: "Medium", due: "Tomorrow" },
  { id: "ORD-2241", customer: "Karim Home Linens", item: "Pillow cover", qty: 350, stage: 4, priority: "Low", due: "Aug 3" },
];

const RECENT_ENTRIES = [
  { date: "Today", employee: "Fahad Iqbal", station: "Stitching", item: "Bedsheet — King", qty: 84 },
  { date: "Today", employee: "Bilal Hussain", station: "Cutting", item: "Pillow cover", qty: 210 },
  { date: "Today", employee: "Sana Tariq", station: "Checking", item: "Cushion cover", qty: 96 },
  { date: "Yesterday", employee: "Fahad Iqbal", station: "Stitching", item: "Bedsheet — Queen", qty: 76 },
  { date: "Yesterday", employee: "Imran Sheikh", station: "Packing", item: "Bedsheet — King", qty: 140 },
  { date: "2 days ago", employee: "Bilal Hussain", station: "Cutting", item: "Cushion cover", qty: 188 },
];

const AVATAR_PALETTE = [
  { bg: COLORS.goldSoft, fg: COLORS.goldDim },
  { bg: COLORS.greenSoft, fg: COLORS.green },
  { bg: COLORS.rustSoft, fg: COLORS.rust },
  { bg: COLORS.boneDim, fg: COLORS.graphite },
];

function initials(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function avatarColor(name) {
  const sum = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function StatIcon({ name }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
  switch (name) {
    case "units":
      return (
        <svg {...common}>
          <path d="M8 1.5l6 3.2v6.6L8 14.5l-6-3.2V4.7L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M2 4.7L8 8l6-3.3M8 8v6.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case "avg":
      return (
        <svg {...common}>
          <path d="M1.5 13.5l4-5 3 2.6 5.5-6.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 3.5H14V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "pipeline":
      return (
        <svg {...common}>
          <rect x="1.5" y="3" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="1.5" y="7.5" width="9" height="3" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="1.5" y="12" width="5.5" height="3" rx="1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case "dues":
      return (
        <svg {...common}>
          <rect x="1.5" y="4" width="13" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1.5 6.8h13" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="11.2" cy="10" r="1.1" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

function TrendGlyph({ up }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
      {up ? (
        <path d="M5 1.2l4.2 5.6H0.8L5 1.2z" fill="currentColor" />
      ) : (
        <path d="M5 8.8L0.8 3.2h8.4L5 8.8z" fill="currentColor" />
      )}
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v8M3.8 6.8L7 9.9l3.2-3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 11.2v1.3h11v-1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label, value, sub, icon, trend, index = 0 }) {
  return (
    <div
      className="rounded-2xl p-5 stat-card fade-in"
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: COLORS.graphiteLight }}>
          {label}
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: COLORS.boneDim, color: COLORS.goldDim }}
        >
          <StatIcon name={icon} />
        </div>
      </div>
      <div className="text-[26px] leading-tight font-semibold mt-3 tracking-tight" style={{ color: COLORS.ink, fontFamily: FONT }}>
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {trend !== undefined && (
          <span
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
            style={{ color: trend >= 0 ? COLORS.green : COLORS.rust }}
          >
            <TrendGlyph up={trend >= 0} />
            {Math.abs(trend)}%
          </span>
        )}
        {sub && (
          <span className="text-[12px]" style={{ color: COLORS.graphite }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div className="select-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="select-caret">
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function PriorityBadge({ level }) {
  const map = {
    High: { bg: COLORS.rustSoft, fg: COLORS.rust },
    Medium: { bg: COLORS.goldSoft, fg: COLORS.goldDim },
    Low: { bg: COLORS.greenSoft, fg: COLORS.green },
  };
  const c = map[level] || map.Medium;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}
    >
      {level}
    </span>
  );
}

function OrderRow({ order, index }) {
  return (
    <div
      className="order-row fade-in flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5"
      style={{
        animationDelay: `${index * 40}ms`,
        borderTop: index === 0 ? "none" : `1px solid ${COLORS.border}`,
      }}
    >
      <div className="flex items-start gap-3 sm:w-[210px] shrink-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>
            {order.id}
          </span>
          <span className="text-[12px] truncate" style={{ color: COLORS.graphite }}>
            {order.customer}
          </span>
          <span className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
            {order.item} · {order.qty} pcs
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center min-w-[220px]">
        {STAGE_META.map((s, i) => {
          const status = i < order.stage ? "done" : i === order.stage ? "active" : "pending";
          return (
            <Fragment key={s.name}>
              <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 0 }}>
                <div
                  className={status === "active" ? "stage-dot-active" : ""}
                  title={s.name}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: status === "pending" ? COLORS.card : s.color,
                    border: `2px solid ${status === "pending" ? COLORS.boneBorder : s.color}`,
                    transition: "background .2s ease, border-color .2s ease",
                  }}
                />
                <span
                  className="hidden lg:block text-[9px] font-medium tracking-wide uppercase whitespace-nowrap"
                  style={{ color: status === "pending" ? COLORS.graphiteLight : COLORS.graphite }}
                >
                  {s.name}
                </span>
              </div>
              {i < STAGE_META.length - 1 && (
                <div
                  className="flex-1 h-[2px] mx-1.5 rounded-full"
                  style={{ background: i < order.stage ? s.color : COLORS.boneBorder, minWidth: 12 }}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-3 sm:w-[150px] justify-between sm:justify-end shrink-0">
        <PriorityBadge level={order.priority} />
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>
            Due
          </div>
          <div className="text-[12.5px] font-medium" style={{ color: COLORS.ink }}>
            {order.due}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  const [itemFilter, setItemFilter] = useState(ITEMS[0]);
  const [rangeLabel, setRangeLabel] = useState(RANGES[0].label);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const rangeDays = RANGES.find((r) => r.label === rangeLabel).days;
  const itemIndex = ITEMS.indexOf(itemFilter);

  const productionData = useMemo(() => buildProductionData(rangeDays, itemIndex), [rangeDays, itemIndex]);
  const stationData = useMemo(() => buildStationData(rangeDays), [rangeDays]);

  const totalUnits = useMemo(() => productionData.reduce((sum, d) => sum + d.units, 0), [productionData]);
  const avgPerDay = Math.round(totalUnits / productionData.length);

  const productionTrend = useMemo(() => {
    const half = Math.max(1, Math.floor(productionData.length / 2));
    const first = productionData.slice(0, half).reduce((s, d) => s + d.units, 0) / half;
    const rest = productionData.slice(half);
    const second = rest.reduce((s, d) => s + d.units, 0) / (rest.length || 1);
    return first ? Math.round(((second - first) / first) * 100) : 0;
  }, [productionData]);

  const stageCounts = useMemo(
    () => STAGE_META.map((s, i) => ({ ...s, count: ORDERS.filter((o) => o.stage === i).length })),
    []
  );
  const ordersInPipeline = ORDERS.filter((o) => o.stage < 4).length;
  const readyToInvoice = ORDERS.length - ordersInPipeline;

  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.bone, fontFamily: FONT }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0">
        <div
          className="flex items-center justify-between gap-3 px-5 md:px-8 py-4 sticky top-0 z-30 backdrop-blur"
          style={{ background: `${COLORS.bone}F2`, borderBottom: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg btn-secondary shrink-0"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4h12M2 8h12M2 12h12" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{ color: COLORS.ink }}>Overview</h1>
              <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              className="btn-secondary hidden sm:inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, background: COLORS.card }}
            >
              <DownloadIcon /> Export
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-lg"
              style={{ background: COLORS.gold, color: COLORS.ink }}
            >
              <PlusIcon /> <span className="hidden xs:inline">New order</span>
            </button>
            <div className="hidden sm:flex flex-col items-end leading-tight pl-1">
              <span className="text-[13px] font-medium" style={{ color: COLORS.ink }}>Admin</span>
              <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>Administrator</span>
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
              style={{ background: COLORS.ink, color: COLORS.gold, border: `2px solid ${COLORS.goldSoft}` }}
            >
              A
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-[1280px] mx-auto">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="text-[12px] font-medium" style={{ color: COLORS.graphite }}>Production overview for</span>
            <Select value={itemFilter} onChange={setItemFilter} options={ITEMS} />
            <span className="text-[12px] font-medium" style={{ color: COLORS.graphite }}>over</span>
            <Select value={rangeLabel} onChange={setRangeLabel} options={RANGES.map((r) => r.label)} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              index={0}
              icon="units"
              label="Units produced"
              value={totalUnits.toLocaleString()}
              sub={rangeLabel.toLowerCase()}
              trend={productionTrend}
            />
            <StatCard index={1} icon="avg" label="Daily average" value={avgPerDay.toLocaleString()} sub="units / day" />
            <StatCard
              index={2}
              icon="pipeline"
              label="Orders in pipeline"
              value={ordersInPipeline}
              sub={`${readyToInvoice} ready to invoice`}
            />
            <StatCard
              index={3}
              icon="dues"
              label="Total dues outstanding"
              value={`PKR ${TOTAL_DUES.toLocaleString()}`}
              sub="across all departments"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 rounded-2xl p-5 panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: "80ms" }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Production trend</h2>
                  <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>{itemFilter} · {rangeLabel.toLowerCase()}</p>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                  style={{ color: productionTrend >= 0 ? COLORS.green : COLORS.rust, background: productionTrend >= 0 ? COLORS.greenSoft : COLORS.rustSoft }}
                >
                  <TrendGlyph up={productionTrend >= 0} /> {Math.abs(productionTrend)}% vs first half
                </span>
              </div>
              <div style={{ width: "100%", height: 230 }}>
                <ResponsiveContainer>
                  <AreaChart data={productionData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="productionFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.38} />
                        <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: COLORS.ink, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                      labelStyle={{ color: COLORS.bone, marginBottom: 2 }}
                      itemStyle={{ color: COLORS.gold }}
                      cursor={{ stroke: COLORS.gold, strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="units"
                      stroke={COLORS.gold}
                      strokeWidth={2.4}
                      fill="url(#productionFill)"
                      activeDot={{ r: 4.5, fill: COLORS.gold, stroke: COLORS.card, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl p-5 panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: "140ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Dues by department</h2>
                <span className="text-[11px] font-medium" style={{ color: COLORS.graphiteLight }}>PKR {TOTAL_DUES.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-4">
                {DEPARTMENT_DUES.map((d) => {
                  const meta = STAGE_META.find((s) => s.name === d.name);
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-[12px] mb-1.5">
                        <span className="flex items-center gap-2" style={{ color: COLORS.graphite }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: meta?.color || COLORS.gold }} />
                          {d.name}
                        </span>
                        <span style={{ color: COLORS.ink }} className="font-semibold">PKR {d.due.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.boneDim }}>
                        <div
                          className="due-bar h-2 rounded-full"
                          style={{ width: `${(d.due / MAX_DUE) * 100}%`, background: meta?.color || COLORS.gold }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mb-6 fade-in" style={{ animationDelay: "180ms" }}>
            <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Cross-department workflow</h2>
                <p className="text-[12px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                  Every order's journey from cutting to invoicing, in one unified view
                </p>
              </div>
              <span className="text-[11.5px] font-medium px-2.5 py-1 rounded-full" style={{ background: COLORS.boneDim, color: COLORS.graphite }}>
                {ORDERS.length} active orders
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl panel overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div className="hidden sm:flex items-center gap-5 px-5 py-3 text-[10.5px] font-semibold uppercase tracking-wide" style={{ background: COLORS.boneDim, color: COLORS.graphite }}>
                  <span className="w-[210px] shrink-0">Order</span>
                  <span className="flex-1">Progress</span>
                  <span className="w-[150px] shrink-0 text-right">Priority / Due</span>
                </div>
                <div>
                  {ORDERS.map((order, i) => (
                    <OrderRow key={order.id} order={order} index={i} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-5 panel" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <h3 className="text-[13.5px] font-semibold mb-1" style={{ color: COLORS.ink }}>Orders by stage</h3>
                <p className="text-[11.5px] mb-2" style={{ color: COLORS.graphiteLight }}>Where the backlog currently sits</p>
                <div className="relative" style={{ width: "100%", height: 190 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={stageCounts}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {stageCounts.map((s) => (
                          <Cell key={s.name} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: COLORS.ink, border: "none", borderRadius: 10, fontSize: 12, padding: "6px 10px" }}
                        labelStyle={{ color: COLORS.bone }}
                        itemStyle={{ color: COLORS.gold }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-semibold" style={{ color: COLORS.ink }}>{ORDERS.length}</span>
                    <span className="text-[9.5px] uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>orders</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {stageCounts.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2" style={{ color: COLORS.graphite }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className="font-semibold" style={{ color: COLORS.ink }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5 mb-6 panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: "220ms" }}>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h2 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Daily department throughput</h2>
              <div className="flex items-center gap-4 flex-wrap">
                {STAGE_META.slice(0, 4).map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: COLORS.graphite }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[11.5px] mb-3" style={{ color: COLORS.graphiteLight }}>
              Units completed per station, {rangeLabel.toLowerCase()} — how work moves across the floor together
            </p>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={stationData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: COLORS.ink, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                    labelStyle={{ color: COLORS.bone, marginBottom: 2 }}
                  />
                  <Area type="monotone" dataKey="Cutting" stackId="1" stroke={COLORS.graphiteLight} fill={COLORS.graphiteLight} fillOpacity={0.75} />
                  <Area type="monotone" dataKey="Stitching" stackId="1" stroke={COLORS.gold} fill={COLORS.gold} fillOpacity={0.75} />
                  <Area type="monotone" dataKey="Checking" stackId="1" stroke={COLORS.goldDim} fill={COLORS.goldDim} fillOpacity={0.75} />
                  <Area type="monotone" dataKey="Packing" stackId="1" stroke={COLORS.green} fill={COLORS.green} fillOpacity={0.75} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: "260ms" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <h2 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Recent production entries</h2>
              <button
                type="button"
                className="btn-link text-[12px] font-semibold"
                style={{ color: COLORS.goldDim }}
              >
                View all
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ background: COLORS.boneDim }}>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Date</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Employee</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Station</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Item</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_ENTRIES.map((e, i) => {
                    const av = avatarColor(e.employee);
                    return (
                      <tr key={i} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-5 py-3" style={{ color: COLORS.graphiteLight }}>{e.date}</td>
                        <td className="px-5 py-3 font-medium" style={{ color: COLORS.ink }}>
                          <span className="flex items-center gap-2.5">
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                              style={{ background: av.bg, color: av.fg }}
                            >
                              {initials(e.employee)}
                            </span>
                            {e.employee}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color: COLORS.graphite }}>{e.station}</td>
                        <td className="px-5 py-3" style={{ color: COLORS.graphite }}>{e.item}</td>
                        <td className="px-5 py-3 text-right font-semibold" style={{ color: COLORS.ink }}>{e.qty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(184,135,61,0.45); }
          50% { box-shadow: 0 0 0 5px rgba(184,135,61,0); }
        }
        @keyframes growBar {
          from { width: 0; }
        }

        .fade-in {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .stat-card, .panel, .order-row, .due-bar, .btn-primary, .btn-secondary, .btn-link, .tbl-row {
          transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, color .18s ease;
        }

        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 28px -18px rgba(28,25,23,0.28);
          border-color: ${COLORS.gold} !important;
        }

        .panel:hover {
          box-shadow: 0 10px 26px -18px rgba(28,25,23,0.22);
        }

        .order-row:hover {
          background: ${COLORS.boneDim}66;
        }

        .due-bar {
          animation: growBar 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .stage-dot-active {
          animation: pulseRing 1.8s ease-in-out infinite;
        }

        .tbl-row:hover {
          background: ${COLORS.boneDim}77;
        }

        .btn-primary:hover {
          background: ${COLORS.goldDim} !important;
          transform: translateY(-1px);
          box-shadow: 0 8px 18px -8px rgba(184,135,61,0.55);
        }
        .btn-primary:active { transform: translateY(0); }

        .btn-secondary:hover {
          border-color: ${COLORS.gold} !important;
          color: ${COLORS.goldDim} !important;
          background: ${COLORS.goldSoft}55 !important;
        }

        .btn-link { background: none; border: none; cursor: pointer; padding: 0; }
        .btn-link:hover { color: ${COLORS.gold} !important; text-decoration: underline; }

        button:focus-visible, select:focus-visible {
          outline: 2px solid ${COLORS.gold};
          outline-offset: 2px;
        }

        .select-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .select-wrap select {
          appearance: none;
          font-family: ${FONT};
          font-size: 12.5px;
          font-weight: 500;
          color: ${COLORS.ink};
          background: ${COLORS.card};
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          padding: 7px 28px 7px 12px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .select-wrap select:hover, .select-wrap select:focus {
          border-color: ${COLORS.gold};
          box-shadow: 0 0 0 3px ${COLORS.goldSoft}66;
        }
        .select-caret {
          position: absolute;
          right: 10px;
          pointer-events: none;
        }

        .nav-item {
          transition: background .18s ease, transform .18s ease, color .18s ease;
        }
        .nav-item:hover:not(:disabled) {
          background: ${COLORS.inkSoft} !important;
          transform: translateX(2px);
        }

        table th, table td { white-space: nowrap; }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.boneBorder}; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.graphiteLight}; }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .stage-dot-active, .due-bar, .stat-card, .panel, .order-row, .btn-primary, .btn-secondary {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}