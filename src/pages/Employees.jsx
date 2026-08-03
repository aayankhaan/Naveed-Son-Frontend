// ========================================
// Employees.jsx
// Employee roster with piece-rate pay, installment deductions,
// employee earnings/work-log modal, and full CRUD (Add/Edit/Delete).
// ========================================

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, ChevronIcon, CloseIcon, SparkIcon } from "../components/icons/CommonIcons";
import { API_BASE, apiFetch } from "../lib/api";

// Turns a relative "/uploads/xyz.jpg" path from the backend into a full URL
// the browser can actually load. Leaves absolute URLs and blob: previews as-is.
function getImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_BASE}${path}`;
}

const STATION_META = [
  { name: "Cutting", color: COLORS.graphiteLight },
  { name: "Stitching", color: COLORS.gold },
  { name: "Checking", color: COLORS.goldDim },
  { name: "Packing", color: COLORS.green },
];
const STATION_COLOR = Object.fromEntries(STATION_META.map((s) => [s.name, s.color]));

const ITEM_META = [
  { name: "Bedsheet — King", color: COLORS.gold },
  { name: "Bedsheet — Queen", color: COLORS.goldDim },
  { name: "Pillow cover", color: COLORS.green },
  { name: "Cushion cover", color: COLORS.rust },
];

const RATE_CARD = {
  Cutting: { "Bedsheet — King": 2.5, "Bedsheet — Queen": 2, "Pillow cover": 1, "Cushion cover": 1.2 },
  Stitching: { "Bedsheet — King": 5, "Bedsheet — Queen": 4, "Pillow cover": 2, "Cushion cover": 2.5 },
  Checking: { "Bedsheet — King": 1.5, "Bedsheet — Queen": 1.2, "Pillow cover": 0.6, "Cushion cover": 0.8 },
  Packing: { "Bedsheet — King": 1, "Bedsheet — Queen": 0.8, "Pillow cover": 0.5, "Cushion cover": 0.6 },
};

const STATION_QTY_RANGE = {
  Cutting: [150, 260],
  Stitching: [60, 110],
  Checking: [180, 260],
  Packing: [120, 200],
};

const PAY_CYCLE_DAYS = 15;

const INSTALLMENTS = {
  "EMP-101": { principal: 100000, percent: 50, paidSoFar: 40000 },
  "EMP-103": { principal: 50000, percent: 50, paidSoFar: 0 },
  "EMP-108": { principal: 30000, percent: 30, paidSoFar: 15000 },
};

function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildWorkLog(employee, days = PAY_CYCLE_DAYS) {
  const seed = employee.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const rand = seedRandom(seed);
  const rates = RATE_CARD[employee.station] || RATE_CARD["Stitching"];
  const [qMin, qMax] = STATION_QTY_RANGE[employee.station] || STATION_QTY_RANGE["Stitching"];
  const today = new Date();
  const log = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const r = rand();
    const item =
      r < 0.4 ? "Bedsheet — King" : r < 0.65 ? "Bedsheet — Queen" : r < 0.85 ? "Pillow cover" : "Cushion cover";
    const qty = Math.round(qMin + rand() * (qMax - qMin));
    const rate = rates[item] || 1;
    log.push({ date: label, item, qty, rate, amount: Math.round(qty * rate) });
  }
  return log;
}

function buildEmployee(base) {
  const workLog = buildWorkLog(base);
  const gross = workLog.reduce((s, e) => s + e.amount, 0);
  const units = workLog.reduce((s, e) => s + e.qty, 0);
  const installment = INSTALLMENTS[base.id] || null;
  const balanceBefore = installment ? Math.max(0, installment.principal - installment.paidSoFar) : 0;
  const perCycleDeduction = installment ? Math.min(balanceBefore, Math.round((gross * installment.percent) / 100)) : 0;
  const remainingBalance = installment ? balanceBefore - perCycleDeduction : 0;
  const paidPct = installment ? Math.round(((installment.principal - remainingBalance) / installment.principal) * 100) : 0;
  const netDue = Math.max(0, gross - perCycleDeduction);
  const breakdown = ITEM_META.map((it) => ({
    name: it.name,
    color: it.color,
    value: workLog.filter((e) => e.item === it.name).reduce((s, e) => s + e.amount, 0),
  })).filter((it) => it.value > 0);

  return { ...base, workLog, gross, units, installment, remainingBalance, perCycleDeduction, paidPct, netDue, breakdown };
}

function initials(name) {
  if (!name) return "E";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

// ---- Pakistan phone number: 03XX-XXXXXXX (11 digits, starts with 03) ----
function formatPakPhone(raw) {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function isValidPakPhone(value) {
  const digits = (value || "").replace(/\D/g, "");
  return /^03\d{9}$/.test(digits);
}

// ---- Pakistan CNIC: XXXXX-XXXXXXX-X (13 digits) ----
function formatCNIC(raw) {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 13);
  let out = digits.slice(0, 5);
  if (digits.length > 5) out += `-${digits.slice(5, 12)}`;
  if (digits.length > 12) out += `-${digits.slice(12, 13)}`;
  return out;
}

function isValidCNIC(value) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length === 13;
}

// ---- Date <-> "DD-MM-YY" display format ----
function isoToDMY(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y.slice(2)}`;
}

function dmyToISO(dmy) {
  if (!dmy) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(dmy)) return dmy.slice(0, 10);
  const parts = dmy.split("-");
  if (parts.length !== 3) return "";
  let [d, m, y] = parts;
  if (!/^\d+$/.test(d) || !/^\d+$/.test(m) || !/^\d+$/.test(y)) return "";
  if (y.length === 2) y = `20${y}`;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M10.1 1.9a1.4 1.4 0 0 1 2 2L4.5 11.5 1.5 12.5l1-3L10.1 1.9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.6 8.2c0 .5.5.8 1 .8h3.8c.5 0 .9-.3 1-.8L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.7 14c.6-3 2.4-4.6 4.3-4.6S10 11 10.6 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="11.5" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.8 9.6c1.8.2 3 1.6 3.4 3.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function BanknoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8.25" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.3 6v.01M12.7 10.5v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function LoanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13V6.5L8 2l6 4.5V13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.5 13V9h5v4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function CoinsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse cx="6" cy="4.3" rx="4.2" ry="2.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.8 4.3v4c0 1.3 1.9 2.3 4.2 2.3s4.2-1 4.2-2.3v-4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.8 8.3v3c0 1.3 1.9 2.3 4.2 2.3.7 0 1.4-.1 2-.3" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="11" cy="8.8" rx="3.2" ry="1.7" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.2" width="12" height="10.8" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6.4h12M5 1.7v2.4M11 1.7v2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function StationBadge({ station }) {
  const color = STATION_COLOR[station] || COLORS.gold;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap"
      style={{ background: COLORS.boneDim, color: COLORS.graphite }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {station}
    </span>
  );
}

function InstallmentBadge({ employee }) {
  if (!employee.installment) {
    return (
      <span className="text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ background: COLORS.boneDim, color: COLORS.graphiteLight }}>
        No installment
      </span>
    );
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
      {formatPKR(employee.remainingBalance)} left
    </span>
  );
}

function EmployeeRow({ employee, index, onOpen, onEdit, onDelete }) {
  return (
    <tr className="tbl-row cursor-pointer" style={{ borderTop: `1px solid ${COLORS.border}` }} onClick={() => onOpen(employee)}>
      <td className="px-5 py-3.5">
        <span className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 overflow-hidden"
            style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
          >
            {employee.image ? (
              <img src={getImageUrl(employee.image)} alt={employee.name} className="w-full h-full object-cover" />
            ) : (
              initials(employee.name)
            )}
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>{employee.name}</span>
            <span className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: COLORS.graphiteLight }}>
              <span>{employee.id}</span>
              {employee.cnic && employee.cnic !== "—" && (
                <>
                  <span>·</span>
                  <span>CNIC: {employee.cnic}</span>
                </>
              )}
              {employee.phone && employee.phone !== "—" && (
                <>
                  <span>·</span>
                  <span>Ph: {employee.phone}</span>
                </>
              )}
            </span>
          </span>
        </span>
      </td>
      <td className="px-5 py-3.5"><StationBadge station={employee.station} /></td>
      <td className="px-5 py-3.5 text-right" style={{ color: COLORS.graphite }}>{employee.units.toLocaleString()}</td>
      <td className="px-5 py-3.5 text-right font-medium" style={{ color: COLORS.ink }}>{formatPKR(employee.gross)}</td>
      <td className="px-5 py-3.5"><InstallmentBadge employee={employee} /></td>
      <td className="px-5 py-3.5 text-right font-semibold" style={{ color: employee.netDue > 0 ? COLORS.rust : COLORS.green }}>
        {formatPKR(employee.netDue)}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-secondary p-1.5 rounded-lg shrink-0"
            title="Edit employee"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            onClick={() => onEdit(employee)}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="btn-secondary p-1.5 rounded-lg shrink-0"
            title="Delete employee"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust, background: COLORS.rustSoft }}
            onClick={() => onDelete(employee)}
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg shrink-0 text-graphiteLight"
            title="View details"
            style={{ color: COLORS.graphiteLight }}
            onClick={() => onOpen(employee)}
          >
            <ChevronIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmployeeModal({ employee, onClose, onEdit, onDelete }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!employee) return null;

  const chartData = employee.workLog.map((e) => ({ date: e.date, amount: e.amount }));

  return (
    <div className="modal-overlay fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5 sticky top-0 z-10" style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0 overflow-hidden" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
              {employee.image ? (
                <img src={getImageUrl(employee.image)} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                initials(employee.name)
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold truncate" style={{ color: COLORS.ink }}>{employee.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StationBadge station={employee.station} />
                <span className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
                  {employee.id} · Joined {employee.joined}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11.5px] flex-wrap" style={{ color: COLORS.graphite }}>
                {employee.cnic && employee.cnic !== "—" && <span>CNIC: <strong>{employee.cnic}</strong></span>}
                {employee.phone && employee.phone !== "—" && <span>Phone: <strong>{employee.phone}</strong></span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn-secondary text-[12px] font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={() => {
                onClose();
                onEdit(employee);
              }}
            >
              <PencilIcon /> Edit
            </button>
            <button
              type="button"
              className="btn-secondary text-[12px] font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust, background: COLORS.rustSoft }}
              onClick={() => {
                onClose();
                onDelete(employee);
              }}
            >
              <TrashIcon /> Delete
            </button>
            <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Units this cycle</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{employee.units.toLocaleString()}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Gross earned</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{formatPKR(employee.gross)}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Installment deducted</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: employee.perCycleDeduction ? COLORS.rust : COLORS.ink }}>
                {employee.perCycleDeduction ? `− ${formatPKR(employee.perCycleDeduction)}` : "—"}
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.goldSoft }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>Net due now</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{formatPKR(employee.netDue)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-3 rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: COLORS.ink }}>Earnings this cycle</h3>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="empEarnFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.38} />
                        <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: COLORS.ink, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                      labelStyle={{ color: COLORS.bone }}
                      itemStyle={{ color: COLORS.gold }}
                      formatter={(v) => [`PKR ${v.toLocaleString()}`, "Earned"]}
                    />
                    <Area type="monotone" dataKey="amount" stroke={COLORS.gold} strokeWidth={2.2} fill="url(#empEarnFill)" activeDot={{ r: 4, fill: COLORS.gold, stroke: COLORS.card, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <h3 className="text-[13px] font-semibold mb-1" style={{ color: COLORS.ink }}>Work breakdown</h3>
              <p className="text-[11px] mb-1" style={{ color: COLORS.graphiteLight }}>By item, this cycle</p>
              <div className="relative" style={{ width: "100%", height: 150 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={employee.breakdown} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={3} stroke="none">
                      {employee.breakdown.map((it) => (
                        <Cell key={it.name} fill={it.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: COLORS.ink, border: "none", borderRadius: 10, fontSize: 11, padding: "6px 10px" }}
                      labelStyle={{ color: COLORS.bone }}
                      formatter={(v) => [`PKR ${v.toLocaleString()}`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {employee.breakdown.map((it) => (
                  <div key={it.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 truncate" style={{ color: COLORS.graphite }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: it.color }} />
                      <span className="truncate">{it.name}</span>
                    </span>
                    <span className="font-semibold shrink-0" style={{ color: COLORS.ink }}>{formatPKR(it.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5 mb-6" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>Quality Control (QC) &amp; Defect Audit</h3>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
                98.5% Pass Rate
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11.5px]">
              <div>
                <span className="text-[10px] uppercase font-semibold block" style={{ color: COLORS.graphiteLight }}>Inspected Output</span>
                <strong style={{ color: COLORS.ink }}>{(employee.units * 1.02).toFixed(0)} pcs</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold block" style={{ color: COLORS.graphiteLight }}>Passed Units</span>
                <strong style={{ color: COLORS.ink }}>{employee.units.toLocaleString()} pcs</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold block" style={{ color: COLORS.graphiteLight }}>Defects / Rework</span>
                <strong style={{ color: COLORS.goldDim }}>{Math.round(employee.units * 0.015)} pcs</strong>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5 mb-6" style={{ background: employee.installment ? COLORS.rustSoft : COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: COLORS.ink }}>
                <LoanIcon /> Installment
              </h3>
              {!employee.installment && (
                <button type="button" className="btn-link text-[11.5px] font-semibold" style={{ color: COLORS.goldDim }}>
                  + Record installment
                </button>
              )}
            </div>
            {employee.installment ? (
              <>
                <p className="text-[11.5px] mb-3" style={{ color: COLORS.graphite }}>
                  Took {formatPKR(employee.installment.principal)} in advance. {employee.installment.percent}% of gross earnings is deducted every cycle until it's settled — so a light cycle never eats their whole pay.
                </p>
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: `${COLORS.card}` }}>
                  <div className="h-2 rounded-full" style={{ width: `${employee.paidPct}%`, background: COLORS.rust }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  <span style={{ color: COLORS.graphite }}>{employee.paidPct}% repaid</span>
                  <span style={{ color: COLORS.graphite }}>− {formatPKR(employee.perCycleDeduction)} deducted this cycle</span>
                  <span className="font-semibold" style={{ color: COLORS.rust }}>{formatPKR(employee.remainingBalance)} balance left</span>
                </div>
              </>
            ) : (
              <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>No active installment for this employee — nothing is deducted from their pay.</p>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.boneDim }}>
              <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>Work log — this cycle</h3>
            </div>
            <div className="max-h-55 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr>
                    <th className="text-left font-semibold px-5 py-2 uppercase text-[10px] tracking-wide sticky top-0" style={{ color: COLORS.graphite, background: COLORS.card }}>Date</th>
                    <th className="text-left font-semibold px-5 py-2 uppercase text-[10px] tracking-wide sticky top-0" style={{ color: COLORS.graphite, background: COLORS.card }}>Item</th>
                    <th className="text-right font-semibold px-5 py-2 uppercase text-[10px] tracking-wide sticky top-0" style={{ color: COLORS.graphite, background: COLORS.card }}>Qty</th>
                    <th className="text-right font-semibold px-5 py-2 uppercase text-[10px] tracking-wide sticky top-0" style={{ color: COLORS.graphite, background: COLORS.card }}>Rate</th>
                    <th className="text-right font-semibold px-5 py-2 uppercase text-[10px] tracking-wide sticky top-0" style={{ color: COLORS.graphite, background: COLORS.card }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...employee.workLog].reverse().map((e, i) => (
                    <tr key={i} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-5 py-2.5" style={{ color: COLORS.graphiteLight }}>{e.date}</td>
                      <td className="px-5 py-2.5" style={{ color: COLORS.graphite }}>{e.item}</td>
                      <td className="px-5 py-2.5 text-right" style={{ color: COLORS.graphite }}>{e.qty}</td>
                      <td className="px-5 py-2.5 text-right" style={{ color: COLORS.graphiteLight }}>PKR {e.rate}</td>
                      <td className="px-5 py-2.5 text-right font-medium" style={{ color: COLORS.ink }}>{formatPKR(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 px-6 py-4" style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2 text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
            <CalendarIcon /> Paid every {PAY_CYCLE_DAYS} days
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12.5px]" style={{ color: COLORS.graphite }}>Net payable</span>
            <span className="text-[18px] font-semibold" style={{ color: COLORS.ink }}>{formatPKR(employee.netDue)}</span>
            <button type="button" className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.ink }}>
              Record payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddEditEmployeeModal({ employee, onClose, onSave }) {
  const isEditing = Boolean(employee?.id);
  const [name, setName] = useState(employee?.name || "");
  const [cnic, setCnic] = useState(employee?.cnic || "");
  const [phone, setPhone] = useState(employee?.phone || "");
  const [station, setStation] = useState(employee?.station || "Stitching");
  const [joinedISO, setJoinedISO] = useState(dmyToISO(employee?.joined) || todayISO());
  const [image, setImage] = useState(employee?.image || "");

  const cnicTouched = cnic.length > 0;
  const phoneTouched = phone.length > 0;
  const cnicError = cnicTouched && !isValidCNIC(cnic) ? "Enter a valid 13-digit CNIC (e.g. 35202-1234567-1)" : "";
  const phoneError = phoneTouched && !isValidPakPhone(phone) ? "Enter a valid Pakistani number starting with 03 (e.g. 0300-1234567)" : "";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiFetch("/api/upload", {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setImage(data.url); // e.g. "/uploads/173..."
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setUploading(false);
    }
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (cnic.trim() && !isValidCNIC(cnic)) {
      setError("Please enter a valid 13-digit CNIC number.");
      return;
    }
    if (phone.trim() && !isValidPakPhone(phone)) {
      setError("Please enter a valid Pakistani phone number (starts with 03, 11 digits).");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      full_name: name.trim(),
      cnic_number: cnic.trim(),
      phone_number: phone.trim(),
      joining_date: joinedISO,
      station,
      image_link: image.trim(),
    };

    const numericId = isEditing ? employee.id.replace("EMP-", "") : null;
    const url = isEditing ? `/api/employees/${numericId}` : "/api/employees";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSaving(false);
        return;
      }

      onSave({
        id: `EMP-${data.e_id}`,
        name: data.full_name,
        cnic: data.cnic_number || "—",
        phone: data.phone_number || "—",
        station: data.station,
        joined: data.joining_date,
        image: data.image_link,
      });
    } catch (err) {
      console.error(err);
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-overlay fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>
              {isEditing ? "Edit employee details" : "Add new employee"}
            </h2>
            <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              {isEditing ? `Update profile info for ${employee.name}` : "Enter details for the new staff member"}
            </p>
          </div>
          <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center gap-4 mb-5 p-3 rounded-xl" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <span
              className="w-14 h-14 rounded-full flex items-center justify-center text-[16px] font-semibold shrink-0 overflow-hidden"
              style={{ background: COLORS.goldSoft, color: COLORS.goldDim, border: `1px solid ${COLORS.border}` }}
            >
              {image ? (
                <img src={getImageUrl(image)} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                initials(name || "Employee")
              )}
            </span>
            <div className="flex-1 min-w-0">
              <label className="form-label mb-1">Profile Photo / Avatar</label>
              <div className="flex items-center gap-2">
                <label
                  className="btn-secondary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center"
                  style={{ border: `1px solid ${COLORS.border}`, color: COLORS.ink, background: COLORS.card }}
                >
                  Upload Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {image && (
                  <button
                    type="button"
                    className="btn-secondary text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust }}
                    onClick={() => setImage("")}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fahad Iqbal"
              />
            </div>

            <div>
              <label className="form-label">CNIC Number</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={cnic}
                onChange={(e) => setCnic(formatCNIC(e.target.value))}
                placeholder="e.g. 35202-1234567-1"
                maxLength={15}
                style={cnicError ? { borderColor: COLORS.rust } : undefined}
              />
              {cnicError && (
                <p className="text-[10.5px] mt-1" style={{ color: COLORS.rust }}>{cnicError}</p>
              )}
            </div>

            <div>
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(formatPakPhone(e.target.value))}
                placeholder="e.g. 0300-1234567"
                maxLength={12}
                style={phoneError ? { borderColor: COLORS.rust } : undefined}
              />
              {phoneError && (
                <p className="text-[10.5px] mt-1" style={{ color: COLORS.rust }}>{phoneError}</p>
              )}
            </div>

            <div>
              <label className="form-label">Department / Station</label>
              <div className="select-wrap w-full">
                <select className="w-full" value={station} onChange={(e) => setStation(e.target.value)}>
                  {STATION_META.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <div>
              <label className="form-label">Joining Date</label>
              <input
                type="date"
                className="form-input"
                value={joinedISO}
                onChange={(e) => setJoinedISO(e.target.value)}
              />
              <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                Saved as {isoToDMY(joinedISO) || "—"}
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Image URL (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={image.startsWith("data:") ? "" : image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: COLORS.border }}>
            <button
              type="button"
              className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || uploading || Boolean(cnicError) || Boolean(phoneError)}
              className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
              style={{ background: COLORS.gold, color: COLORS.ink, opacity: name.trim() && !cnicError && !phoneError ? 1 : 0.5 }}
            >
              {uploading ? "Uploading..." : isEditing ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ employee, onClose, onConfirm }) {
  if (!employee) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-md rounded-2xl p-6"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold" style={{ color: COLORS.rust }}>Delete Employee</h3>
          <button type="button" className="btn-secondary p-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}` }} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="text-[13px] mb-6" style={{ color: COLORS.graphite }}>
          Are you sure you want to delete <strong style={{ color: COLORS.ink }}>{employee.name}</strong> ({employee.id})? This will remove them from the roster.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: COLORS.rust, color: COLORS.card }}
            onClick={() => onConfirm(employee.id)}
          >
            Delete Employee
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("All stations");
  const [selectedId, setSelectedId] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);

  const [employeeBases, setEmployeeBases] = useState([]);

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const res = await apiFetch("/api/employees");
        const data = await res.json();
        const mapped = data.map((emp) => ({
          id: `EMP-${emp.e_id}`,
          name: emp.full_name,
          cnic: emp.cnic_number || "—",
          phone: emp.phone_number || "—",
          station: emp.station,
          joined: emp.joining_date,
          image: emp.image_link,
        }));
        setEmployeeBases(mapped);
      } catch (err) {
        console.error("Failed to fetch employees", err);
      }
    }
    fetchEmployees();
  }, []);

  const employees = useMemo(() => employeeBases.map(buildEmployee), [employeeBases]);
  const selectedEmployee = useMemo(() => employees.find((e) => e.id === selectedId) || null, [employees, selectedId]);

  const filtered = useMemo(() => {
    return employees
      .filter((e) => (stationFilter === "All stations" ? true : e.station === stationFilter))
      .filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.id.toLowerCase().includes(search.toLowerCase()) ||
          (e.cnic && e.cnic.toLowerCase().includes(search.toLowerCase())) ||
          (e.phone && e.phone.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => b.netDue - a.netDue);
  }, [employees, search, stationFilter]);

  const totalDue = employees.reduce((s, e) => s + e.netDue, 0);
  const totalGross = employees.reduce((s, e) => s + e.gross, 0);
  const activeInstallments = employees.filter((e) => e.installment).length;

  const today = new Date();
  const cycleStart = new Date(today);
  cycleStart.setDate(cycleStart.getDate() - (PAY_CYCLE_DAYS - 1));
  const cycleLabel = `${cycleStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  function handleSaveEmployee(newOrUpdatedData) {
    setEmployeeBases((prev) => {
      const exists = prev.some((e) => e.id === newOrUpdatedData.id);
      if (exists) {
        return prev.map((e) => (e.id === newOrUpdatedData.id ? { ...e, ...newOrUpdatedData } : e));
      }
      return [newOrUpdatedData, ...prev];
    });
    setIsAddModalOpen(false);
    setEditingEmployee(null);
  }

  async function handleDeleteEmployee(id) {
    const numericId = id.replace("EMP-", "");
    try {
      const res = await apiFetch(`/api/employees/${numericId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        console.error(data.error || "Failed to delete employee");
        return;
      }
      setEmployeeBases((prev) => prev.filter((e) => e.id !== id));
      setDeletingEmployee(null);
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.bone, fontFamily: FONT }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2.5 px-4 sm:px-6 md:px-8 py-3.5 sticky top-0 z-30 backdrop-blur" style={{ background: `${COLORS.bone}F2`, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button type="button" className="md:hidden p-2 rounded-lg btn-secondary shrink-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4h12M2 8h12M2 12h12" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold truncate" style={{ color: COLORS.ink }}>Employees</h1>
              <p className="text-[12px] hidden sm:block truncate" style={{ color: COLORS.graphiteLight }}>{employees.length} people across the floor</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/daily-entry"
              className="btn-primary inline-flex items-center gap-1.5 text-[11.5px] sm:text-[12.5px] font-bold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg shrink-0 no-underline"
              style={{ background: COLORS.ink, color: COLORS.gold, border: `1px solid ${COLORS.gold}` }}
            >
              <SparkIcon size={13} /> <span className="hidden sm:inline">Insert daily data</span><span className="sm:hidden">Daily Entry</span>
            </Link>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg shrink-0"
              style={{ background: COLORS.gold, color: COLORS.ink }}
              onClick={() => setIsAddModalOpen(true)}
            >
              <PlusIcon /> <span className="hidden sm:inline">Add employee</span><span className="sm:hidden">Add</span>
            </button>
            <div className="hidden sm:flex flex-col items-end leading-tight border-l pl-3" style={{ borderColor: COLORS.border }}>
              <span className="text-[13px] font-medium" style={{ color: COLORS.ink }}>Admin</span>
              <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>Administrator</span>
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: COLORS.ink, color: COLORS.gold, border: `2px solid ${COLORS.goldSoft}` }}>
              A
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3 fade-in" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.card, color: COLORS.goldDim }}>
                <CalendarIcon />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>Current pay cycle: {cycleLabel}</div>
                <div className="text-[11.5px]" style={{ color: COLORS.goldDim }}>Paid every {PAY_CYCLE_DAYS} days · next payout today</div>
              </div>
            </div>
            <button type="button" className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.ink, color: COLORS.gold }}>
              Settle all dues
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<UsersIcon />} label="Total employees" value={employees.length} sub={`${STATION_META.length} stations`} />
            <MiniStat index={1} icon={<CoinsIcon />} label="Earned this cycle" value={formatPKR(totalGross)} sub="gross, piece-rate" />
            <MiniStat index={2} icon={<LoanIcon />} label="Active installments" value={activeInstallments} sub={`of ${employees.length} employees`} />
            <MiniStat index={3} icon={<BanknoteIcon />} label="Total due now" value={formatPKR(totalDue)} sub="after deductions" />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="search-wrap">
              <SearchIcon />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, CNIC or phone" />
            </div>
            <div className="select-wrap">
              <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}>
                {["All stations", ...STATION_META.map((s) => s.name)].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>{filtered.length} shown</span>
          </div>

          <div className="rounded-2xl overflow-hidden panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: "120ms" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ background: COLORS.boneDim }}>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Employee</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Station</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Units</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Gross earned</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Installment</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Net due</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp, i) => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      index={i}
                      onOpen={(e) => setSelectedId(e.id)}
                      onEdit={(e) => setEditingEmployee(e)}
                      onDelete={(e) => setDeletingEmployee(e)}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-[12.5px]" style={{ color: COLORS.graphiteLight }}>
                        No employees match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedId(null)}
          onEdit={(e) => setEditingEmployee(e)}
          onDelete={(e) => setDeletingEmployee(e)}
        />
      )}

      {(isAddModalOpen || editingEmployee) && (
        <AddEditEmployeeModal
          employee={editingEmployee}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingEmployee(null);
          }}
          onSave={handleSaveEmployee}
        />
      )}

      {deletingEmployee && (
        <DeleteConfirmModal
          employee={deletingEmployee}
          onClose={() => setDeletingEmployee(null)}
          onConfirm={handleDeleteEmployee}
        />
      )}


      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

        .fade-in { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .modal-overlay { background: rgba(28,25,23,0.5); backdrop-filter: blur(2px); animation: overlayIn 0.18s ease both; }
        .modal-pop { animation: modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .stat-card, .panel, .btn-primary, .btn-secondary, .btn-link, .tbl-row {
          transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, color .18s ease;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 14px 28px -18px rgba(28,25,23,0.28); border-color: ${COLORS.gold} !important; }
        .panel:hover { box-shadow: 0 10px 26px -18px rgba(28,25,23,0.22); }
        .tbl-row:hover { background: ${COLORS.boneDim}77; }

        .btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 8px 18px -8px rgba(184,135,61,0.5); }
        .btn-primary:active { transform: translateY(0); }
        .btn-secondary:hover { border-color: ${COLORS.gold} !important; color: ${COLORS.goldDim} !important; background: ${COLORS.goldSoft}55 !important; }
        .btn-link { background: none; border: none; cursor: pointer; padding: 0; }
        .btn-link:hover { color: ${COLORS.gold} !important; text-decoration: underline; }

        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: ${COLORS.graphite}; margin-bottom: 4px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none; width: 100%;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .form-input:hover, .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }

        .select-wrap { position: relative; display: inline-flex; align-items: center; }
        .select-wrap select {
          appearance: none; font-family: ${FONT}; font-size: 12.5px; font-weight: 500;
          color: ${COLORS.ink}; background: ${COLORS.card}; border: 1px solid ${COLORS.border};
          border-radius: 8px; padding: 8px 28px 8px 12px; cursor: pointer; outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .select-wrap select:hover, .select-wrap select:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .select-caret { position: absolute; right: 10px; pointer-events: none; }

        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 260px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .search-wrap input::placeholder { color: ${COLORS.graphiteLight}; }
        .search-wrap input:hover, .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        .nav-item { transition: background .18s ease, transform .18s ease, color .18s ease; }
        .nav-item:hover:not(:disabled) { background: ${COLORS.inkSoft} !important; transform: translateX(2px); }

        table th, table td { white-space: nowrap; }

        @media (max-width: 640px) {
          .search-wrap, .select-wrap { width: 100%; }
          .search-wrap input { width: 100% !important; }
          .select-wrap select { width: 100% !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .stat-card, .panel, .modal-pop, .modal-overlay, .btn-primary, .btn-secondary { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}