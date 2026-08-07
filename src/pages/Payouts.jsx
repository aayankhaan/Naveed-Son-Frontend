// ========================================
// Payouts.jsx
// Pay-anytime sheet: production since last pay, settled, loan deductions,
// net payable. Record one or all. History kept for analytics.
// ========================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { FONT, COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import MiniStat from "../components/ui/MiniStat";
import EmployeePayModal from "../components/employees/EmployeePayModal";
import AtmLaborPdf from "../components/employees/AtmLaborPdf";
import { SearchIcon } from "../components/icons/CommonIcons";
import { API_BASE, apiFetch } from "../lib/api";
import { STATION_ORDER } from "../lib/productionFlow";

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

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatRangeLabel(from, to) {
  if (!from || !to) return "";
  const fmt = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

function BanknoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8.25" r="2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.7 14c.6-3 2.4-4.6 4.3-4.6S10 11 10.6 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CoinsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse cx="6" cy="4.3" rx="4.2" ry="2.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.8 4.3v4c0 1.3 1.9 2.3 4.2 2.3s4.2-1 4.2-2.3v-4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function AtmLaborPanel({
  atmList,
  atmOrderId,
  setAtmOrderId,
  atmStation,
  setAtmStation,
  atmEmployeeId,
  setAtmEmployeeId,
  atmReport,
  atmLoading,
  atmPdfBusy,
  onDownloadPdf,
  onOpenProof,
  onBackToAtm,
  onPayOne,
  onPayAllUnpaid,
  paying,
}) {
  const selectedAtm = atmList.find((o) => String(o.order_id) === String(atmOrderId));
  const filteredToEmployee = Boolean(atmEmployeeId);
  const unpaidWorkers = (atmReport?.employees || []).filter((e) => Number(e.atm_unpaid) > 0);
  const unpaidNet = unpaidWorkers.reduce((s, e) => s + (Number(e.net) || 0), 0);

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl px-4 py-4 flex flex-wrap items-end gap-3"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
      >
        {filteredToEmployee && (
          <button
            type="button"
            className="btn-secondary text-[12px] font-semibold px-3 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
            onClick={() => onBackToAtm?.()}
          >
            ← Back to ATM
          </button>
        )}
        <label className="block min-w-[14rem] flex-1">
          <span className="form-label">ATM</span>
          <select
            className="form-input w-full"
            value={atmOrderId}
            onChange={(e) => setAtmOrderId(e.target.value)}
          >
            <option value="">Select ATM…</option>
            {atmList.map((o) => (
              <option key={o.order_id} value={o.order_id}>
                {o.shipped ? "✓" : "·"} ATM {o.atm_no} · {o.customer}
                {!o.shipped ? " (not shipped)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[10rem]">
          <span className="form-label">Department</span>
          <select
            className="form-input w-full"
            value={atmStation}
            onChange={(e) => setAtmStation(e.target.value)}
            disabled={!atmOrderId}
          >
            <option value="all">All departments</option>
            {STATION_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[12rem] flex-1">
          <span className="form-label">Employee (optional)</span>
          <select
            className="form-input w-full"
            value={atmEmployeeId}
            onChange={(e) => setAtmEmployeeId(e.target.value)}
            disabled={!atmReport?.shipped}
          >
            <option value="">All workers on ATM</option>
            {(atmReport?.worker_options || atmReport?.employees || []).map((e) => (
              <option key={e.employee_id} value={e.employee_id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </label>
        {atmReport?.shipped && (
          <button
            type="button"
            className="btn-secondary text-[12px] font-semibold px-3 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.ink, opacity: atmPdfBusy ? 0.7 : 1 }}
            disabled={atmPdfBusy}
            onClick={() =>
              atmEmployeeId
                ? onDownloadPdf("employee", Number(atmEmployeeId))
                : onDownloadPdf("merged")
            }
          >
            {atmPdfBusy ? "PDF…" : "Download PDF"}
          </button>
        )}
        {atmReport?.shipped && unpaidWorkers.length > 0 && (
          <button
            type="button"
            className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-lg"
            style={{
              background: COLORS.gold,
              color: COLORS.inkSurface,
              opacity: paying ? 0.7 : 1,
            }}
            disabled={paying}
            onClick={() => onPayAllUnpaid?.(unpaidWorkers)}
          >
            {paying ? "Paying…" : `Clear unpaid (${unpaidWorkers.length}) · ${formatPKR(unpaidNet)}`}
          </button>
        )}
      </div>

      {!atmOrderId ? (
        <div
          className="rounded-2xl px-6 py-14 text-center"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
        >
          Select a shipped ATM to see labor cost and who worked what.
        </div>
      ) : atmLoading ? (
        <div className="rounded-2xl h-40 animate-pulse" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
      ) : !atmReport?.shipped ? (
        <div
          className="rounded-2xl px-6 py-14 text-center"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
            Can&apos;t calculate
          </div>
          <p className="text-[13px] mt-1.5" style={{ color: COLORS.graphite }}>
            {atmReport?.message || "Order isn't shipped yet."}
            {selectedAtm ? ` · ATM ${selectedAtm.atm_no}` : ""}
          </p>
          <Link to="/shipment" className="inline-block mt-3 text-[12.5px] font-semibold" style={{ color: COLORS.goldDim }}>
            Go to Shipment
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat
              index={0}
              icon={<UsersIcon />}
              label="Workers"
              value={atmReport.totals.employee_count}
              sub={`ATM ${atmReport.order.atm_no}`}
            />
            <MiniStat
              index={1}
              icon={<CoinsIcon />}
              label="Made / shipped"
              value={`${Math.round(atmReport.totals.qty_made).toLocaleString()} → ${Math.round(atmReport.totals.qty_shipped).toLocaleString()}`}
              sub={`waste ${Math.round(atmReport.totals.ship_waste).toLocaleString()} · ratio ${Math.round((atmReport.totals.shipment_ratio || 0) * 100)}%`}
            />
            <MiniStat
              index={2}
              icon={<BanknoteIcon />}
              label="Labor cost"
              value={formatPKR(atmReport.totals.labor_cost)}
              sub={`work bill ${formatPKR(atmReport.totals.bill)} × ship ratio`}
            />
            <MiniStat
              index={3}
              icon={<BanknoteIcon />}
              label="Net after loans"
              value={formatPKR(atmReport.totals.net)}
              sub={`unpaid ${formatPKR(atmReport.totals.atm_unpaid)}`}
            />
          </div>

          {(atmReport.departments || []).map((dept) => (
            <div
              key={dept.station}
              className="rounded-2xl overflow-hidden"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              <div
                className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                style={{ background: COLORS.boneDim, borderBottom: `1px solid ${COLORS.border}` }}
              >
                <div>
                  <span className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>
                    {dept.station}
                  </span>
                  <span className="text-[11.5px] ml-2" style={{ color: COLORS.graphiteLight }}>
                    {dept.employees.length} worker{dept.employees.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="text-[12px] font-semibold tabular-nums" style={{ color: COLORS.goldDim }}>
                  Labor {formatPKR(dept.atm_payout)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr>
                      {["Worker", "Pieces", "Qty", "Bill", "Waste", "ATM payout", "−Inst", "−Adv", "Final", ""].map((h) => (
                        <th
                          key={h || "pay"}
                          className={`font-semibold px-3 py-2.5 uppercase text-[10px] tracking-wide ${
                            h === "Worker" || h === "Pieces" ? "text-left" : "text-right"
                          }`}
                          style={{ color: COLORS.graphite }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dept.employees.map((emp) => (
                      <tr key={`${dept.station}-${emp.employee_id}`} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => setAtmEmployeeId(String(emp.employee_id))}
                          >
                            <span className="font-semibold hover:underline" style={{ color: COLORS.ink }}>
                              {emp.full_name}
                            </span>
                            <span className="block text-[10.5px]" style={{ color: COLORS.graphiteLight }}>
                              Filter to this worker
                            </span>
                          </button>
                          <div className="flex gap-2 mt-1">
                            <button
                              type="button"
                              className="text-[10.5px] font-semibold"
                              style={{ color: COLORS.goldDim }}
                              onClick={() => onDownloadPdf("employee", emp.employee_id)}
                              disabled={atmPdfBusy}
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              className="text-[10.5px] font-semibold"
                              style={{ color: COLORS.graphite }}
                              onClick={() => onOpenProof?.(emp)}
                            >
                              Full proof
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3" style={{ color: COLORS.graphite }}>
                          {(emp.items || []).map((it) => it.article_name).join(", ") || "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{Math.round(emp.qty_made).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatPKR(emp.bill)}</td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: COLORS.rust }}>
                          {Math.round(emp.waste_qty || 0).toLocaleString()}
                          <span className="block text-[10px]">{formatPKR(emp.waste_money)}</span>
                          {(emp.ship_waste_qty > 0 || emp.floor_waste_qty > 0) && (
                            <span className="block text-[9.5px]" style={{ color: COLORS.graphiteLight }}>
                              ship {Math.round(emp.ship_waste_qty || 0)}
                              {emp.floor_waste_qty ? ` · floor ${Math.round(emp.floor_waste_qty)}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{formatPKR(emp.atm_payout)}</td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: COLORS.rust }}>
                          {emp.installment_deduct ? `−${formatPKR(emp.installment_deduct)}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: COLORS.rust }}>
                          {emp.advance_deduct ? `−${formatPKR(emp.advance_deduct)}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums" style={{ color: COLORS.green }}>
                          {formatPKR(emp.net)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="btn-primary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg"
                            style={{
                              background: Number(emp.atm_unpaid) > 0 ? COLORS.gold : COLORS.boneDim,
                              color: COLORS.ink,
                            }}
                            disabled={paying || !(Number(emp.atm_unpaid) > 0)}
                            onClick={() => onPayOne?.(emp)}
                          >
                            {Number(emp.atm_unpaid) > 0 ? "Pay" : "Paid"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {!(atmReport.departments || []).length && (
            <div
              className="rounded-2xl px-6 py-10 text-center"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            >
              No labor logged for this filter on ATM {atmReport.order.atm_no}.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PayoutsPage() {
  const [tab, setTab] = useState("sheet"); // sheet | atm | history
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [onlyPayable, setOnlyPayable] = useState(true);
  const [deptFilter, setDeptFilter] = useState("all"); // all | floor | management
  const [selected, setSelected] = useState(() => new Set());
  const [paying, setPaying] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [proofEmployee, setProofEmployee] = useState(null);

  // ATM labor tab
  const [atmList, setAtmList] = useState([]);
  const [atmOrderId, setAtmOrderId] = useState("");
  const [atmStation, setAtmStation] = useState("all");
  const [atmEmployeeId, setAtmEmployeeId] = useState("");
  const [atmReport, setAtmReport] = useState(null);
  const [atmLoading, setAtmLoading] = useState(false);
  const [atmPdfBusy, setAtmPdfBusy] = useState(false);

  // Date range for period check (empty = since last pay / all recent history)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [periodMeta, setPeriodMeta] = useState({ mode: "since_last", from: null, to: null });

  const isRange = periodMeta.mode === "range" && appliedFrom && appliedTo;

  const loadSheet = useCallback(async (from = appliedFrom, to = appliedTo) => {
    setLoading(true);
    setLoadError("");
    try {
      const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "";
      const res = await apiFetch(`/api/payouts/sheet${qs}`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load payout sheet"));
      const data = await res.json();
      setRows(Array.isArray(data.employees) ? data.employees : []);
      setSummary(data.summary || null);
      setPeriodMeta(data.period || { mode: "since_last", from: null, to: null });
      setSelected(new Set((data.employees || []).filter((e) => e.can_pay).map((e) => e.employee_id)));
    } catch (err) {
      setLoadError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo]);

  const loadHistory = useCallback(async (from = appliedFrom, to = appliedTo) => {
    try {
      const qs = new URLSearchParams({ limit: "80" });
      if (from && to) {
        qs.set("from", from);
        qs.set("to", to);
      }
      const res = await apiFetch(`/api/payouts/history?${qs}`);
      if (!res.ok) return;
      setHistory(await res.json());
    } catch {
      /* ignore */
    }
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    loadSheet();
    loadHistory();
  }, [loadSheet, loadHistory]);

  const loadAtmList = useCallback(async () => {
    try {
      const res = await apiFetch("/api/payouts/atm-list");
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load ATMs"));
      const data = await res.json();
      setAtmList(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setLoadError(err.message || "Failed to load ATMs");
    }
  }, []);

  const loadAtmReport = useCallback(async () => {
    if (!atmOrderId) {
      setAtmReport(null);
      return;
    }
    setAtmLoading(true);
    setLoadError("");
    try {
      const qs = new URLSearchParams();
      if (atmStation && atmStation !== "all") qs.set("station", atmStation);
      if (atmEmployeeId) qs.set("employee_id", atmEmployeeId);
      const q = qs.toString();
      const res = await apiFetch(`/api/payouts/atm/${atmOrderId}${q ? `?${q}` : ""}`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load ATM labor"));
      setAtmReport(await res.json());
    } catch (err) {
      setAtmReport(null);
      setLoadError(err.message || "Failed to load ATM labor");
    } finally {
      setAtmLoading(false);
    }
  }, [atmOrderId, atmStation, atmEmployeeId]);

  useEffect(() => {
    if (tab === "atm") {
      loadAtmList();
    }
  }, [tab, loadAtmList]);

  useEffect(() => {
    if (tab === "atm" && atmOrderId) {
      loadAtmReport();
    }
  }, [tab, atmOrderId, loadAtmReport]);

  async function downloadAtmPdf(mode = "merged", employeeId = null) {
    if (!atmReport) return;
    setAtmPdfBusy(true);
    try {
      const blob = await pdf(
        <AtmLaborPdf report={atmReport} mode={mode} employeeId={employeeId} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const atm = atmReport.order?.atm_no || atmOrderId;
      link.download =
        mode === "employee" && employeeId
          ? `ATM-${atm}-emp-${employeeId}.pdf`
          : `ATM-${atm}-labor.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setActionErr("Couldn't generate ATM PDF");
    } finally {
      setAtmPdfBusy(false);
    }
  }

  async function payAtmOne(emp) {
    if (!atmOrderId || !(Number(emp.atm_unpaid) > 0)) return;
    if (
      !window.confirm(
        `Clear ATM payment for ${emp.full_name}?\nNet ${formatPKR(emp.net)} (this ATM only)`
      )
    ) {
      return;
    }
    setPaying(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await apiFetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: emp.employee_id,
          order_id: Number(atmOrderId),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Payout failed"));
      const data = await res.json();
      setActionMsg(`Paid ${emp.full_name} on this ATM · ${formatPKR(data.net_paid)}`);
      await loadAtmReport();
      await loadSheet();
      await loadHistory();
    } catch (err) {
      setActionErr(err.message || "Payout failed");
    } finally {
      setPaying(false);
    }
  }

  async function payAtmAllUnpaid(workers) {
    const ids = (workers || [])
      .filter((e) => Number(e.atm_unpaid) > 0)
      .map((e) => e.employee_id);
    if (!atmOrderId || !ids.length) return;
    const net = (workers || []).reduce((s, e) => s + (Number(e.net) || 0), 0);
    if (
      !window.confirm(
        `Clear unpaid for ${ids.length} worker(s) on this ATM?\nNet about ${formatPKR(net)}`
      )
    ) {
      return;
    }
    setPaying(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await apiFetch("/api/payouts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_ids: ids,
          order_id: Number(atmOrderId),
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Batch payout failed"));
      const data = await res.json();
      setActionMsg(
        `Paid ${data.paid_count} on this ATM · net ${formatPKR(data.net_total)}` +
          (data.skipped_count ? ` · ${data.skipped_count} skipped` : "")
      );
      await loadAtmReport();
      await loadSheet();
      await loadHistory();
    } catch (err) {
      setActionErr(err.message || "Payout failed");
    } finally {
      setPaying(false);
    }
  }

  function applyDateRange() {
    if (!fromDate || !toDate) {
      setLoadError("Pick both From and To dates");
      return;
    }
    if (fromDate > toDate) {
      setLoadError("From date must be on or before To date");
      return;
    }
    setLoadError("");
    setOnlyPayable(false); // show everyone in the period for checking
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  }

  function clearDateRange() {
    setFromDate("");
    setToDate("");
    setAppliedFrom("");
    setAppliedTo("");
    setOnlyPayable(true);
  }

  function applyPreset(preset) {
    let from = "";
    let to = todayISO();
    if (preset === "15") from = daysAgoISO(15);
    else if (preset === "30") from = daysAgoISO(30);
    else if (preset === "month") from = monthStartISO();
    setFromDate(from);
    setToDate(to);
    setOnlyPayable(false);
    setAppliedFrom(from);
    setAppliedTo(to);
    setLoadError("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyPayable && !r.can_pay) return false;
      if (deptFilter === "management" && !r.is_management) return false;
      if (deptFilter === "floor" && r.is_management) return false;
      if (!q) return true;
      return (
        String(r.full_name || "").toLowerCase().includes(q) ||
        String(r.station || "").toLowerCase().includes(q) ||
        String(r.employee_id).includes(q)
      );
    });
  }, [rows, search, onlyPayable, deptFilter]);

  const selectedPayableIds = useMemo(
    () => filtered.filter((r) => r.can_pay && selected.has(r.employee_id)).map((r) => r.employee_id),
    [filtered, selected]
  );

  const selectedNet = useMemo(() => {
    return filtered
      .filter((r) => selected.has(r.employee_id) && r.can_pay)
      .reduce((s, r) => s + (Number(r.net_payable) || 0), 0);
  }, [filtered, selected]);

  function toggleOne(id, canPay) {
    if (!canPay) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const payable = filtered.filter((r) => r.can_pay);
    const allOn = payable.every((r) => selected.has(r.employee_id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of payable) {
        if (allOn) next.delete(r.employee_id);
        else next.add(r.employee_id);
      }
      return next;
    });
  }

  async function paySelected() {
    if (!selectedPayableIds.length) return;
    if (
      !window.confirm(
        `Record payment for ${selectedPayableIds.length} employee(s)?\nNet total ${formatPKR(selectedNet)}`
      )
    ) {
      return;
    }
    setPaying(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await apiFetch("/api/payouts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_ids: selectedPayableIds }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Batch payout failed"));
      const data = await res.json();
      setActionMsg(
        `Paid ${data.paid_count} employee(s) · net ${formatPKR(data.net_total)}` +
          (data.skipped_count ? ` · ${data.skipped_count} skipped` : "")
      );
      await loadSheet();
      await loadHistory();
    } catch (err) {
      setActionErr(err.message || "Payout failed");
    } finally {
      setPaying(false);
    }
  }

  async function payOne(row) {
    if (!row.can_pay) return;
    if (!window.confirm(`Pay ${row.full_name} ${formatPKR(row.net_payable)}?`)) return;
    setPaying(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await apiFetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: row.employee_id }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Payout failed"));
      const data = await res.json();
      setActionMsg(`Paid ${row.full_name} · ${formatPKR(data.net_paid)}`);
      await loadSheet();
      await loadHistory();
    } catch (err) {
      setActionErr(err.message || "Payout failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <AppShell
      title="Payouts"
      subtitle="Pay sheet · ATM labor after ship · history"
      maxWidth="80rem"
      actions={
        <>
          <button
            type="button"
            className="btn-secondary text-[12px] font-semibold px-3 py-2 rounded-xl"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
            onClick={() => {
              if (tab === "atm") {
                loadAtmList();
                loadAtmReport();
              } else {
                loadSheet();
                loadHistory();
              }
            }}
          >
            Refresh
          </button>
          {tab === "atm" && atmReport?.shipped && (
            <button
              type="button"
              className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-xl"
              style={{ background: COLORS.gold, color: COLORS.inkSurface, opacity: atmPdfBusy ? 0.7 : 1 }}
              disabled={atmPdfBusy}
              onClick={() =>
                atmEmployeeId
                  ? downloadAtmPdf("employee", Number(atmEmployeeId))
                  : downloadAtmPdf("merged")
              }
            >
              {atmPdfBusy ? "PDF…" : atmEmployeeId ? "Download employee PDF" : "Download ATM sheet"}
            </button>
          )}
          {tab === "sheet" && (
            <button
              type="button"
              className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-xl"
              style={{
                background: selectedPayableIds.length ? COLORS.gold : COLORS.graphite,
                color: COLORS.inkSurface,
              }}
              disabled={paying || !selectedPayableIds.length}
              onClick={paySelected}
            >
              {paying ? "Paying…" : `Pay selected (${selectedPayableIds.length})`}
            </button>
          )}
        </>
      }
    >
          {(loadError || actionErr || actionMsg) && (
            <div className="space-y-2 mb-5">
              {loadError && (
                <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
                  {loadError}
                </div>
              )}
              {actionErr && (
                <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
                  {actionErr}
                </div>
              )}
              {actionMsg && (
                <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
                  {actionMsg}
                </div>
              )}
            </div>
          )}

          <div
            className="rounded-2xl px-5 py-3.5 mb-6 text-[12.5px]"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
          >
            {tab === "atm" ? (
              <>
                <strong style={{ color: COLORS.ink }}>ATM labor:</strong> Pick a shipped ATM.
                See who worked which pieces, waste, and labor cost. Filter by department or click a
                name for one contractor. PDF available. Unshipped ATMs can&apos;t calculate yet.
              </>
            ) : (
              <>
                <strong style={{ color: COLORS.ink }}>How it works:</strong> Settled = shipped work × ratio.
                Net = settled − installment − advance. Use the date range below to <strong style={{ color: COLORS.ink }}>check</strong> a
                period (raw / settled / paid out). Pay buttons always use current unpaid.
              </>
            )}
          </div>

          {tab !== "atm" && (
          <div
            className="rounded-2xl px-4 py-3.5 mb-6 flex flex-wrap items-end gap-3"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <div>
              <label className="form-label" style={{ marginBottom: 4 }}>From</label>
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ minWidth: 150 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ marginBottom: 4 }}>To</label>
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ minWidth: 150 }}
              />
            </div>
            <button
              type="button"
              className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-lg"
              style={{ background: COLORS.inkSurface, color: COLORS.gold }}
              onClick={applyDateRange}
            >
              Show period
            </button>
            {isRange && (
              <button
                type="button"
                className="btn-secondary text-[12px] font-semibold px-3 py-2 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
                onClick={clearDateRange}
              >
                Clear (since last pay)
              </button>
            )}
            <div className="flex flex-wrap gap-1.5 ml-auto">
              {[
                { id: "15", label: "Last 15 days" },
                { id: "30", label: "Last 30 days" },
                { id: "month", label: "This month" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: appliedFrom === (p.id === "month" ? monthStartISO() : daysAgoISO(Number(p.id))) && appliedTo === todayISO()
                      ? COLORS.goldSoft
                      : COLORS.boneDim,
                    color: COLORS.graphite,
                  }}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {isRange && (
              <p className="w-full text-[12px] m-0" style={{ color: COLORS.goldDim }}>
                Showing sheet for <strong style={{ color: COLORS.ink }}>{formatRangeLabel(appliedFrom, appliedTo)}</strong>
              </p>
            )}
          </div>
          )}

          {tab !== "atm" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {isRange ? (
              <>
                <MiniStat
                  index={0}
                  icon={<CoinsIcon />}
                  label="Raw in period"
                  value={formatPKR(summary?.period?.raw_logged || summary?.raw_logged || 0)}
                  sub={formatRangeLabel(appliedFrom, appliedTo)}
                />
                <MiniStat
                  index={1}
                  icon={<BanknoteIcon />}
                  label="Settled in period"
                  value={formatPKR(summary?.period?.settled_total || 0)}
                  sub={`unpaid ${formatPKR(summary?.period?.settled_unpaid || 0)} · paid ${formatPKR(summary?.period?.settled_paid || 0)}`}
                />
                <MiniStat
                  index={2}
                  icon={<BanknoteIcon />}
                  label="Paid out in period"
                  value={formatPKR(summary?.period?.paid_out || 0)}
                  sub={`${summary?.period?.payouts_count || 0} payout(s) · −loans ${formatPKR((summary?.period?.paid_installment || 0) + (summary?.period?.paid_advance || 0))}`}
                />
                <MiniStat
                  index={3}
                  icon={<UsersIcon />}
                  label="Still ready to pay"
                  value={formatPKR(summary?.net_payable || 0)}
                  sub={`${summary?.employees_payable ?? 0} employees (current unpaid)`}
                />
              </>
            ) : (
              <>
                <MiniStat
                  index={0}
                  icon={<UsersIcon />}
                  label="Ready to pay"
                  value={summary?.employees_payable ?? 0}
                  sub={`of ${summary?.employees_total ?? 0} employees`}
                />
                <MiniStat
                  index={1}
                  icon={<CoinsIcon />}
                  label="Settled unpaid"
                  value={formatPKR(summary?.settled_unpaid || 0)}
                  sub={`raw since last pay ${formatPKR(summary?.raw_logged || 0)}`}
                />
                <MiniStat
                  index={2}
                  icon={<BanknoteIcon />}
                  label="Loan deductions"
                  value={formatPKR((summary?.installment_deduct || 0) + (summary?.advance_deduct || 0))}
                  sub="installment + advance"
                />
                <MiniStat
                  index={3}
                  icon={<BanknoteIcon />}
                  label="Net to hand over"
                  value={formatPKR(summary?.net_payable || 0)}
                  sub={selectedPayableIds.length ? `selected ${formatPKR(selectedNet)}` : "all payable"}
                />
              </>
            )}
          </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div
              className="flex p-1 rounded-xl"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              {[
                { id: "sheet", label: "Pay sheet" },
                { id: "atm", label: "By ATM" },
                { id: "history", label: "History" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="px-3.5 py-2 text-[12.5px] font-semibold rounded-lg"
                  style={{
                    background: tab === t.id ? COLORS.inkSurface : "transparent",
                    color: tab === t.id ? COLORS.onDark : COLORS.graphite,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "sheet" && (
              <>
                <div className="search-wrap">
                  <SearchIcon />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search employee…"
                  />
                </div>
                <div className="select-wrap">
                  <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                    <option value="all">All staff</option>
                    <option value="floor">Floor (piece-rate)</option>
                    <option value="management">Management only</option>
                  </select>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <label className="inline-flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: COLORS.graphite }}>
                  <input
                    type="checkbox"
                    checked={onlyPayable}
                    onChange={(e) => setOnlyPayable(e.target.checked)}
                  />
                  Only with payable
                </label>
              </>
            )}
            {tab === "history" && isRange && (
              <span className="text-[12px]" style={{ color: COLORS.graphiteLight }}>
                History filtered to {formatRangeLabel(appliedFrom, appliedTo)}
              </span>
            )}
          </div>

          {tab === "atm" ? (
            <AtmLaborPanel
              atmList={atmList}
              atmOrderId={atmOrderId}
              setAtmOrderId={(id) => {
                setAtmOrderId(id);
                setAtmEmployeeId("");
              }}
              atmStation={atmStation}
              setAtmStation={setAtmStation}
              atmEmployeeId={atmEmployeeId}
              setAtmEmployeeId={setAtmEmployeeId}
              atmReport={atmReport}
              atmLoading={atmLoading}
              atmPdfBusy={atmPdfBusy}
              onDownloadPdf={downloadAtmPdf}
              onOpenProof={(emp) => {
                setProofEmployee({
                  id: `EMP-${emp.employee_id}`,
                  e_id: emp.employee_id,
                  employee_id: emp.employee_id,
                  full_name: emp.full_name,
                  name: emp.full_name,
                  station: emp.station,
                });
              }}
              onBackToAtm={() => setAtmEmployeeId("")}
              onPayOne={payAtmOne}
              onPayAllUnpaid={payAtmAllUnpaid}
              paying={paying}
            />
          ) : loading ? (
            <div className="rounded-2xl h-40 animate-pulse" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
          ) : tab === "history" ? (
            history.length === 0 ? (
              <div className="rounded-2xl px-6 py-14 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}>
                No payouts recorded yet.
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr style={{ background: COLORS.boneDim }}>
                        {["When", "Employee", "Raw", "Settled", "Inst.", "Adv.", "Net paid"].map((h) => (
                          <th
                            key={h}
                            className={`font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide ${h === "When" || h === "Employee" ? "text-left" : "text-right"}`}
                            style={{ color: COLORS.graphite }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((p) => (
                        <tr key={p.payout_id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                          <td className="px-4 py-3" style={{ color: COLORS.graphiteLight }}>{formatWhen(p.paid_at)}</td>
                          <td className="px-4 py-3 font-medium" style={{ color: COLORS.ink }}>
                            {p.full_name}
                            <span className="block text-[10.5px] font-normal" style={{ color: COLORS.graphiteLight }}>{p.station}</span>
                          </td>
                          <td className="px-4 py-3 text-right" style={{ color: COLORS.graphite }}>{formatPKR(p.raw_logged)}</td>
                          <td className="px-4 py-3 text-right" style={{ color: COLORS.ink }}>{formatPKR(p.gross_payable)}</td>
                          <td className="px-4 py-3 text-right" style={{ color: COLORS.rust }}>
                            {p.installment_deduct ? `−${formatPKR(p.installment_deduct)}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right" style={{ color: COLORS.rust }}>
                            {p.advance_deduct ? `−${formatPKR(p.advance_deduct)}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold" style={{ color: COLORS.green }}>
                            {formatPKR(p.net_paid)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl px-6 py-14 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
                Nobody to pay right now
              </div>
              <p className="text-[13px] mt-1.5 max-w-md mx-auto" style={{ color: COLORS.graphite }}>
                Ship completed orders first so settlements unlock.{" "}
                <Link to="/shipment" style={{ color: COLORS.goldDim }}>Go to Shipment</Link>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden panel" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ background: COLORS.boneDim }}>
                      <th className="px-4 py-2.5 text-left">
                        <input
                          type="checkbox"
                          checked={
                            filtered.filter((r) => r.can_pay).length > 0 &&
                            filtered.filter((r) => r.can_pay).every((r) => selected.has(r.employee_id))
                          }
                          onChange={toggleAllVisible}
                          aria-label="Select all payable"
                        />
                      </th>
                      <th className="text-left font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Employee</th>
                      <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>
                        {isRange ? "Raw (period)" : "Raw"}
                      </th>
                      <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>
                        {isRange ? "Settled (period)" : "Settled"}
                      </th>
                      {isRange ? (
                        <>
                          <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Paid out</th>
                          <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Loans paid</th>
                        </>
                      ) : (
                        <>
                          <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Inst.</th>
                          <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Adv.</th>
                        </>
                      )}
                      <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>
                        {isRange ? "Net due now" : "Net"}
                      </th>
                      <th className="text-right font-semibold px-4 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.employee_id}
                        className="tbl-row"
                        style={{ borderTop: `1px solid ${COLORS.border}`, opacity: r.can_pay || isRange ? 1 : 0.55 }}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            disabled={!r.can_pay}
                            checked={selected.has(r.employee_id)}
                            onChange={() => toggleOne(r.employee_id, r.can_pay)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 overflow-hidden"
                              style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
                            >
                              {r.image_link ? (
                                <img src={getImageUrl(r.image_link)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                initials(r.full_name)
                              )}
                            </span>
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => setProofEmployee({
                                id: `EMP-${r.employee_id}`,
                                name: r.full_name,
                                station: r.station || "",
                                joined: "—",
                                image: r.image_link || "",
                              })}
                            >
                              <div className="font-semibold truncate hover:underline" style={{ color: COLORS.ink }}>{r.full_name}</div>
                              <div className="text-[10.5px]" style={{ color: COLORS.graphiteLight }}>
                                EMP-{r.employee_id}
                                {r.station ? ` · ${r.station}` : ""}
                                {r.is_management && r.monthly_salary
                                  ? ` · ${formatPKR(r.monthly_salary)}/mo · day ${r.pay_day || "—"}`
                                  : isRange
                                    ? ` · ${r.units || 0} pcs`
                                    : r.since_last_payout
                                      ? ` · since ${r.since_last_payout}`
                                      : " · first pay"}
                              </div>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums" style={{ color: COLORS.graphite }}>
                          {formatPKR(r.raw_logged)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums" style={{ color: COLORS.ink }}>
                          {isRange ? (
                            <>
                              {formatPKR(r.period?.settled_total || 0)}
                              <span className="block text-[10px] font-normal" style={{ color: COLORS.graphiteLight }}>
                                unpaid {formatPKR(r.period?.settled_unpaid || 0)}
                              </span>
                            </>
                          ) : (
                            formatPKR(r.settled_unpaid)
                          )}
                        </td>
                        {isRange ? (
                          <>
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: (r.period?.paid_out || 0) > 0 ? COLORS.green : COLORS.graphiteLight }}>
                              {formatPKR(r.period?.paid_out || 0)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: COLORS.rust }}>
                              {(r.period?.paid_installment || 0) + (r.period?.paid_advance || 0)
                                ? `−${formatPKR((r.period?.paid_installment || 0) + (r.period?.paid_advance || 0))}`
                                : "—"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: r.installment_deduct ? COLORS.rust : COLORS.graphiteLight }}>
                              {r.installment_deduct ? `−${formatPKR(r.installment_deduct)}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: r.advance_deduct ? COLORS.rust : COLORS.graphiteLight }}>
                              {r.advance_deduct ? `−${formatPKR(r.advance_deduct)}` : "—"}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: r.net_payable > 0 ? COLORS.ink : COLORS.graphiteLight }}>
                          {formatPKR(r.net_payable)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="btn-primary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg"
                            style={{
                              background: r.can_pay ? COLORS.gold : COLORS.boneDim,
                              color: COLORS.ink,
                            }}
                            disabled={!r.can_pay || paying}
                            onClick={() => payOne(r)}
                          >
                            Pay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {proofEmployee && (
        <EmployeePayModal
          employee={proofEmployee}
          onClose={() => setProofEmployee(null)}
          onPaid={() => { loadSheet(); loadHistory(); }}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }
        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: ${COLORS.graphite}; margin-bottom: 4px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.bone};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .form-input:hover, .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 240px;
        }
        .search-wrap input:hover, .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .select-wrap { position: relative; display: inline-flex; align-items: center; }
        .select-wrap select {
          appearance: none; font-family: ${FONT}; font-size: 12.5px; font-weight: 500;
          color: ${COLORS.ink}; background: ${COLORS.card}; border: 1px solid ${COLORS.border};
          border-radius: 8px; padding: 8px 28px 8px 12px; cursor: pointer; outline: none;
        }
        .select-wrap select:hover, .select-wrap select:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .select-caret { position: absolute; right: 10px; pointer-events: none; }
        .tbl-row:hover { background: ${COLORS.boneDim}77; }
        .btn-primary:hover:not(:disabled) { filter: brightness(1.05); }
        .btn-primary:disabled { cursor: not-allowed; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .stat-card { transition: transform .18s ease, box-shadow .18s ease; }
        .stat-card:hover { transform: translateY(-3px); border-color: ${COLORS.gold} !important; }
      `}</style>
    </AppShell>
  );
}
