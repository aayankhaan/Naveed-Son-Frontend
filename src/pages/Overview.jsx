// ========================================
// Overview.jsx
// Real dashboard: production, dues by station, order pipeline, recent entries.
// ========================================

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FONT, COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import SectionHeader from "../components/ui/SectionHeader";
import Panel from "../components/ui/Panel";
import Toolbar from "../components/ui/Toolbar";
import EmptyState from "../components/ui/EmptyState";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

function formatRangeLabel(from, to) {
  if (!from || !to) return "";
  const fmt = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

const STAGE_META = [
  { name: "Cutting", color: COLORS.graphiteLight },
  { name: "Stitching", color: COLORS.gold },
  { name: "Checking", color: COLORS.goldDim },
  { name: "Packing", color: COLORS.green },
  { name: "Invoicing", color: COLORS.rust },
];

const STAGE_COLORS = Object.fromEntries(STAGE_META.map((s) => [s.name, s.color]));

const AVATAR_PALETTE = [
  { bg: COLORS.goldSoft, fg: COLORS.goldDim },
  { bg: COLORS.greenSoft, fg: COLORS.green },
  { bg: COLORS.rustSoft, fg: COLORS.rust },
  { bg: COLORS.boneDim, fg: COLORS.graphite },
];

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function formatPKR(n) {
  return `PKR ${Math.round(Number(n) || 0).toLocaleString()}`;
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function avatarColor(name) {
  const sum = String(name || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
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
    case "revenue":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 4.5v7M6.2 6.2c0-.9.8-1.5 1.8-1.5s1.8.5 1.8 1.3c0 1.8-3.6.8-3.6 2.6 0 .8.9 1.3 1.8 1.3s1.8-.5 1.8-1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "labor":
      return (
        <svg {...common}>
          <circle cx="6" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2.2 13.5c.5-2.6 2-4 3.8-4s3.3 1.4 3.8 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M11 7.5h3M12.5 6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "profit":
      return (
        <svg {...common}>
          <path d="M2 12.5l4-4.5 2.5 2.5L14 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 4H14v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
        {trend !== undefined && trend !== null && (
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
            {order.pack_percent != null ? ` · ${order.pack_percent}% packed` : ""}
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
            Ordered
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
  const { canWrite } = useAuth();
  const [itemFilter, setItemFilter] = useState("All items");
  const [fromDate, setFromDate] = useState(() => daysAgoISO(7));
  const [toDate, setToDate] = useState(() => todayISO());
  const [appliedFrom, setAppliedFrom] = useState(() => daysAgoISO(7));
  const [appliedTo, setAppliedTo] = useState(() => todayISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [dashMode, setDashMode] = useState("profit"); // profit (default) | production

  const rangeLabel = formatRangeLabel(appliedFrom, appliedTo);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        from: appliedFrom,
        to: appliedTo,
      });
      if (itemFilter && itemFilter !== "All items") qs.set("article", itemFilter);
      const res = await apiFetch(`/api/overview?${qs}`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load overview"));
      setData(await res.json());
    } catch (err) {
      setError(err.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, itemFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function applyDateRange() {
    if (!fromDate || !toDate) {
      setError("Pick both From and To dates");
      return;
    }
    if (fromDate > toDate) {
      setError("From date must be on or before To date");
      return;
    }
    setError("");
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  }

  function applyPreset(days) {
    const from = daysAgoISO(days);
    const to = todayISO();
    setFromDate(from);
    setToDate(to);
    setAppliedFrom(from);
    setAppliedTo(to);
    setError("");
  }

  const articleOptions = useMemo(() => {
    const opts = data?.article_options?.length ? data.article_options : ["All items"];
    if (itemFilter !== "All items" && !opts.includes(itemFilter)) {
      return [...opts, itemFilter];
    }
    return opts;
  }, [data, itemFilter]);

  const productionData = data?.production_by_day || [];
  const stationData = data?.station_by_day || [];
  const summary = data?.summary;
  const productionTrend = summary?.production_trend ?? 0;
  const dues = data?.dues_by_station || [];
  const totalDues = summary?.total_dues || 0;
  const maxDue = Math.max(1, ...dues.map((d) => d.due || 0));
  const profit = data?.profit || {};
  const profitByDay = data?.profit_by_day || [];
  const laborSpent = Number(profit.labor_cost) || Number(profit.labor_paid) || 0;
  const ongoingProfit = Math.round(((Number(profit.revenue) || 0) - laborSpent) * 100) / 100;
  const profitMix = useMemo(() => {
    const rev = Number(profit.revenue) || 0;
    const lab = laborSpent;
    if (rev <= 0 && lab <= 0) return [];
    return [
      { name: "Revenue", value: rev, color: COLORS.green },
      { name: "Labor", value: lab, color: COLORS.rust },
    ].filter((x) => x.value > 0);
  }, [profit.revenue, laborSpent]);
  const orders = data?.pipeline_orders || [];
  const stageCounts = useMemo(
    () =>
      (data?.stage_counts || STAGE_META.map((s) => ({ name: s.name, count: 0 }))).map((s) => ({
        ...s,
        color: STAGE_COLORS[s.name] || COLORS.gold,
      })),
    [data]
  );
  const recent = data?.recent_entries || [];

  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <AppShell
      title="Overview"
      subtitle={todayLabel}
      actions={
        <>
          <button
            type="button"
            className="btn-secondary hidden sm:inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 py-2 rounded-xl"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, background: COLORS.card }}
            onClick={load}
          >
            Refresh
          </button>
          {canWrite ? (
            <Link
              to="/orders"
              className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-xl no-underline"
              style={{ background: COLORS.gold, color: COLORS.inkSurface }}
            >
              <PlusIcon /> New order
            </Link>
          ) : null}
        </>
      }
    >
          {error && (
            <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {[
              { to: "/daily-entry", title: "Log today’s work", sub: "Bulk daily entry", tone: COLORS.gold },
              { to: "/orders", title: "Floor orders", sub: `${summary?.orders_in_pipeline ?? "—"} in pipeline`, tone: COLORS.green },
              { to: "/payouts", title: "Settle pay", sub: formatPKR(totalDues) + " outstanding", tone: COLORS.rust },
            ].map((a) => (
              <Link key={a.to} to={a.to} className="quick-action">
                <span className="w-2 h-8 rounded-full shrink-0" style={{ background: a.tone }} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold" style={{ color: COLORS.ink }}>{a.title}</span>
                  <span className="block text-[11.5px] truncate" style={{ color: COLORS.graphiteLight }}>{a.sub}</span>
                </span>
              </Link>
            ))}
          </div>

          <Toolbar meta={rangeLabel ? `Showing ${rangeLabel}` : null}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: COLORS.graphite }}>Item</span>
              <Select value={itemFilter} onChange={setItemFilter} options={articleOptions} />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.graphite }}>From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="ov-date" />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.graphite }}>To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="ov-date" />
            </div>
            <button
              type="button"
              className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-xl self-end"
              style={{ background: COLORS.inkSurface, color: COLORS.gold }}
              onClick={applyDateRange}
            >
              Apply
            </button>
            <div className="flex flex-wrap gap-1.5 self-end">
              {[
                { days: 7, label: "7d" },
                { days: 14, label: "14d" },
                { days: 30, label: "30d" },
              ].map((p) => {
                const active = appliedFrom === daysAgoISO(p.days) && appliedTo === todayISO();
                return (
                  <button
                    key={p.days}
                    type="button"
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: active ? COLORS.goldSoft : COLORS.boneDim,
                      color: active ? COLORS.goldDim : COLORS.graphite,
                    }}
                    onClick={() => applyPreset(p.days)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Toolbar>

          <div className="flex items-center gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            {[
              { id: "profit", label: "Profit" },
              { id: "production", label: "Production" },
            ].map((m) => {
              const active = dashMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDashMode(m.id)}
                  className="text-[12.5px] font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{
                    background: active ? COLORS.card : "transparent",
                    color: active ? COLORS.ink : COLORS.graphite,
                    boxShadow: active ? `0 1px 3px rgba(0,0,0,0.06)` : "none",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {loading && !data ? (
            <div className="rounded-2xl h-40 animate-pulse mb-6" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
          ) : dashMode === "profit" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatCard
                  index={0}
                  icon="revenue"
                  label="Made from orders"
                  value={formatPKR(profit.revenue || 0)}
                  sub={
                    profit.revenue_expenses
                      ? `goods ${formatPKR(profit.revenue_goods || 0)} + expenses ${formatPKR(profit.revenue_expenses)}`
                      : `${profit.shipped_atms || 0} shipped ATM(s)`
                  }
                />
                <StatCard
                  index={1}
                  icon="labor"
                  label="Spent on labor"
                  value={formatPKR(laborSpent)}
                  sub={`paid ${formatPKR(profit.labor_paid || 0)} · still owed ${formatPKR(profit.labor_unpaid || 0)}`}
                />
                <StatCard
                  index={2}
                  icon="profit"
                  label="Ongoing profit"
                  value={formatPKR(ongoingProfit)}
                  sub="revenue − labor (paid + owed)"
                />
              </div>

              <SectionHeader
                title="Money in the period"
                description={`Invoice revenue vs labor payouts · ${rangeLabel || "selected range"}`}
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
                <Panel className="lg:col-span-2" delay={80}>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Profit trend</h3>
                      <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                        By ship date (revenue) &amp; pay date (labor)
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{
                        color: ongoingProfit >= 0 ? COLORS.green : COLORS.rust,
                        background: ongoingProfit >= 0 ? COLORS.greenSoft : COLORS.rustSoft,
                      }}
                    >
                      {ongoingProfit >= 0 ? "In the black" : "In the red"} · {formatPKR(Math.abs(ongoingProfit))}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 250 }}>
                    {profitByDay.some((d) => d.revenue > 0 || d.labor > 0) ? (
                      <ResponsiveContainer>
                        <AreaChart data={profitByDay} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                          <defs>
                            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="laborFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={COLORS.rust} stopOpacity={0.28} />
                              <stop offset="100%" stopColor={COLORS.rust} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                          <Tooltip
                            contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                            labelStyle={{ color: COLORS.bone, marginBottom: 2 }}
                            formatter={(value, name) => [formatPKR(value), name]}
                            cursor={{ stroke: COLORS.gold, strokeWidth: 1, strokeDasharray: "3 3" }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 8 }} />
                          <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.green} strokeWidth={2.2} fill="url(#profitFill)" />
                          <Area type="monotone" dataKey="labor" name="Labor paid" stroke={COLORS.rust} strokeWidth={2.2} fill="url(#laborFill)" />
                          <Area type="monotone" dataKey="profit" name="Day profit" stroke={COLORS.gold} strokeWidth={2} fill="none" strokeDasharray="4 3" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="No money movement yet" description="Ship orders or pay labor in this range to see the chart." />
                    )}
                  </div>
                </Panel>

                <Panel delay={140}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>All-time split</h3>
                  </div>
                  <div className="relative" style={{ width: "100%", height: 180 }}>
                    {profitMix.length > 0 ? (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={profitMix}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={52}
                            outerRadius={74}
                            paddingAngle={3}
                            stroke="none"
                          >
                            {profitMix.map((s) => (
                              <Cell key={s.name} fill={s.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 12, padding: "6px 10px" }}
                            formatter={(value) => formatPKR(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : null}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[11px] uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>Net</span>
                      <span className="text-lg font-semibold" style={{ color: ongoingProfit >= 0 ? COLORS.green : COLORS.rust }}>
                        {formatPKR(ongoingProfit)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-1">
                    {[
                      { label: "Revenue", value: profit.revenue || 0, color: COLORS.green },
                      { label: "Labor spent", value: laborSpent, color: COLORS.rust },
                      { label: "Still owed", value: profit.labor_unpaid || 0, color: COLORS.goldDim },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-2" style={{ color: COLORS.graphite }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                          {row.label}
                        </span>
                        <span className="font-semibold" style={{ color: COLORS.ink }}>{formatPKR(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <SectionHeader
                title="Daily cash"
                description="Revenue booked vs labor paid each day"
              />
              <Panel className="mb-7" delay={180}>
                <div style={{ width: "100%", height: 220 }}>
                  {profitByDay.some((d) => d.revenue > 0 || d.labor > 0) ? (
                    <ResponsiveContainer>
                      <BarChart data={profitByDay} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <Tooltip
                          contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                          labelStyle={{ color: COLORS.bone, marginBottom: 2 }}
                          formatter={(value, name) => [formatPKR(value), name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 8 }} />
                        <Bar dataKey="revenue" name="Revenue" fill={COLORS.green} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="labor" name="Labor paid" fill={COLORS.rust} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="Nothing in range" description="Pick a wider date range or ship / pay first." />
                  )}
                </div>
              </Panel>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                {[
                  { to: "/orders", title: "Ship & invoice", sub: "Lock in revenue", tone: COLORS.green },
                  { to: "/payouts", title: "Pay labor", sub: formatPKR(profit.labor_unpaid || 0) + " still owed", tone: COLORS.rust },
                  { to: "/expenses", title: "ATM expenses", sub: "Food & floor costs", tone: COLORS.gold },
                ].map((a) => (
                  <Link key={a.to} to={a.to} className="quick-action">
                    <span className="w-2 h-8 rounded-full shrink-0" style={{ background: a.tone }} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold" style={{ color: COLORS.ink }}>{a.title}</span>
                      <span className="block text-[11.5px] truncate" style={{ color: COLORS.graphiteLight }}>{a.sub}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  index={0}
                  icon="units"
                  label="Units produced"
                  value={(summary?.units_produced || 0).toLocaleString()}
                  sub={rangeLabel || "selected period"}
                  trend={productionTrend}
                />
                <StatCard
                  index={1}
                  icon="avg"
                  label="Daily average"
                  value={(summary?.daily_average || 0).toLocaleString()}
                  sub="units / day in range"
                />
                <StatCard
                  index={2}
                  icon="pipeline"
                  label="Orders in pipeline"
                  value={summary?.orders_in_pipeline ?? 0}
                  sub={`${summary?.ready_to_invoice ?? 0} ready to invoice`}
                />
                <StatCard
                  index={3}
                  icon="dues"
                  label="Total dues outstanding"
                  value={formatPKR(totalDues)}
                  sub="unpaid after shipment"
                />
              </div>

              <SectionHeader
                title="Production pulse"
                description="Units logged across the selected range"
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
                <Panel className="lg:col-span-2" delay={80}>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Trend</h3>
                      <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                        {itemFilter} · {rangeLabel}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{
                        color: productionTrend >= 0 ? COLORS.green : COLORS.rust,
                        background: productionTrend >= 0 ? COLORS.greenSoft : COLORS.rustSoft,
                      }}
                    >
                      <TrendGlyph up={productionTrend >= 0} /> {Math.abs(productionTrend)}% vs first half
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 230 }}>
                    {productionData.some((d) => d.units > 0) ? (
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
                            contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
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
                    ) : (
                      <EmptyState title="No production yet" description="Nothing logged in this range." />
                    )}
                  </div>
                </Panel>

                <Panel delay={140}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Dues by department</h3>
                    <span className="text-[11px] font-medium" style={{ color: COLORS.graphiteLight }}>{formatPKR(totalDues)}</span>
                  </div>
                  {dues.every((d) => !d.due) ? (
                    <EmptyState title="All clear" description="No unpaid settlements yet. Ship orders to unlock payables." />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {dues.map((d) => {
                        const meta = STAGE_META.find((s) => s.name === d.name);
                        return (
                          <div key={d.name}>
                            <div className="flex items-center justify-between text-[12px] mb-1.5">
                              <span className="flex items-center gap-2" style={{ color: COLORS.graphite }}>
                                <span className="w-2 h-2 rounded-full" style={{ background: meta?.color || COLORS.gold }} />
                                {d.name}
                              </span>
                              <span style={{ color: COLORS.ink }} className="font-semibold">{formatPKR(d.due)}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.boneDim }}>
                              <div
                                className="due-bar h-2 rounded-full"
                                style={{ width: `${(d.due / maxDue) * 100}%`, background: meta?.color || COLORS.gold }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Link
                    to="/payouts"
                    className="inline-block mt-4 text-[12px] font-semibold no-underline"
                    style={{ color: COLORS.goldDim }}
                  >
                    Open payouts →
                  </Link>
                </Panel>
              </div>

              <div className="mb-7 fade-in" style={{ animationDelay: "180ms" }}>
                <SectionHeader
                  title="Order pipeline"
                  description="Active orders from cutting through invoicing"
                  action={
                    <Link
                      to="/orders"
                      className="text-[11.5px] font-medium px-2.5 py-1 rounded-full no-underline"
                      style={{ background: COLORS.boneDim, color: COLORS.graphite }}
                    >
                      {summary?.orders_active ?? orders.length} active
                    </Link>
                  }
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Panel className="lg:col-span-2" padded={false}>
                    <div className="hidden sm:flex items-center gap-5 px-5 py-3 text-[10.5px] font-semibold uppercase tracking-wide" style={{ background: COLORS.boneDim, color: COLORS.graphite }}>
                      <span className="w-[210px] shrink-0">Order</span>
                      <span className="flex-1">Progress</span>
                      <span className="w-[150px] shrink-0 text-right">Priority / Ordered</span>
                    </div>
                    <div>
                      {orders.length === 0 ? (
                        <EmptyState title="Pipeline is clear" description="No active orders right now." />
                      ) : (
                        orders.map((order, i) => (
                          <OrderRow key={order.order_id || order.id} order={order} index={i} />
                        ))
                      )}
                    </div>
                  </Panel>

                  <Panel>
                    <h3 className="text-[13.5px] font-semibold mb-1" style={{ color: COLORS.ink }}>Orders by stage</h3>
                    <p className="text-[11.5px] mb-2" style={{ color: COLORS.graphiteLight }}>Where the backlog currently sits</p>
                    <div className="relative" style={{ width: "100%", height: 190 }}>
                      {stageCounts.some((s) => s.count > 0) ? (
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={stageCounts.filter((s) => s.count > 0)}
                              dataKey="count"
                              nameKey="name"
                              innerRadius={54}
                              outerRadius={78}
                              paddingAngle={3}
                              stroke="none"
                            >
                              {stageCounts.filter((s) => s.count > 0).map((s) => (
                                <Cell key={s.name} fill={s.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 12, padding: "6px 10px" }}
                              labelStyle={{ color: COLORS.bone }}
                              itemStyle={{ color: COLORS.gold }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : null}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
                          {summary?.orders_active ?? 0}
                        </span>
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
                  </Panel>
                </div>
              </div>

              <SectionHeader
                title="Station throughput"
                description={`Units completed per station · ${rangeLabel || "selected range"}${itemFilter !== "All items" ? ` · ${itemFilter}` : ""}`}
              />
              <Panel className="mb-7" delay={220}>
                <div className="flex items-center justify-end mb-3 flex-wrap gap-3">
                  {STAGE_META.slice(0, 4).map((s) => (
                    <span key={s.name} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: COLORS.graphite }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  ))}
                </div>
                <div style={{ width: "100%", height: 220 }}>
                  {stationData.some((d) => d.Cutting || d.Stitching || d.Checking || d.Packing) ? (
                    <ResponsiveContainer>
                      <AreaChart data={stationData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                          labelStyle={{ color: COLORS.bone, marginBottom: 2 }}
                        />
                        <Area type="monotone" dataKey="Cutting" stackId="1" stroke={COLORS.graphiteLight} fill={COLORS.graphiteLight} fillOpacity={0.75} />
                        <Area type="monotone" dataKey="Stitching" stackId="1" stroke={COLORS.gold} fill={COLORS.gold} fillOpacity={0.75} />
                        <Area type="monotone" dataKey="Checking" stackId="1" stroke={COLORS.goldDim} fill={COLORS.goldDim} fillOpacity={0.75} />
                        <Area type="monotone" dataKey="Packing" stackId="1" stroke={COLORS.green} fill={COLORS.green} fillOpacity={0.75} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="No throughput" description="No station units in this range." />
                  )}
                </div>
              </Panel>

              <SectionHeader
                title="Recent entries"
                description="Latest floor logs in this range"
                action={
                  <Link to="/daily-entry" className="btn-link text-[12px] font-semibold no-underline" style={{ color: COLORS.goldDim }}>
                    Open daily entry →
                  </Link>
                }
              />
              <Panel padded={false} delay={260}>
                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <span className="text-[12px]" style={{ color: COLORS.graphiteLight }}>Most recent first</span>
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
                      {recent.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center" style={{ color: COLORS.graphiteLight }}>
                            No entries in this range.
                          </td>
                        </tr>
                      ) : (
                        recent.map((e) => {
                          const av = avatarColor(e.employee);
                          return (
                            <tr key={e.log_id} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}` }}>
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
                              <td className="px-5 py-3 text-right font-semibold" style={{ color: COLORS.ink }}>
                                {e.leave ? "—" : e.qty}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}

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

        .ov-date {
          font-family: ${FONT};
          font-size: 12.5px;
          color: ${COLORS.ink};
          background: ${COLORS.bone};
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          padding: 7px 10px;
          outline: none;
          min-width: 150px;
        }
        .ov-date:hover, .ov-date:focus {
          border-color: ${COLORS.gold};
          box-shadow: 0 0 0 3px ${COLORS.goldSoft}66;
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
    </AppShell>
  );
}
