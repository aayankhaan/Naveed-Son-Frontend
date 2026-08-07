// ========================================
// EmployeePayModal.jsx
// Employee proof sheet — work, shipping, deductions, payout history.
// Admin can edit installment / advance amounts from here.
// ========================================

import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FONT, COLORS } from "../../constants/theme";
import ModalLayer from "../ui/ModalLayer";
import { CloseIcon } from "../icons/CommonIcons";
import { API_BASE, apiFetch } from "../../lib/api";
import EmployeeProofPdf from "./EmployeeProofPdf";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work & shipping" },
  { id: "deductions", label: "Deductions" },
  { id: "history", label: "History" },
];

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function getImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_BASE}${path}`;
}

function initials(name) {
  if (!name) return "E";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatPKR(n) {
  return `PKR ${Math.round(Number(n) || 0).toLocaleString()}`;
}

function formatQty(n) {
  return `${Math.round(Number(n) || 0).toLocaleString()} pcs`;
}

function formatDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(iso) {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

function StationBadge({ station }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full"
      style={{ background: COLORS.boneDim, color: COLORS.graphite }}
    >
      {station || "—"}
    </span>
  );
}

function ShipBadge({ status }) {
  const map = {
    pending: { label: "Not shipped", bg: COLORS.boneDim, color: COLORS.graphite },
    shipped: { label: "Shipped", bg: COLORS.goldSoft, color: COLORS.goldDim },
    paid: { label: "Paid out", bg: COLORS.greenSoft, color: COLORS.green },
    leave: { label: "Leave", bg: COLORS.boneDim, color: COLORS.graphiteLight },
  };
  const m = map[status] || map.pending;
  return (
    <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function StoryRow({ label, value, hint, accent }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5" style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <div className="min-w-0">
        <div className="text-[12.5px]" style={{ color: COLORS.graphite }}>{label}</div>
        {hint ? <div className="text-[10.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>{hint}</div> : null}
      </div>
      <div className="text-[13px] font-semibold shrink-0" style={{ color: accent || COLORS.ink }}>{value}</div>
    </div>
  );
}

export default function EmployeePayModal({ employee, onClose, onEdit, onDelete, onPaid }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [tab, setTab] = useState("overview");

  const [fromDate, setFromDate] = useState(() => daysAgoISO(15));
  const [toDate, setToDate] = useState(() => todayISO());
  const [appliedFrom, setAppliedFrom] = useState(() => daysAgoISO(15));
  const [appliedTo, setAppliedTo] = useState(() => todayISO());
  const [rangeMode, setRangeMode] = useState("custom"); // custom | since_payout
  const [viewMode, setViewMode] = useState("qty"); // qty | money
  const [exportingPdf, setExportingPdf] = useState(false);

  // This-payout-only overrides (do not change standing plan until Record payment)
  const [thisInstDeduct, setThisInstDeduct] = useState("");
  const [thisAdvDeduct, setThisAdvDeduct] = useState("");
  const [showPlanEdit, setShowPlanEdit] = useState(false);
  const [editPerPayout, setEditPerPayout] = useState("");
  const [editAdvanceRem, setEditAdvanceRem] = useState("");
  const [savingLoan, setSavingLoan] = useState(false);
  const [loanMsg, setLoanMsg] = useState("");

  const displayName = employee?.name || employee?.full_name || "Employee";
  const numericId = Number(
    employee?.e_id ||
      employee?.employee_id ||
      String(employee?.id || "").replace(/^EMP-/i, "") ||
      0
  );

  async function load(from = appliedFrom, to = appliedTo, mode = rangeMode) {
    if (!numericId) {
      setLoading(false);
      setError("Missing employee id");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (mode === "since_payout") {
        qs.set("since", "last_payout");
      } else {
        qs.set("from", from);
        qs.set("to", to);
      }
      const res = await apiFetch(`/api/employees/${numericId}/pay-summary?${qs}`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load employee proof"));
      const data = await res.json();
      setSummary(data);
      if (data.cycle?.from && data.cycle?.to) {
        setFromDate(data.cycle.from);
        setToDate(data.cycle.to);
        setAppliedFrom(data.cycle.from);
        setAppliedTo(data.cycle.to);
      }
      setThisInstDeduct(data.preview ? String(data.preview.installment_deduct ?? 0) : "0");
      setThisAdvDeduct(data.preview ? String(data.preview.advance_deduct ?? 0) : "0");
      setEditPerPayout(data.installment ? String(data.installment.per_payout) : "");
      setEditAdvanceRem(data.advance ? String(data.advance.remaining_amount) : "");
      setLoanMsg("");
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(appliedFrom, appliedTo, rangeMode);
  }, [numericId]);

  function applyDateRange() {
    if (!fromDate || !toDate) {
      setError("Pick both From and To dates");
      return;
    }
    if (fromDate > toDate) {
      setError("From must be on or before To");
      return;
    }
    setError("");
    setRangeMode("custom");
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    load(fromDate, toDate, "custom");
  }

  function applySinceLastPayout() {
    setError("");
    setRangeMode("since_payout");
    load(undefined, undefined, "since_payout");
  }

  async function downloadPdf() {
    if (!summary || exportingPdf) return;
    setExportingPdf(true);
    try {
      const blob = await pdf(
        <EmployeeProofPdf employee={employee} summary={summary} viewMode={viewMode} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Proof-${String(displayName || "employee").replace(/\s+/g, "-")}-${viewMode}-${appliedFrom}_${appliedTo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Couldn't generate PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const chartData = useMemo(() => {
    if (!summary?.chart_data?.length) return [];
    return summary.chart_data.map((d) => ({ date: d.date, amount: d.amount }));
  }, [summary]);

  const installment = summary?.installment;
  const advance = summary?.advance;
  const story = summary?.money_story;
  const settledUnpaid = summary?.settled_unpaid || 0;
  const isManagement = Boolean(summary?.is_management) || String(employee?.station || "").toLowerCase() === "management";
  const paidPct = installment && installment.principal
    ? Math.round((installment.paid_so_far / installment.principal) * 100)
    : 0;

  /** Live preview using this-payout override fields (plan unchanged). */
  const livePreview = useMemo(() => {
    const gross = settledUnpaid;
    let left = gross;
    const bal = installment?.balance || 0;
    const rem = advance?.remaining_amount || 0;
    const planInst = summary?.preview?.installment_deduct ?? 0;
    const planAdv = summary?.preview?.advance_deduct ?? 0;
    const inst = installment
      ? Math.min(bal, left, Math.max(0, Math.round(Number(thisInstDeduct) || 0)))
      : 0;
    left -= inst;
    const adv = advance
      ? Math.min(rem, left, Math.max(0, Math.round(Number(thisAdvDeduct) || 0)))
      : 0;
    left -= adv;
    return {
      gross,
      installment_deduct: inst,
      advance_deduct: adv,
      advance_carry: Math.max(0, rem - adv),
      net_pay: left,
      changed: (installment && inst !== planInst) || (advance && adv !== planAdv),
    };
  }, [settledUnpaid, installment, advance, thisInstDeduct, thisAdvDeduct, summary?.preview]);

  const preview = livePreview;

  function resetThisPayoutDefaults() {
    if (!summary?.preview) return;
    setThisInstDeduct(String(summary.preview.installment_deduct ?? 0));
    setThisAdvDeduct(String(summary.preview.advance_deduct ?? 0));
  }

  async function recordPayment() {
    if (!numericId || settledUnpaid <= 0) return;
    if (!window.confirm(`Pay out ${formatPKR(preview?.net_pay ?? 0)} net to ${displayName}?`)) return;
    setPaying(true);
    setPayMsg("");
    try {
      const body = {
        employee_id: numericId,
        cycle_from: summary?.cycle?.from,
        cycle_to: summary?.cycle?.to,
      };
      // Always send this-payout amounts so admin edits stick for this pay only
      if (installment || (summary?.installments || []).length) {
        body.installment_deduct = preview.installment_deduct;
      }
      if (advance || (summary?.advances || []).length) {
        body.advance_deduct = preview.advance_deduct;
      }

      const res = await apiFetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to record payout"));
      const data = await res.json();
      setPayMsg(`Paid ${formatPKR(data.net_paid)}`);
      await load(appliedFrom, appliedTo, rangeMode);
      onPaid?.();
    } catch (err) {
      setPayMsg(err.message || "Payout failed");
    } finally {
      setPaying(false);
    }
  }

  async function saveInstallmentPlan() {
    if (!installment?.installment_id) return;
    const per = Math.round(Number(editPerPayout) || 0);
    if (per <= 0) {
      setLoanMsg("Per-payout amount must be greater than 0");
      return;
    }
    if (per > installment.principal) {
      setLoanMsg("Per-payout cannot exceed principal");
      return;
    }
    setSavingLoan(true);
    setLoanMsg("");
    try {
      const res = await apiFetch(`/api/employee-installments/${installment.installment_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ per_payout: per }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update installment"));
      setLoanMsg("Installment plan updated — next payout will deduct less/more as set.");
      await load();
      onPaid?.();
    } catch (err) {
      setLoanMsg(err.message || "Update failed");
    } finally {
      setSavingLoan(false);
    }
  }

  async function saveAdvanceRemaining() {
    if (!advance?.advance_id) return;
    const rem = Math.round(Number(editAdvanceRem) || 0);
    if (rem < 0) {
      setLoanMsg("Remaining cannot be negative");
      return;
    }
    if (rem > advance.original_amount) {
      setLoanMsg("Remaining cannot exceed original advance");
      return;
    }
    setSavingLoan(true);
    setLoanMsg("");
    try {
      const res = await apiFetch(`/api/employee-advances/${advance.advance_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remaining_amount: rem }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update advance"));
      setLoanMsg(rem === 0 ? "Advance cleared." : "Advance remaining updated — next payout deducts from this balance.");
      await load();
      onPaid?.();
    } catch (err) {
      setLoanMsg(err.message || "Update failed");
    } finally {
      setSavingLoan(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="modal-pop w-full sm:max-w-4xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} proof sheet`}
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-5 sticky top-0 z-10" style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0 overflow-hidden" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
              {employee.image ? (
                <img src={getImageUrl(employee.image)} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                initials(displayName)
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: COLORS.goldDim }}>
                Employee proof
              </p>
              <h2 className="text-[16px] font-semibold truncate" style={{ color: COLORS.ink }}>{displayName}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StationBadge station={employee.station} />
                <span className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
                  {employee.id} · Joined {employee.joined}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn-primary text-[12px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: COLORS.gold, color: COLORS.ink, opacity: exportingPdf ? 0.7 : 1 }}
              onClick={downloadPdf}
              disabled={!summary || exportingPdf}
            >
              {exportingPdf ? "PDF…" : "Download PDF"}
            </button>
            {typeof onEdit === "function" ? (
              <button
                type="button"
                className="btn-secondary text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
                onClick={() => { onClose(); onEdit(employee); }}
              >
                Edit
              </button>
            ) : null}
            {typeof onDelete === "function" ? (
              <button
                type="button"
                className="btn-secondary text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust, background: COLORS.rustSoft }}
                onClick={() => { onClose(); onDelete(employee); }}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="btn-secondary p-2 rounded-lg" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 pt-3 sticky top-[88px] z-10" style={{ background: COLORS.card }}>
          <div className="flex flex-wrap items-end gap-2 pb-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <div
              className="flex p-0.5 rounded-lg"
              style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}
            >
              {[
                { id: "qty", label: "Qty" },
                { id: "money", label: "Money" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id)}
                  className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-md"
                  style={{
                    background: viewMode === m.id ? COLORS.inkSurface : "transparent",
                    color: viewMode === m.id ? COLORS.gold : COLORS.graphite,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.graphiteLight }}>From</label>
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ minWidth: 140, padding: "6px 8px", fontSize: 12 }}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: COLORS.graphiteLight }}>To</label>
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ minWidth: 140, padding: "6px 8px", fontSize: 12 }}
              />
            </div>
            <button
              type="button"
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: COLORS.inkSurface, color: COLORS.gold }}
              onClick={applyDateRange}
            >
              Show
            </button>
            <button
              type="button"
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              style={{
                background: rangeMode === "since_payout" ? COLORS.goldSoft : COLORS.boneDim,
                color: rangeMode === "since_payout" ? COLORS.goldDim : COLORS.graphite,
              }}
              onClick={applySinceLastPayout}
            >
              Since last payout
            </button>
            <button
              type="button"
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: COLORS.boneDim, color: COLORS.graphite }}
              onClick={() => {
                const f = daysAgoISO(15);
                const t = todayISO();
                setFromDate(f);
                setToDate(t);
                setRangeMode("custom");
                setAppliedFrom(f);
                setAppliedTo(t);
                load(f, t, "custom");
              }}
            >
              15 days
            </button>
            <button
              type="button"
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: COLORS.boneDim, color: COLORS.graphite }}
              onClick={() => {
                const f = daysAgoISO(45);
                const t = todayISO();
                setFromDate(f);
                setToDate(t);
                setRangeMode("custom");
                setAppliedFrom(f);
                setAppliedTo(t);
                load(f, t, "custom");
              }}
            >
              45 days
            </button>
            <span className="text-[11px] ml-auto" style={{ color: COLORS.graphiteLight }}>
              {formatDateShort(appliedFrom)} – {formatDateShort(appliedTo)}
              {rangeMode === "since_payout" ? " · after last pay" : ""}
            </span>
          </div>
          <div className="flex gap-1 overflow-x-auto py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg shrink-0"
                style={{
                  background: tab === t.id ? COLORS.inkSurface : "transparent",
                  color: tab === t.id ? COLORS.gold : COLORS.graphite,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loading && (
            <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>Loading proof…</p>
          )}
          {error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
              {error}
              {error.toLowerCase().includes("relation") || error.toLowerCase().includes("does not exist")
                ? " — run sql/08_employee_settlements.sql (and 07/09 if needed) in pgAdmin."
                : ""}
            </div>
          )}
          {payMsg && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-[12.5px]"
              style={{
                background: payMsg.startsWith("Paid") ? COLORS.greenSoft : COLORS.rustSoft,
                color: payMsg.startsWith("Paid") ? COLORS.green : COLORS.rust,
              }}
            >
              {payMsg}
            </div>
          )}

          {summary && !loading && (
            <>
              {tab === "overview" && (
                <>
                  {viewMode === "money" && settledUnpaid <= 0 && (
                    <div className="rounded-xl px-4 py-3 mb-4 text-[12.5px]" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
                      <strong>Nothing owed right now.</strong> Net payable is PKR 0.
                      Switch to Qty to show pieces worked / waste / pending ship for the floor.
                    </div>
                  )}

                  {viewMode === "qty" ? (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        <div className="rounded-xl p-4" style={{ background: COLORS.goldSoft }}>
                          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>Worked</div>
                          <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>
                            {formatQty(summary.qty_story?.totals?.worked)}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: COLORS.goldDim }}>good pcs logged</div>
                        </div>
                        <div className="rounded-xl p-4" style={{ background: COLORS.rustSoft }}>
                          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.rust }}>Waste</div>
                          <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>
                            {formatQty(
                              (summary.qty_story?.totals?.waste || 0) +
                                (summary.qty_story?.totals?.ship_waste || 0)
                            )}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: COLORS.rust }}>
                            defects {formatQty(summary.qty_story?.totals?.waste)} · ship {formatQty(summary.qty_story?.totals?.ship_waste)}
                          </div>
                        </div>
                        <div className="rounded-xl p-4" style={{ background: COLORS.greenSoft }}>
                          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.green }}>Paid qty</div>
                          <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>
                            {formatQty(summary.qty_story?.totals?.paid)}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: COLORS.green }}>already in a payout</div>
                        </div>
                        <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
                          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Pending ship</div>
                          <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>
                            {formatQty(summary.qty_story?.totals?.pending_ship)}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: COLORS.graphiteLight }}>
                            ready pay {formatQty(summary.qty_story?.totals?.ready_pay)}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl p-5 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
                        <h3 className="text-[13px] font-semibold mb-1" style={{ color: COLORS.ink }}>Qty story (easy to show on floor)</h3>
                        <p className="text-[11.5px] mb-2" style={{ color: COLORS.graphiteLight }}>
                          {formatDateShort(summary.cycle?.from)} – {formatDateShort(summary.cycle?.to)}
                          {summary.last_payout_at
                            ? ` · Last payout ${formatDateLabel(summary.last_payout_at)}`
                            : " · Never paid out yet"}
                        </p>
                        <StoryRow label="Good pcs worked" value={formatQty(summary.qty_story?.totals?.worked)} hint="What they logged" />
                        <StoryRow label="Defects (floor waste)" value={formatQty(summary.qty_story?.totals?.waste)} accent={COLORS.rust} />
                        <StoryRow
                          label="Ship waste"
                          value={formatQty(summary.qty_story?.totals?.ship_waste)}
                          hint="Worked but not shipped with the order"
                          accent={COLORS.rust}
                        />
                        <StoryRow
                          label="Still waiting shipment"
                          value={formatQty(summary.qty_story?.totals?.pending_ship)}
                          hint="Order not shipped yet — not payable"
                        />
                        <StoryRow
                          label="Shipped — ready to pay"
                          value={formatQty(summary.qty_story?.totals?.ready_pay)}
                          hint="Unlocked, not paid yet"
                          accent={COLORS.goldDim}
                        />
                        <StoryRow
                          label="Already paid qty"
                          value={formatQty(summary.qty_story?.totals?.paid)}
                          hint="Included in a past payout"
                          accent={COLORS.green}
                        />
                      </div>

                      <div className="rounded-2xl p-5 mb-5" style={{ border: `1px solid ${COLORS.border}` }}>
                        <h3 className="text-[13px] font-semibold mb-1" style={{ color: COLORS.ink }}>What we owe (money)</h3>
                        <p className="text-[11.5px] mb-3" style={{ color: COLORS.graphiteLight }}>
                          From shipped work ready to pay · after installment &amp; advance
                        </p>
                        <div className="rounded-xl p-3.5 space-y-0" style={{ background: COLORS.boneDim }}>
                          <StoryRow
                            label="You earned / we owe"
                            value={formatPKR(preview?.gross ?? story?.settled_unlocked ?? 0)}
                            hint="Shipped & unlocked — not paid yet"
                            accent={COLORS.goldDim}
                          />
                          <StoryRow
                            label="− Installment"
                            value={`−${formatPKR(preview?.installment_deduct ?? story?.installment_deduct ?? 0)}`}
                            hint={
                              installment
                                ? `${formatPKR(installment.per_payout)} / payout · ${formatPKR(installment.balance)} left on plan`
                                : "none"
                            }
                            accent={COLORS.rust}
                          />
                          <StoryRow
                            label="− Advance"
                            value={`−${formatPKR(preview?.advance_deduct ?? story?.advance_deduct ?? 0)}`}
                            hint={
                              advance
                                ? `${formatPKR(advance.remaining_amount)} remaining on advance`
                                : "none"
                            }
                            accent={COLORS.rust}
                          />
                          <StoryRow
                            label="Total they take home"
                            value={formatPKR(preview?.net_pay ?? story?.net_pay ?? 0)}
                            hint="After deductions"
                            accent={COLORS.green}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl p-5 mb-5" style={{ border: `1px solid ${COLORS.border}` }}>
                        <h3 className="text-[13px] font-semibold mb-3" style={{ color: COLORS.ink }}>By department</h3>
                        {(summary.qty_story?.by_station || []).length === 0 ? (
                          <p className="text-[12.5px]" style={{ color: COLORS.graphiteLight }}>No work in this window.</p>
                        ) : (
                          <div className="space-y-3">
                            {summary.qty_story.by_station.map((s) => (
                              <div key={s.station} className="rounded-xl p-3.5" style={{ background: COLORS.boneDim }}>
                                <div className="text-[13px] font-semibold mb-2" style={{ color: COLORS.goldDim }}>{s.station}</div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                                  <div>
                                    <div style={{ color: COLORS.graphiteLight }}>Worked</div>
                                    <div className="font-semibold tabular-nums" style={{ color: COLORS.ink }}>{formatQty(s.worked)}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: COLORS.graphiteLight }}>Waste</div>
                                    <div className="font-semibold tabular-nums" style={{ color: COLORS.rust }}>
                                      {formatQty((s.waste || 0) + (s.ship_waste || 0))}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ color: COLORS.graphiteLight }}>Pending</div>
                                    <div className="font-semibold tabular-nums" style={{ color: COLORS.ink }}>{formatQty(s.pending_ship)}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: COLORS.graphiteLight }}>Ready</div>
                                    <div className="font-semibold tabular-nums" style={{ color: COLORS.goldDim }}>{formatQty(s.ready_pay)}</div>
                                  </div>
                                  <div>
                                    <div style={{ color: COLORS.graphiteLight }}>Paid</div>
                                    <div className="font-semibold tabular-nums" style={{ color: COLORS.green }}>{formatQty(s.paid)}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                    <div className="rounded-xl p-4" style={{ background: settledUnpaid > 0 ? COLORS.goldSoft : COLORS.greenSoft }}>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: settledUnpaid > 0 ? COLORS.goldDim : COLORS.green }}>
                        Net payable now
                      </div>
                      <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{formatPKR(story?.net_pay || 0)}</div>
                      <div className="text-[10px] mt-1" style={{ color: settledUnpaid > 0 ? COLORS.goldDim : COLORS.green }}>
                        {settledUnpaid > 0 ? "ready to hand over" : "all clear — not a bill"}
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>
                        {isManagement ? "Salary due" : "Unpaid settled"}
                      </div>
                      <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{formatPKR(settledUnpaid)}</div>
                      <div className="text-[10px] mt-1" style={{ color: COLORS.graphiteLight }}>
                        {isManagement
                          ? summary?.pay_day
                            ? `monthly · posts on day ${summary.pay_day}`
                            : "monthly salary balance"
                          : "shipped, not paid yet"}
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>
                        {isManagement ? "Monthly pay" : "Raw in range"}
                      </div>
                      <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>
                        {isManagement ? formatPKR(summary?.monthly_salary || 0) : formatPKR(summary.raw_gross)}
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: COLORS.graphiteLight }}>
                        {isManagement
                          ? "fixed salary · not piece-rate"
                          : `activity only · ${formatDateShort(appliedFrom)} – ${formatDateShort(appliedTo)}`}
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Already paid</div>
                      <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.green }}>{formatPKR(story?.already_paid_out || 0)}</div>
                      <div className="text-[10px] mt-1" style={{ color: COLORS.graphiteLight }}>from this range (settled)</div>
                    </div>
                  </div>

                  <div className="rounded-2xl p-5 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
                    <h3 className="text-[13px] font-semibold mb-1" style={{ color: COLORS.ink }}>Money story (easy to show)</h3>
                    <p className="text-[11.5px] mb-2" style={{ color: COLORS.graphiteLight }}>
                      {formatDateShort(summary.cycle?.from)} – {formatDateShort(summary.cycle?.to)}
                      {summary.since_last_payout?.since
                        ? ` · Last payout ${formatDateLabel(summary.since_last_payout.since)}`
                        : " · Never paid out yet"}
                    </p>
                    <StoryRow
                      label={isManagement ? "Production (N/A)" : "Raw production logged"}
                      value={formatPKR(story?.raw_logged)}
                      hint={isManagement ? "Management is monthly salary — no piece work" : "Work done in this range — not automatically money owed"}
                    />
                    <StoryRow
                      label="Already paid out"
                      value={formatPKR(story?.already_paid_out || 0)}
                      hint={(story?.already_paid_raw || 0) > 0 ? `from raw ${formatPKR(story.already_paid_raw)} that was settled & paid` : "nothing paid from this range yet"}
                      accent={COLORS.green}
                    />
                    {!isManagement && (
                      <StoryRow label="Waiting on shipment" value={formatPKR(story?.waiting_on_ship)} hint="worked, but order not shipped yet — not payable" accent={COLORS.graphite} />
                    )}
                    <StoryRow
                      label={isManagement ? "Salary unpaid (bill now)" : "Settled unpaid (bill now)"}
                      value={formatPKR(story?.settled_unlocked)}
                      hint={isManagement ? "monthly salary posted on pay day, not paid yet" : "shipped × ratio, not paid yet"}
                      accent={COLORS.goldDim}
                    />
                    <StoryRow
                      label="− Installment this payout"
                      value={`−${formatPKR(story?.installment_deduct)}`}
                      hint={
                        installment
                          ? `${story?.installment_count || installment.count || 1} plan(s) · ${formatPKR(installment.per_payout)} / payout · ${formatPKR(installment.balance)} left`
                          : "none"
                      }
                      accent={COLORS.rust}
                    />
                    <StoryRow
                      label="− Advance this payout"
                      value={`−${formatPKR(story?.advance_deduct)}`}
                      hint={
                        advance
                          ? `${story?.advance_count || advance.count || 1} advance(s) · ${formatPKR(advance.remaining_amount)} remaining`
                          : "none"
                      }
                      accent={COLORS.rust}
                    />
                    <StoryRow label="Net they take home now" value={formatPKR(story?.net_pay)} accent={COLORS.green} />
                  </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-2">
                    <div className="lg:col-span-3 rounded-2xl p-5" style={{ border: `1px solid ${COLORS.border}` }}>
                      <h3 className="text-[13px] font-semibold mb-3" style={{ color: COLORS.ink }}>
                        {viewMode === "qty" ? "Qty activity" : "Earnings activity (raw — not a bill)"}
                      </h3>
                      {chartData.length ? (
                        <div style={{ width: "100%", height: 180 }}>
                          <ResponsiveContainer>
                            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                              <defs>
                                <linearGradient id="empEarnFillProof" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.38} />
                                  <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} />
                              <Tooltip
                                contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                                labelStyle={{ color: COLORS.bone }}
                                itemStyle={{ color: COLORS.gold }}
                                formatter={(v) =>
                                  viewMode === "qty"
                                    ? [`${Number(v).toLocaleString()} pcs`, "Worked"]
                                    : [`PKR ${Number(v).toLocaleString()}`, "Earned"]
                                }
                              />
                              <Area
                                type="monotone"
                                dataKey={viewMode === "qty" ? "qty" : "amount"}
                                stroke={COLORS.gold}
                                strokeWidth={2.2}
                                fill="url(#empEarnFillProof)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-[12.5px] py-10 text-center" style={{ color: COLORS.graphiteLight }}>No production in this window.</p>
                      )}
                    </div>

                    <div className="lg:col-span-2 rounded-2xl p-5" style={{ border: `1px solid ${COLORS.border}` }}>
                      <h3 className="text-[13px] font-semibold mb-1" style={{ color: COLORS.ink }}>By article</h3>
                      <p className="text-[11px] mb-1" style={{ color: COLORS.graphiteLight }}>Where the work went</p>
                      {(summary.breakdown || []).length ? (
                        <>
                          <div className="relative" style={{ width: "100%", height: 140 }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie
                                  data={summary.breakdown}
                                  dataKey={viewMode === "qty" ? "qty" : "value"}
                                  nameKey="name"
                                  innerRadius={38}
                                  outerRadius={58}
                                  paddingAngle={3}
                                  stroke="none"
                                >
                                  {summary.breakdown.map((it) => (
                                    <Cell key={it.name} fill={it.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{ background: COLORS.inkSurface, border: "none", borderRadius: 10, fontSize: 11 }}
                                  formatter={(v) =>
                                    viewMode === "qty"
                                      ? [`${Number(v).toLocaleString()} pcs`, ""]
                                      : [`PKR ${Number(v).toLocaleString()}`, ""]
                                  }
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-col gap-1.5 mt-1">
                            {summary.breakdown.map((it) => (
                              <div key={it.name} className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 truncate" style={{ color: COLORS.graphite }}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: it.color }} />
                                  <span className="truncate">{it.name}</span>
                                </span>
                                <span className="font-semibold shrink-0" style={{ color: COLORS.ink }}>
                                  {viewMode === "qty" ? formatQty(it.qty) : formatPKR(it.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-[12px] mt-6" style={{ color: COLORS.graphiteLight }}>No breakdown yet.</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {tab === "work" && (
                <>
                  <div className="rounded-2xl overflow-hidden mb-5" style={{ border: `1px solid ${COLORS.border}` }}>
                    <div className="px-5 py-3.5" style={{ background: COLORS.boneDim }}>
                      <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>Orders they worked on</h3>
                      <p className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                        Raw → shipped % → money unlocked. Show this if someone questions their pay.
                      </p>
                    </div>
                    <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: COLORS.border }}>
                      {(summary.order_proof || []).length === 0 && (
                        <p className="px-5 py-8 text-center text-[12.5px]" style={{ color: COLORS.graphiteLight }}>
                          No order work in this window.
                        </p>
                      )}
                      {(summary.order_proof || []).map((o) => (
                        <div key={`${o.order_id}-${o.order_line_id}`} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
                                ATM {o.atm_no}
                              </span>
                              <ShipBadge status={o.ship_status} />
                            </div>
                            <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphite }}>
                              {o.article_name} · {o.qty_logged} pcs
                              {o.shipped_on ? ` · shipped ${formatDateShort(o.shipped_on)}` : ""}
                            </div>
                          </div>
                          <div className="text-right text-[12px]">
                            <div className="font-semibold" style={{ color: COLORS.ink }}>
                              {o.ship_status === "pending" ? formatPKR(o.raw_earned) : formatPKR(o.payable_amount)}
                            </div>
                            <div className="text-[10.5px]" style={{ color: COLORS.graphiteLight }}>
                              {o.ship_status === "pending"
                                ? `raw ${formatPKR(o.raw_earned)} · waiting ship`
                                : `${Math.round(o.shipment_ratio * 100)}% of raw ${formatPKR(o.raw_earned)}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(summary.settlements || []).filter((s) => !s.paid).length > 0 && (
                    <div className="rounded-2xl overflow-hidden mb-5" style={{ border: `1px solid ${COLORS.border}` }}>
                      <div className="px-5 py-3" style={{ background: COLORS.goldSoft }}>
                        <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>Ready to pay (unpaid settlements)</h3>
                      </div>
                      <div className="divide-y" style={{ borderColor: COLORS.border }}>
                        {summary.settlements.filter((s) => !s.paid).map((s) => (
                          <div key={s.settlement_id} className="px-5 py-2.5 flex flex-wrap justify-between gap-2 text-[12px]">
                            <span style={{ color: COLORS.graphite }}>
                              ATM {s.atm_no} · {s.article_name}
                              <span className="ml-1" style={{ color: COLORS.graphiteLight }}>
                                ({Math.round(s.shipment_ratio * 100)}% shipped
                                {s.shipped_on ? ` · ${formatDateShort(s.shipped_on)}` : ""})
                              </span>
                            </span>
                            <span className="font-semibold" style={{ color: COLORS.ink }}>
                              {formatPKR(s.payable_amount)}
                              <span className="font-normal ml-1" style={{ color: COLORS.graphiteLight }}>
                                from {formatPKR(s.raw_earned)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                    <div className="px-5 py-3.5" style={{ background: COLORS.boneDim, borderBottom: `1px solid ${COLORS.border}` }}>
                      <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>
                        Daily work log — {formatDateShort(summary.cycle?.from)} – {formatDateShort(summary.cycle?.to)}
                      </h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr>
                            {["Date", "Item", "Status", "Qty", "Amount"].map((h) => (
                              <th
                                key={h}
                                className={`font-semibold px-3 py-2 uppercase text-[10px] tracking-wide sticky top-0 ${h === "Qty" || h === "Amount" ? "text-right" : "text-left"}`}
                                style={{ color: COLORS.graphite, background: COLORS.card }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...(summary.work_log || [])].reverse().map((e) => (
                            <tr key={e.log_id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                              <td className="px-3 py-2.5" style={{ color: COLORS.graphiteLight }}>{formatDateShort(e.date)}</td>
                              <td className="px-3 py-2.5" style={{ color: COLORS.graphite }}>
                                {e.leave ? "Leave" : e.item}
                                {!e.leave && e.station ? (
                                  <span className="block text-[10px]" style={{ color: COLORS.graphiteLight }}>{e.station}</span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5"><ShipBadge status={e.ship_status} /></td>
                              <td className="px-3 py-2.5 text-right" style={{ color: COLORS.graphite }}>{e.leave ? "—" : e.qty}</td>
                              <td className="px-3 py-2.5 text-right font-medium" style={{ color: COLORS.ink }}>{e.leave ? "—" : formatPKR(e.amount)}</td>
                            </tr>
                          ))}
                          {(summary.work_log || []).length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center" style={{ color: COLORS.graphiteLight }}>
                                No daily entries in this window.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {tab === "deductions" && (
                <>
                  <div className="rounded-2xl p-5 mb-5" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>This payout only</h3>
                        <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.goldDim }}>
                          Change what we take on Record payment. Standing plan stays the same for next times.
                        </p>
                      </div>
                      {(installment || advance) && (
                        <button
                          type="button"
                          className="text-[11.5px] font-semibold px-2.5 py-1 rounded-lg"
                          style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, background: COLORS.card }}
                          onClick={resetThisPayoutDefaults}
                        >
                          Reset to plan
                        </button>
                      )}
                    </div>

                    {!installment && !advance ? (
                      <p className="text-[12px]" style={{ color: COLORS.graphite }}>No active installment or advance to adjust.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {installment && (
                          <div>
                            <label className="form-label">Installment deduct (this pay)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-input"
                              value={thisInstDeduct}
                              onChange={(e) => setThisInstDeduct(e.target.value.replace(/[^\d]/g, ""))}
                            />
                            <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphite }}>
                              Plan usual {formatPKR(installment.per_payout)} · balance {formatPKR(installment.balance)}
                            </p>
                          </div>
                        )}
                        {advance && (
                          <div>
                            <label className="form-label">Advance deduct (this pay)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-input"
                              value={thisAdvDeduct}
                              onChange={(e) => setThisAdvDeduct(e.target.value.replace(/[^\d]/g, ""))}
                            />
                            <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphite }}>
                              Remaining on file {formatPKR(advance.remaining_amount)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 rounded-xl px-4 py-3" style={{ background: COLORS.card }}>
                      <StoryRow label="Settled gross" value={formatPKR(settledUnpaid)} />
                      <StoryRow
                        label="− Installment (this pay)"
                        value={`−${formatPKR(preview.installment_deduct)}`}
                        hint={preview.changed && installment ? `plan would take ${formatPKR(summary?.preview?.installment_deduct || 0)}` : undefined}
                        accent={COLORS.rust}
                      />
                      <StoryRow
                        label="− Advance (this pay)"
                        value={`−${formatPKR(preview.advance_deduct)}`}
                        hint={preview.changed && advance ? `plan would take ${formatPKR(summary?.preview?.advance_deduct || 0)}` : undefined}
                        accent={COLORS.rust}
                      />
                      <StoryRow label="Net they take home" value={formatPKR(preview.net_pay)} accent={COLORS.green} />
                      {(preview.advance_carry || 0) > 0 && (
                        <p className="text-[11px] mt-2" style={{ color: COLORS.graphite }}>
                          Advance left after this pay: {formatPKR(preview.advance_carry)}
                        </p>
                      )}
                      {preview.changed && (
                        <p className="text-[11px] mt-2 font-medium" style={{ color: COLORS.goldDim }}>
                          One-time override — next payout uses the normal plan again.
                        </p>
                      )}
                    </div>
                  </div>

                  {loanMsg && (
                    <div
                      className="rounded-xl px-4 py-3 mb-4 text-[12.5px]"
                      style={{
                        background: loanMsg.toLowerCase().includes("fail") || loanMsg.toLowerCase().includes("must") || loanMsg.toLowerCase().includes("cannot")
                          ? COLORS.rustSoft
                          : COLORS.greenSoft,
                        color: loanMsg.toLowerCase().includes("fail") || loanMsg.toLowerCase().includes("must") || loanMsg.toLowerCase().includes("cannot")
                          ? COLORS.rust
                          : COLORS.green,
                      }}
                    >
                      {loanMsg}
                    </div>
                  )}

                  <button
                    type="button"
                    className="text-[12px] font-semibold mb-3"
                    style={{ color: COLORS.graphite }}
                    onClick={() => setShowPlanEdit((v) => !v)}
                  >
                    {showPlanEdit ? "Hide overall plan edit" : "Edit overall installment / advance plan…"}
                  </button>

                  {showPlanEdit && (
                    <>
                      <p className="text-[11.5px] mb-4" style={{ color: COLORS.graphiteLight }}>
                        Open plans on file. Edit / cancel individual ones from Employees → Installments &amp; Advances.
                        For this pay only, use the amounts above.
                      </p>

                      <div className="rounded-2xl p-4 mb-3" style={{ border: `1px solid ${COLORS.border}` }}>
                        <h3 className="text-[13px] font-semibold mb-2" style={{ color: COLORS.ink }}>
                          Installments ({(summary?.installments || installment?.items || []).length || (installment ? 1 : 0)})
                        </h3>
                        {(summary?.installments || installment?.items || (installment?.installment_id ? [installment] : [])).length === 0 ? (
                          <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>None</p>
                        ) : (
                          <div className="space-y-2">
                            {(summary?.installments || installment?.items || [installment]).map((inst) => (
                              <div key={inst.installment_id} className="text-[12px] flex justify-between gap-2" style={{ color: COLORS.graphite }}>
                                <span>{formatPKR(inst.per_payout)} / payout · {formatPKR(inst.balance)} left</span>
                                <span style={{ color: COLORS.ink }}>{formatPKR(inst.principal)} total</span>
                              </div>
                            ))}
                            {installment && (
                              <div className="text-[11.5px] font-semibold pt-1" style={{ color: COLORS.rust, borderTop: `1px solid ${COLORS.border}` }}>
                                Combined left {formatPKR(installment.balance)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl p-4 mb-3" style={{ border: `1px solid ${COLORS.border}` }}>
                        <h3 className="text-[13px] font-semibold mb-2" style={{ color: COLORS.ink }}>
                          Advances ({(summary?.advances || advance?.items || []).length || (advance ? 1 : 0)})
                        </h3>
                        {(summary?.advances || advance?.items || (advance?.advance_id ? [advance] : [])).length === 0 ? (
                          <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>None</p>
                        ) : (
                          <div className="space-y-2">
                            {(summary?.advances || advance?.items || [advance]).map((adv) => (
                              <div key={adv.advance_id} className="text-[12px] flex justify-between gap-2" style={{ color: COLORS.graphite }}>
                                <span>Given {formatPKR(adv.original_amount)}</span>
                                <span style={{ color: COLORS.goldDim }}>left {formatPKR(adv.remaining_amount)}</span>
                              </div>
                            ))}
                            {advance && (
                              <div className="text-[11.5px] font-semibold pt-1" style={{ color: COLORS.goldDim, borderTop: `1px solid ${COLORS.border}` }}>
                                Combined left {formatPKR(advance.remaining_amount)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {tab === "history" && (
                <>
                  <div className="rounded-2xl overflow-hidden mb-5" style={{ border: `1px solid ${COLORS.border}` }}>
                    <div className="px-5 py-3.5" style={{ background: COLORS.boneDim }}>
                      <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>Payout history</h3>
                      <p className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                        Kept for analytics — production logs are never deleted when you pay.
                      </p>
                    </div>
                    <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: COLORS.border }}>
                      {(summary.payouts || []).length === 0 && (
                        <p className="px-5 py-8 text-center text-[12.5px]" style={{ color: COLORS.graphiteLight }}>
                          No payouts recorded yet.
                        </p>
                      )}
                      {(summary.payouts || []).map((p) => (
                        <div key={p.payout_id} className="px-5 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
                                {formatDateLabel(p.paid_at)}
                              </div>
                              <div className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                                Gross {formatPKR(p.gross_payable)}
                                {p.installment_deduct > 0 ? ` · −inst ${formatPKR(p.installment_deduct)}` : ""}
                                {p.advance_deduct > 0 ? ` · −adv ${formatPKR(p.advance_deduct)}` : ""}
                              </div>
                            </div>
                            <div className="text-[14px] font-semibold" style={{ color: COLORS.green }}>
                              {formatPKR(p.net_paid)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(summary.settlements || []).filter((s) => s.paid).length > 0 && (
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                      <div className="px-5 py-3" style={{ background: COLORS.boneDim }}>
                        <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>Settlements already paid</h3>
                      </div>
                      <div className="divide-y max-h-56 overflow-y-auto" style={{ borderColor: COLORS.border }}>
                        {summary.settlements.filter((s) => s.paid).slice(0, 40).map((s) => (
                          <div key={s.settlement_id} className="px-5 py-2.5 flex flex-wrap justify-between gap-2 text-[12px]">
                            <span style={{ color: COLORS.graphite }}>
                              ATM {s.atm_no} · {s.article_name}
                            </span>
                            <span className="font-semibold" style={{ color: COLORS.ink }}>{formatPKR(s.payable_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4" style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
          <div className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
            {settledUnpaid > 0
              ? "Only unpaid settled work is billed · raw history is separate"
              : "Nothing to pay · raw in range is history only"}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12.5px]" style={{ color: COLORS.graphite }}>Net payable now</span>
            <span className="text-[18px] font-semibold" style={{ color: settledUnpaid > 0 ? COLORS.ink : COLORS.green }}>
              {formatPKR(preview?.net_pay || 0)}
            </span>
            {onPaid ? (
              <button
                type="button"
                className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
                style={{ background: settledUnpaid > 0 ? COLORS.gold : COLORS.graphite, color: COLORS.inkSurface }}
                disabled={paying || settledUnpaid <= 0}
                onClick={recordPayment}
              >
                {paying ? "Paying…" : settledUnpaid > 0 ? "Record payment" : "All paid"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}
