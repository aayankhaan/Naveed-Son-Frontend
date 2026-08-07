// ========================================
// DailyExpenses.jsx
// Floor desk: log overnight / food costs against any ATM.
// ========================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";
import OrderAtmExpenses from "../components/orders/OrderAtmExpenses";
import { useAuth } from "../context/AuthContext";
import ReadOnlyBanner from "../components/auth/ReadOnlyBanner";

function TotalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 6.5h6M5 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function InvoiceReadyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5h6.5L13 5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10.5 2.5V5H13M5.5 9l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyExpensesPage() {
  const { canWrite } = useAuth();
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [unbilledTotal, setUnbilledTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [quickForm, setQuickForm] = useState({
    order_id: "",
    expense_date: todayIso(),
    category: "Food",
    description: "",
    amount: "",
    bill_on_invoice: true,
  });
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    const res = await apiFetch("/api/orders");
    if (!res.ok) throw new Error(await readApiError(res, "Failed to load ATMs"));
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.orders || [];
    // Prefer open ATMs first
    const sorted = [...list].sort((a, b) => {
      const aClosed = a.payment_status === "shipped" ? 1 : 0;
      const bClosed = b.payment_status === "shipped" ? 1 : 0;
      if (aClosed !== bClosed) return aClosed - bClosed;
      return String(b.order_date || "").localeCompare(String(a.order_date || ""));
    });
    setOrders(sorted);
  }, []);

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (selectedOrderId) params.set("order_id", selectedOrderId);
    const q = params.toString();
    const res = await apiFetch(`/api/expenses${q ? `?${q}` : ""}`);
    if (!res.ok) throw new Error(await readApiError(res, "Failed to load expenses"));
    const data = await res.json();
    setExpenses(data.expenses || []);
    setUnbilledTotal(Number(data.unbilled_total) || 0);
    setTotal(Number(data.total) || 0);
  }, [from, to, selectedOrderId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadOrders(), loadExpenses()]);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadOrders, loadExpenses]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) =>
        String(e.atm_no || "").toLowerCase().includes(q) ||
        String(e.customer || "").toLowerCase().includes(q) ||
        String(e.category || "").toLowerCase().includes(q) ||
        String(e.description || "").toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const openOrders = useMemo(
    () => orders.filter((o) => o.payment_status !== "shipped"),
    [orders]
  );

  async function handleQuickAdd(e) {
    e.preventDefault();
    const orderId = Number(quickForm.order_id);
    const amount = Number(quickForm.amount);
    if (!orderId) {
      setError("Pick an ATM");
      return;
    }
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
          expense_date: quickForm.expense_date,
          category: quickForm.category,
          description: quickForm.description,
          amount,
          bill_on_invoice: quickForm.bill_on_invoice,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to save"));
      setQuickForm((f) => ({ ...f, amount: "", description: "" }));
      await loadExpenses();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this expense?")) return;
    try {
      const res = await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to delete"));
      await loadExpenses();
    } catch (err) {
      setError(err.message || "Failed to delete");
    }
  }

  return (
    <AppShell
      title="ATM Expenses"
      subtitle="Overnight food & floor costs · charged back on ATM invoice"
      maxWidth="64rem"
      showAvatar={false}
      actions={
        <button
          type="button"
          className="btn-secondary text-[12px] font-semibold px-3 py-2 rounded-xl"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
          onClick={loadAll}
        >
          Refresh
        </button>
      }
    >
      <ReadOnlyBanner />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <MiniStat index={0} icon={<TotalIcon />} label="Listed total" value={formatPKR(total)} />
        <MiniStat index={1} icon={<InvoiceReadyIcon />} label="Ready for invoice" value={formatPKR(unbilledTotal)} />
        <MiniStat index={2} icon={<RowsIcon />} label="Rows" value={String(filtered.length)} />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[12.5px] mb-4" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
          {error}
        </div>
      )}

      {canWrite ? (
      <form
        onSubmit={handleQuickAdd}
        className="rounded-2xl p-5 mb-5 space-y-3"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
      >
        <div className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>
          Quick add
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="form-label">ATM</span>
            <select
              className="form-input"
              value={quickForm.order_id}
              onChange={(e) => setQuickForm((f) => ({ ...f, order_id: e.target.value }))}
              required
            >
              <option value="">Select ATM…</option>
              {openOrders.map((o) => (
                <option key={o.order_id} value={o.order_id}>
                  ATM {o.atm_no} · {o.customer}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="form-label">Date</span>
            <input
              type="date"
              className="form-input"
              value={quickForm.expense_date}
              onChange={(e) => setQuickForm((f) => ({ ...f, expense_date: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="form-label">Category</span>
            <select
              className="form-input"
              value={quickForm.category}
              onChange={(e) => setQuickForm((f) => ({ ...f, category: e.target.value }))}
            >
              {["Food", "Travel", "Lodging", "Transport", "Misc"].map((c) => (
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
              className="form-input"
              value={quickForm.amount}
              onChange={(e) => setQuickForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="form-label">Note</span>
            <input
              className="form-input"
              placeholder="e.g. night shift meals"
              value={quickForm.description}
              onChange={(e) => setQuickForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={quickForm.bill_on_invoice}
              onChange={(e) => setQuickForm((f) => ({ ...f, bill_on_invoice: e.target.checked }))}
            />
            <span className="text-[12.5px] font-medium" style={{ color: COLORS.ink }}>
              Include on next ATM invoice
            </span>
          </label>
          <button
            type="submit"
            className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: COLORS.gold, color: COLORS.ink, opacity: saving ? 0.7 : 1 }}
            disabled={saving}
          >
            {saving ? "Saving…" : "Add expense"}
          </button>
        </div>
      </form>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="relative flex-1 min-w-[12rem]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.graphiteLight }}>
            <SearchIcon />
          </span>
          <input
            className="form-input pl-9"
            placeholder="Search ATM, customer, note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="form-label">From</span>
          <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="form-label">To</span>
          <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="block min-w-[10rem]">
          <span className="form-label">ATM filter</span>
          <select
            className="form-input"
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
          >
            <option value="">All ATMs</option>
            {orders.map((o) => (
              <option key={o.order_id} value={o.order_id}>
                ATM {o.atm_no}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-[13px]" style={{ color: COLORS.graphite }}>
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-12 text-center"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
            No expenses yet
          </div>
          <p className="text-[13px] mt-1.5" style={{ color: COLORS.graphite }}>
            Add overnight food or other costs above — they show on the ATM invoice when you ship.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          <table className="w-full text-[12.5px]">
            <thead style={{ background: COLORS.boneDim }}>
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">ATM</th>
                <th className="text-left px-4 py-3 font-semibold">What</th>
                <th className="text-right px-4 py-3 font-semibold">Amount</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr key={exp.expense_id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: COLORS.ink }}>
                      ATM {exp.atm_no}
                    </div>
                    <div className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                      {exp.customer}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{exp.category}</div>
                    {exp.description ? (
                      <div className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                        {exp.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPKR(exp.amount)}</td>
                  <td className="px-4 py-3">
                    {exp.billed ? (
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: COLORS.greenSoft, color: COLORS.green }}
                      >
                        On invoice
                      </span>
                    ) : exp.bill_on_invoice ? (
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
                      >
                        Next ship
                      </span>
                    ) : (
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: COLORS.boneDim, color: COLORS.graphite }}
                      >
                        Internal
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
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

      {/* Keep import used when filtering a single ATM for in-place edit */}
      {selectedOrderId ? (
        <div className="mt-6 rounded-2xl p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          <div className="text-[13px] font-semibold mb-3" style={{ color: COLORS.ink }}>
            Manage selected ATM
          </div>
          <OrderAtmExpenses orderId={Number(selectedOrderId)} compact />
        </div>
      ) : null}
    </AppShell>
  );
}
