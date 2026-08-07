// ========================================
// LoansTab.jsx
// Installments (fixed per 15-day payout) + Advances (deduct what they
// can next cycle, roll leftover). Setup UI before full payout engine.
// ========================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { COLORS, FONT } from "../../constants/theme";
import ModalLayer from "../ui/ModalLayer";
import MiniStat from "../ui/MiniStat";
import { SearchIcon, CloseIcon } from "../icons/CommonIcons";
import { apiFetch } from "../../lib/api";

const PAY_CYCLE_DAYS = 15;

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

function parseMoney(raw) {
  const n = Math.round(Number(String(raw || "").replace(/,/g, "")));
  return Number.isFinite(n) ? n : 0;
}

function payoutsRemaining(principal, perPayout, paidSoFar = 0) {
  const balance = Math.max(0, principal - paidSoFar);
  if (balance <= 0) return 0;
  if (perPayout <= 0) return null;
  return Math.ceil(balance / perPayout);
}

function LoanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="10.2" r="1.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function AdvanceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v6M6.2 7c0-1 .9-1.6 1.8-1.6S10 6 10 7c0 1.8-3.6.9-3.6 2.6 0 .7.8 1.2 1.8 1.2s1.8-.5 1.8-1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 7h12M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="8" y="12" width="24" height="16" rx="2" stroke={COLORS.goldDim} strokeWidth="1.6" />
      <path d="M8 18h24" stroke={COLORS.goldDim} strokeWidth="1.6" />
    </svg>
  );
}

function MoneyField({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder={placeholder}
        autoComplete="off"
      />
      {hint ? (
        <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CreateInstallmentModal({ employees, onClose, onSaved }) {
  const [employeeId, setEmployeeId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [perPayout, setPerPayout] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const p = parseMoney(principal);
  const per = parseMoney(perPayout);
  const cycles = p > 0 && per > 0 ? payoutsRemaining(p, per, 0) : null;
  const selected = employees.find((e) => String(e.employee_id) === String(employeeId));
  const existingCount = selected?.installments?.length
    || (selected?.installment?.count ?? (selected?.installment ? 1 : 0));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!employeeId) return setError("Pick an employee");
    if (p <= 0) return setError("Enter installment total");
    if (per <= 0) return setError("Enter amount per payout");
    if (per > p) return setError("Per payout cannot exceed total");

    setSaving(true);
    try {
      const res = await apiFetch("/api/employee-installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(employeeId),
          principal: p,
          per_payout: per,
          notes,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to save installment"));
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        className="modal-pop w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>
              Add installment
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              New plan — employees can have more than one open installment
            </p>
          </div>
          <button type="button" className="p-1.5 rounded-lg" style={{ color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-3 py-2.5 mb-3 text-[12px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="form-label">Employee</label>
            <select className="form-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">Select…</option>
              {employees.map((e) => {
                const n = e.installments?.length || e.installment?.count || (e.installment ? 1 : 0);
                return (
                  <option key={e.employee_id} value={e.employee_id}>
                    {e.full_name}
                    {e.station ? ` · ${e.station}` : ""}
                    {n ? ` · ${n} open` : ""}
                  </option>
                );
              })}
            </select>
            {existingCount > 0 && (
              <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>
                Already has {existingCount} open installment{existingCount === 1 ? "" : "s"} — this adds another.
              </p>
            )}
          </div>
          <MoneyField label="Total installment (PKR)" value={principal} onChange={setPrincipal} placeholder="e.g. 100000" />
          <MoneyField
            label="Pay each payout (PKR)"
            value={perPayout}
            onChange={setPerPayout}
            placeholder="e.g. 10000"
            hint="Deducted every 15-day cycle"
          />
          <div>
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. bike loan" />
          </div>
        </div>

        {cycles != null && (
          <div className="rounded-xl px-3.5 py-3 mt-4" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>
              Auto estimate
            </div>
            <div className="text-[14px] font-semibold mt-1" style={{ color: COLORS.ink }}>
              Clears in {cycles} payout{cycles === 1 ? "" : "s"}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: COLORS.graphite }}>
              {formatPKR(per)} × {cycles} = {formatPKR(per * cycles)}
              {per * cycles > p ? ` (last payout ${formatPKR(p - per * (cycles - 1))})` : ""}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}`, color: COLORS.ink }} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.inkSurface }} disabled={saving || !employees.length}>
            {saving ? "Saving…" : "Save installment"}
          </button>
        </div>
      </form>
    </ModalLayer>
  );
}

function EditInstallmentModal({ installment, employeeName, onClose, onSaved }) {
  const [perPayout, setPerPayout] = useState(String(installment?.per_payout || ""));
  const [notes, setNotes] = useState(installment?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const per = parseMoney(perPayout);
  const principal = Number(installment?.principal) || 0;
  const paid = Number(installment?.paid_so_far) || 0;
  const balance = Math.max(0, principal - paid);
  const cycles = balance > 0 && per > 0 ? payoutsRemaining(principal, per, paid) : null;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (per <= 0) return setError("Enter amount per payout");
    if (per > principal) return setError("Per payout cannot exceed total");

    setSaving(true);
    try {
      const res = await apiFetch(`/api/employee-installments/${installment.installment_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ per_payout: per, notes }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update installment"));
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        className="modal-pop w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>
              Edit installment
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              {employeeName} · total {formatPKR(principal)} · paid {formatPKR(paid)}
            </p>
          </div>
          <button type="button" className="p-1.5 rounded-lg" style={{ color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-3 py-2.5 mb-3 text-[12px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
            {error}
          </div>
        )}

        <div className="space-y-3">
          <MoneyField
            label="Pay each payout (PKR)"
            value={perPayout}
            onChange={setPerPayout}
            placeholder="e.g. 5000"
            hint={`Balance left ${formatPKR(balance)} — change how much comes off each cycle`}
          />
          <div>
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {cycles != null && (
          <div className="rounded-xl px-3.5 py-3 mt-4" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>
              Updated estimate
            </div>
            <div className="text-[14px] font-semibold mt-1" style={{ color: COLORS.ink }}>
              Clears in {cycles} payout{cycles === 1 ? "" : "s"} at {formatPKR(per)} / cycle
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}`, color: COLORS.ink }} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.inkSurface }} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalLayer>
  );
}

function CreateAdvanceModal({ employees, onClose, onSaved }) {
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amt = parseMoney(amount);
  const selected = employees.find((e) => String(e.employee_id) === String(employeeId));
  const existingRem = selected?.advance?.remaining_amount || 0;
  const existingCount = selected?.advances?.length
    || (selected?.advance?.count ?? (selected?.advance ? 1 : 0));
  const newRem = existingRem + amt;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!employeeId) return setError("Pick an employee");
    if (amt <= 0) return setError("Enter advance amount");

    setSaving(true);
    try {
      const res = await apiFetch("/api/employee-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number(employeeId),
          amount: amt,
          notes,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to save advance"));
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        className="modal-pop w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>
              Give advance
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              Each take is its own record — they can get small advances often
            </p>
          </div>
          <button type="button" className="p-1.5 rounded-lg" style={{ color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-3 py-2.5 mb-3 text-[12px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="form-label">Employee</label>
            <select className="form-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">Select…</option>
              {employees.map((e) => {
                const rem = e.advance?.remaining_amount || 0;
                const n = e.advances?.length || e.advance?.count || (e.advance ? 1 : 0);
                return (
                  <option key={e.employee_id} value={e.employee_id}>
                    {e.full_name}
                    {n ? ` · ${n} open · owes ${formatPKR(rem)}` : ""}
                  </option>
                );
              })}
            </select>
            {existingCount > 0 && (
              <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>
                Already {existingCount} open advance{existingCount === 1 ? "" : "s"} ({formatPKR(existingRem)}) — this creates a new one.
              </p>
            )}
          </div>
          <MoneyField
            label="Advance amount (PKR)"
            value={amount}
            onChange={setAmount}
            placeholder="e.g. 5000"
          />
          <div>
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. medical" />
          </div>
        </div>

        {amt > 0 && (
          <div className="rounded-xl px-3.5 py-3 mt-4" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}>
            <div className="text-[12.5px]" style={{ color: COLORS.ink }}>
              Total advance owed after this: <strong>{formatPKR(newRem)}</strong>
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
              Deducted on Payouts when you record payment (oldest first).
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}`, color: COLORS.ink }} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.inkSurface }} disabled={saving}>
            {saving ? "Saving…" : "Save advance"}
          </button>
        </div>
      </form>
    </ModalLayer>
  );
}

export default function LoansTab({ openModal = null, onOpenModalConsumed }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    active_installments: 0,
    active_advances: 0,
    installment_balance: 0,
    advance_remaining: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | installment | advance | none
  const [showInstallment, setShowInstallment] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState(null); // { installment, employeeName }
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    if (openModal === "installment") {
      setShowInstallment(true);
      onOpenModalConsumed?.();
    } else if (openModal === "advance") {
      setShowAdvance(true);
      onOpenModalConsumed?.();
    }
  }, [openModal, onOpenModalConsumed]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiFetch("/api/employee-loans");
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load loans"));
      const data = await res.json();
      setRows(Array.isArray(data.employees) ? data.employees : []);
      setSummary(data.summary || {});
    } catch (err) {
      setLoadError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const hasInst = (r.installments?.length || 0) > 0 || Boolean(r.installment);
      const hasAdv = (r.advances?.length || 0) > 0 || Boolean(r.advance);
      if (filter === "installment" && !hasInst) return false;
      if (filter === "advance" && !hasAdv) return false;
      if (filter === "none" && (hasInst || hasAdv)) return false;
      if (filter === "active" && !hasInst && !hasAdv) return false;
      if (!q) return true;
      return (
        String(r.full_name || "").toLowerCase().includes(q) ||
        String(r.station || "").toLowerCase().includes(q) ||
        String(r.cnic_number || "").toLowerCase().includes(q) ||
        String(r.employee_id).includes(q)
      );
    });
  }, [rows, search, filter]);

  async function cancelInstallment(inst) {
    if (!window.confirm("Cancel this installment plan?")) return;
    setBusyKey(`inst-${inst.installment_id}`);
    setActionError("");
    setActionOk("");
    try {
      const res = await apiFetch(`/api/employee-installments/${inst.installment_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to cancel"));
      setActionOk("Installment cancelled");
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyKey("");
    }
  }

  async function cancelAdvance(adv) {
    if (!window.confirm("Cancel / clear this advance balance?")) return;
    setBusyKey(`adv-${adv.advance_id}`);
    setActionError("");
    setActionOk("");
    try {
      const res = await apiFetch(`/api/employee-advances/${adv.advance_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to cancel"));
      setActionOk("Advance cancelled");
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div>
      <div
        className="rounded-2xl px-5 py-3.5 mb-6 flex items-start gap-3 fade-in"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.boneDim, color: COLORS.goldDim }}>
          <CalendarIcon />
        </div>
        <div className="min-w-0 text-[12.5px]" style={{ color: COLORS.graphite }}>
          <div className="font-semibold text-[13px]" style={{ color: COLORS.ink }}>
            How this works · {PAY_CYCLE_DAYS}-day payout cycle
          </div>
          <p className="mt-1">
            <strong style={{ color: COLORS.ink }}>Installment</strong> — they owe a total and repay a fixed amount every payout. We show how many payouts until it clears.
          </p>
          <p className="mt-1">
            <strong style={{ color: COLORS.ink }}>Advance</strong> — small cash takes anytime. Each one is separate; payout deducts oldest first.
          </p>
        </div>
      </div>

      {(loadError || actionError || actionOk) && (
        <div className="space-y-2 mb-4">
          {loadError && (
            <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
              {loadError}
              {loadError.toLowerCase().includes("relation") || loadError.toLowerCase().includes("does not exist")
                ? " — run sql/07_employee_loans.sql in pgAdmin."
                : ""}
            </div>
          )}
          {actionError && (
            <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
              {actionError}
            </div>
          )}
          {actionOk && (
            <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
              {actionOk}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MiniStat index={0} icon={<LoanIcon />} label="Active installments" value={summary.active_installments || 0} sub="fixed per payout" />
        <MiniStat index={1} icon={<AdvanceIcon />} label="Active advances" value={summary.active_advances || 0} sub="rolling balance" />
        <MiniStat index={2} icon={<LoanIcon />} label="Installment owed" value={formatPKR(summary.installment_balance || 0)} sub="still to recover" />
        <MiniStat index={3} icon={<AdvanceIcon />} label="Advance owed" value={formatPKR(summary.advance_remaining || 0)} sub="still to recover" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
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
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All employees</option>
            <option value="active">With loan / advance</option>
            <option value="installment">Installment only</option>
            <option value="advance">Advance only</option>
            <option value="none">No dues</option>
          </select>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>
          {filtered.length} shown
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl px-6 py-14 text-center fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          <div className="flex justify-center mb-3">
            <EmptyIcon />
          </div>
          <div className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
            No employees here
          </div>
          <p className="text-[13px] mt-1" style={{ color: COLORS.graphite }}>
            {search || filter !== "all" ? "Try another filter." : "Add employees on the Roster tab first."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row, index) => {
            const installments = row.installments?.length
              ? row.installments
              : row.installment?.items?.length
                ? row.installment.items
                : row.installment
                  ? [row.installment]
                  : [];
            const advances = row.advances?.length
              ? row.advances
              : row.advance?.items?.length
                ? row.advance.items
                : row.advance
                  ? [row.advance]
                  : [];
            const instTotal = row.installment;
            const advTotal = row.advance;
            return (
              <div
                key={row.employee_id}
                className="loan-card fade-in rounded-2xl p-4 sm:p-5"
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  animationDelay: `${index * 40}ms`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                      {row.full_name}
                    </div>
                    <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                      EMP-{row.employee_id}
                      {row.station ? ` · ${row.station}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {installments.length > 0 && (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
                        {installments.length} installment{installments.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {advances.length > 0 && (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
                        {advances.length} advance{advances.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {installments.length === 0 && advances.length === 0 && (
                      <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
                        Clear
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="rounded-xl p-3.5" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>
                        Installments
                      </div>
                      {instTotal && (
                        <div className="text-[11px] font-semibold" style={{ color: COLORS.rust }}>
                          {formatPKR(instTotal.balance)} left
                        </div>
                      )}
                    </div>
                    {installments.length === 0 ? (
                      <p className="text-[12px] mt-2" style={{ color: COLORS.graphiteLight }}>
                        No installment plans
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2.5">
                        {installments.map((inst) => {
                          const cycles = inst.payouts_remaining;
                          return (
                            <div
                              key={inst.installment_id}
                              className="rounded-lg px-3 py-2.5"
                              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                            >
                              <div className="text-[12.5px]" style={{ color: COLORS.ink }}>
                                {formatPKR(inst.principal)} · <strong>{formatPKR(inst.per_payout)}</strong> / payout
                              </div>
                              <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphite }}>
                                Paid {formatPKR(inst.paid_so_far)} · left{" "}
                                <strong style={{ color: COLORS.rust }}>{formatPKR(inst.balance)}</strong>
                                {cycles != null ? ` · ~${cycles} left` : ""}
                              </div>
                              {inst.notes ? (
                                <div className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>{inst.notes}</div>
                              ) : null}
                              <div className="flex flex-wrap gap-3 mt-1.5">
                                <button
                                  type="button"
                                  className="btn-link text-[11px] font-semibold"
                                  style={{ color: COLORS.goldDim }}
                                  onClick={() => setEditingInstallment({ installment: inst, employeeName: row.full_name })}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-link text-[11px] font-semibold"
                                  style={{ color: COLORS.rust }}
                                  disabled={busyKey === `inst-${inst.installment_id}`}
                                  onClick={() => cancelInstallment(inst)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl p-3.5" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>
                        Advances
                      </div>
                      {advTotal && (
                        <div className="text-[11px] font-semibold" style={{ color: COLORS.goldDim }}>
                          {formatPKR(advTotal.remaining_amount)} left
                        </div>
                      )}
                    </div>
                    {advances.length === 0 ? (
                      <p className="text-[12px] mt-2" style={{ color: COLORS.graphiteLight }}>
                        No open advances
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2.5">
                        {advances.map((adv) => (
                          <div
                            key={adv.advance_id}
                            className="rounded-lg px-3 py-2.5"
                            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                          >
                            <div className="text-[12.5px]" style={{ color: COLORS.ink }}>
                              Given {formatPKR(adv.original_amount)}
                            </div>
                            <div className="text-[12px] font-semibold mt-0.5" style={{ color: COLORS.goldDim }}>
                              Remaining {formatPKR(adv.remaining_amount)}
                            </div>
                            {adv.notes ? (
                              <div className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>{adv.notes}</div>
                            ) : null}
                            <button
                              type="button"
                              className="btn-link text-[11px] font-semibold mt-1.5"
                              style={{ color: COLORS.rust }}
                              disabled={busyKey === `adv-${adv.advance_id}`}
                              onClick={() => cancelAdvance(adv)}
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showInstallment && (
        <CreateInstallmentModal
          employees={rows}
          onClose={() => setShowInstallment(false)}
          onSaved={() => {
            setActionOk("Installment saved");
            load();
          }}
        />
      )}
      {showAdvance && (
        <CreateAdvanceModal
          employees={rows}
          onClose={() => setShowAdvance(false)}
          onSaved={() => {
            setActionOk("Advance saved");
            load();
          }}
        />
      )}
      {editingInstallment && (
        <EditInstallmentModal
          installment={editingInstallment.installment}
          employeeName={editingInstallment.employeeName}
          onClose={() => setEditingInstallment(null)}
          onSaved={() => {
            setActionOk("Installment updated");
            load();
          }}
        />
      )}
    </div>
  );
}
