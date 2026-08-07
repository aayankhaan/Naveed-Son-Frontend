// ========================================
// OrderAtmExpenses.jsx
// Note daily costs against an ATM (food, overnight, etc.)
// and flag them to bill on the next shipment invoice.
// ========================================

import { useCallback, useEffect, useState } from "react";
import { COLORS } from "../../constants/theme";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = ["Food", "Travel", "Lodging", "Transport", "Misc"];

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function formatPKR(n) {
  return `Rs ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

const emptyForm = () => ({
  expense_date: todayIso(),
  category: "Food",
  description: "",
  amount: "",
  bill_on_invoice: true,
});

/**
 * @param {{ orderId: number, compact?: boolean }} props
 */
export default function OrderAtmExpenses({ orderId, compact = false }) {
  const { canWrite } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [unbilledTotal, setUnbilledTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/orders/${orderId}/expenses`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load expenses"));
      const data = await res.json();
      setExpenses(data.expenses || []);
      setUnbilledTotal(Number(data.unbilled_total) || 0);
      setTotal(Number(data.total) || 0);
    } catch (err) {
      setError(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e) {
    e?.preventDefault?.();
    if (!canWrite) return;
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      setError("Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/orders/${orderId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date: form.expense_date,
          category: form.category,
          description: form.description,
          amount,
          bill_on_invoice: form.bill_on_invoice,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to save expense"));
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expenseId) {
    if (!window.confirm("Delete this expense?")) return;
    setError("");
    try {
      const res = await apiFetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to delete"));
      await load();
    } catch (err) {
      setError(err.message || "Failed to delete");
    }
  }

  async function toggleBill(exp) {
    if (exp.billed) return;
    setError("");
    try {
      const res = await apiFetch(`/api/expenses/${exp.expense_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill_on_invoice: !exp.bill_on_invoice }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update"));
      await load();
    } catch (err) {
      setError(err.message || "Failed to update");
    }
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3.5" style={{ background: COLORS.boneDim }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>
            On next invoice
          </div>
          <div className="text-[18px] font-semibold mt-1 tabular-nums" style={{ color: COLORS.ink }}>
            {formatPKR(unbilledTotal)}
          </div>
        </div>
        <div className="rounded-xl p-3.5" style={{ background: COLORS.goldSoft }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>
            All expenses
          </div>
          <div className="text-[18px] font-semibold mt-1 tabular-nums" style={{ color: COLORS.ink }}>
            {formatPKR(total)}
          </div>
        </div>
      </div>

      {canWrite ? (
      <form
        onSubmit={handleAdd}
        className="rounded-xl p-4 space-y-3"
        style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}
      >
        <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
          Add expense
        </div>
        <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
          Overnight food, travel, etc. — tick “Bill on invoice” so this ATM pays it on the next shipment.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block">
            <span className="form-label">Date</span>
            <input
              type="date"
              className="form-input"
              value={form.expense_date}
              onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="form-label">Category</span>
            <select
              className="form-input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="form-label">Amount (Rs)</span>
            <input
              type="number"
              min={1}
              step={1}
              className="form-input"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </label>
          <label className="flex items-end gap-2 pb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.bill_on_invoice}
              onChange={(e) => setForm((f) => ({ ...f, bill_on_invoice: e.target.checked }))}
            />
            <span className="text-[12px] font-medium" style={{ color: COLORS.ink }}>
              Bill on invoice
            </span>
          </label>
        </div>
        <label className="block">
          <span className="form-label">Note (optional)</span>
          <input
            className="form-input"
            placeholder="e.g. night shift meals"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
          style={{ background: COLORS.gold, color: COLORS.ink, opacity: saving ? 0.7 : 1 }}
          disabled={saving}
        >
          {saving ? "Saving…" : "Add expense"}
        </button>
      </form>
      ) : null}

      {error && (
        <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[12.5px]" style={{ color: COLORS.graphite }}>
          Loading expenses…
        </p>
      ) : expenses.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: COLORS.graphiteLight }}>
          No expenses on this ATM yet.
        </p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          <table className="w-full text-[12px]">
            <thead style={{ background: COLORS.boneDim }}>
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Date</th>
                <th className="text-left px-3 py-2 font-semibold">What</th>
                <th className="text-right px-3 py-2 font-semibold">Amount</th>
                <th className="text-left px-3 py-2 font-semibold">Invoice</th>
                <th className="text-right px-3 py-2 font-semibold w-16" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.expense_id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium" style={{ color: COLORS.ink }}>
                      {exp.category}
                    </div>
                    {exp.description ? (
                      <div className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                        {exp.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatPKR(exp.amount)}</td>
                  <td className="px-3 py-2.5">
                    {exp.billed ? (
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: COLORS.greenSoft, color: COLORS.green }}
                      >
                        Billed
                      </span>
                    ) : canWrite ? (
                      <button
                        type="button"
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                        style={{
                          background: exp.bill_on_invoice ? COLORS.goldSoft : COLORS.boneDim,
                          color: exp.bill_on_invoice ? COLORS.goldDim : COLORS.graphite,
                        }}
                        onClick={() => toggleBill(exp)}
                        title="Toggle bill on next invoice"
                      >
                        {exp.bill_on_invoice ? "Will bill" : "Skip invoice"}
                      </button>
                    ) : (
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                        style={{
                          background: exp.bill_on_invoice ? COLORS.goldSoft : COLORS.boneDim,
                          color: exp.bill_on_invoice ? COLORS.goldDim : COLORS.graphite,
                        }}
                      >
                        {exp.bill_on_invoice ? "Will bill" : "Skip invoice"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canWrite && !exp.billed && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold"
                        style={{ color: COLORS.rust }}
                        onClick={() => handleDelete(exp.expense_id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
