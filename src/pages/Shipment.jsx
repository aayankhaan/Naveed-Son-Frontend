// ========================================
// Shipment.jsx
// Ship ready stock (partial OK). Same ATM qty reduces.
// Each ship creates an invoice + security hold (not on PDF).
// ========================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { FONT, COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, ChevronIcon, CloseIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";
import InvoiceDocument from "./InvoiceDocument";
import { useAuth } from "../context/AuthContext";
import ReadOnlyBanner from "../components/auth/ReadOnlyBanner";

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "";
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

function formatPKR(n) {
  return `Rs ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function draftToShipState(items) {
  const out = {};
  for (const it of items || []) {
    const made = Math.max(0, Math.round(Number(it.qty_made) || 0));
    const ordered = Math.max(0, Math.round(Number(it.qty_ordered) || 0));
    out[it.item_key] = String(Math.min(made, ordered > 0 ? ordered : made));
  }
  return out;
}

function lineTotals(drafts, qtyMap) {
  let ordered = 0;
  let made = 0;
  let shipped = 0;
  let left = 0;
  let invalid = false;
  let goods = 0;
  for (const it of drafts || []) {
    const m = Math.max(0, Math.round(Number(it.qty_made) || 0));
    const o = Math.max(0, Math.round(Number(it.qty_ordered) || 0));
    const raw = qtyMap?.[it.item_key];
    const s = Math.round(Number(raw === "" || raw == null ? Math.min(m, o || m) : raw) || 0);
    if (s < 0 || s > m) invalid = true;
    const capped = Math.min(Math.max(0, s), m);
    ordered += o;
    made += m;
    shipped += capped;
    left += Math.max(0, m - capped);
    goods += capped * (Number(it.unit_rate) || 0);
  }
  return { ordered, made, shipped, left, invalid, goods: Math.round(goods * 100) / 100 };
}

function WaitingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 11.5V5.8L8 3l6 2.8v5.7L8 14.2 2 11.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2 5.8L8 8.6l6-2.8M8 8.6V14.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 3.5h8v7h-8v-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.5 6h3.2L14.5 8.2V10.5h-5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="4.2" cy="12" r="1.3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1.3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function DoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.2 8.1l1.8 1.8 3.8-3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyBoxIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M6 26V14.5L20 8l14 6.5V26L20 32.5 6 26z" stroke={COLORS.goldDim} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 14.5L20 21l14-6.5M20 21v11.5" stroke={COLORS.goldDim} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8v8.6M4.3 7.3L8 11l3.7-3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.3 12.3v1.4c0 .7.6 1.2 1.2 1.2h9c.7 0 1.2-.5 1.2-1.2v-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4.5 6V2.5h7V6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="2" y="6" width="12" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 10v3.5h7V10" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="spin">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MetricChip({ label, value, tone = "default" }) {
  const tones = {
    default: { bg: COLORS.bone, fg: COLORS.ink, label: COLORS.graphiteLight },
    ship: { bg: COLORS.goldSoft, fg: COLORS.ink, label: COLORS.goldDim },
    left: { bg: COLORS.boneDim, fg: COLORS.graphite, label: COLORS.graphiteLight },
    ok: { bg: COLORS.greenSoft, fg: COLORS.green, label: COLORS.green },
  };
  const t = tones[tone] || tones.default;
  return (
    <div className="rounded-xl px-3 py-2 min-w-[72px]" style={{ background: t.bg }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: t.label }}>
        {label}
      </div>
      <div className="text-[16px] font-semibold tabular-nums mt-0.5 leading-none" style={{ color: t.fg }}>
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

function ShipProgress({ made, shipped }) {
  const pct = made > 0 ? Math.min(100, Math.round((shipped / made) * 100)) : 0;
  return (
    <div className="w-full max-w-[160px]">
      <div className="flex items-center justify-between text-[10.5px] mb-1">
        <span style={{ color: COLORS.graphiteLight }}>Ship progress</span>
        <span className="font-semibold tabular-nums" style={{ color: COLORS.ink }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.boneDim }}>
        <div
          className="h-full rounded-full ship-bar"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? COLORS.green : COLORS.gold,
          }}
        />
      </div>
    </div>
  );
}

function ShipmentInvoiceModal({ invoice, onClose }) {
  const [rows, setRows] = useState(() =>
    (invoice?.rows || []).map((r) => ({
      description: r.description || "",
      design: r.design || "",
      designLines: r.designLines || [],
      qty: String(r.qtyOrdered ?? r.qty ?? ""),
      qtyOrdered: Number(r.qtyOrdered ?? r.qty) || 0,
      rate: r.rate != null ? String(r.rate) : "",
    }))
  );
  const [name, setName] = useState(invoice?.customer || "");
  const [orderRef, setOrderRef] = useState(`ATM ${invoice?.atm_no || ""}`);
  const [challanNo, setChallanNo] = useState("");
  const [date, setDate] = useState(
    new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
  );
  const [partyName, setPartyName] = useState(invoice?.customer || "");
  const [jobOrderNo, setJobOrderNo] = useState(invoice?.atm_no || "");
  const [scNo, setScNo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [laborCost, setLaborCost] = useState(Number(invoice?.labor_cost) || 0);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function ensureLabor() {
      if (Number(invoice?.labor_cost) > 0 || !invoice?.order_id) return;
      try {
        const res = await apiFetch(`/api/payouts/atm/${invoice.order_id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.totals?.labor_cost != null) {
          setLaborCost(Number(data.totals.labor_cost) || 0);
        }
      } catch {
        /* ignore */
      }
    }
    ensureLabor();
    return () => {
      cancelled = true;
    };
  }, [invoice?.order_id, invoice?.labor_cost]);

  const subTotal = rows.reduce(
    (s, r) => s + (Number(r.qtyOrdered ?? r.qty ?? 0) || 0) * (Number(r.rate) || 0),
    0
  );
  const securityAmt = Number(invoice?.security_amount) || 0;
  const securityPct = Number(invoice?.security_pct) || 0;
  const expensesTotal = Number(invoice?.expenses_total) || 0;
  const goodsTotal = Number(invoice?.goods_total) || Math.max(0, subTotal - expensesTotal);
  const profit =
    invoice?.profit != null && Number(invoice.labor_cost) > 0
      ? Number(invoice.profit)
      : Math.round((subTotal - laborCost) * 100) / 100;

  function buildInvoiceElement() {
    return (
      <InvoiceDocument
        billNo={invoice.bill_no}
        name={name}
        orderRef={orderRef}
        challanNo={challanNo}
        date={date}
        partyName={partyName}
        jobOrderNo={jobOrderNo}
        scNo={scNo}
        rows={rows}
        subTotal={subTotal}
      />
    );
  }

  async function handleDownloadPdf() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await pdf(buildInvoiceElement()).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${invoice.bill_no}-${String(invoice.customer || "customer").replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.alert("Couldn't generate the PDF.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handlePrintPdf() {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const blob = await pdf(buildInvoiceElement()).toBlob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
      iframe.src = url;
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch {
          window.open(url, "_blank");
        }
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
        }, 60000);
      };
      document.body.appendChild(iframe);
    } catch (err) {
      console.error(err);
      window.alert("Couldn't prepare the PDF for printing.");
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex items-center justify-between gap-3 px-6 py-4 sticky top-0 z-10"
          style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}
        >
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
              Shipment invoice
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              Goods + ATM expenses on PDF · security {securityPct}% ({formatPKR(securityAmt)}) held separately
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={handleDownloadPdf}
              disabled={isExporting}
            >
              {isExporting ? <SpinnerIcon /> : <DownloadIcon />} Download PDF
            </button>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={handlePrintPdf}
              disabled={isPrinting}
            >
              {isPrinting ? <SpinnerIcon /> : <PrintIcon />} Print
            </button>
            <button
              type="button"
              className="btn-secondary p-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
            <div>
              <div className="text-[10px] uppercase font-semibold" style={{ color: COLORS.graphiteLight }}>
                Bill
              </div>
              <div className="font-semibold" style={{ color: COLORS.ink }}>
                {invoice.bill_no}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold" style={{ color: COLORS.graphiteLight }}>
                Goods
              </div>
              <div className="font-semibold" style={{ color: COLORS.ink }}>
                {formatPKR(goodsTotal)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold" style={{ color: COLORS.graphiteLight }}>
                Expenses
              </div>
              <div className="font-semibold" style={{ color: COLORS.ink }}>
                {formatPKR(expensesTotal)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold" style={{ color: COLORS.graphiteLight }}>
                Security hold
              </div>
              <div className="font-semibold" style={{ color: COLORS.goldDim }}>
                {formatPKR(securityAmt)}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase font-semibold" style={{ color: COLORS.graphiteLight }}>
                On PDF (invoice total)
              </div>
              <div className="font-semibold" style={{ color: COLORS.ink }}>
                {formatPKR(subTotal)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold" style={{ color: COLORS.graphiteLight }}>
                Labor cost
              </div>
              <div className="font-semibold" style={{ color: COLORS.ink }}>
                {formatPKR(laborCost)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold" style={{ color: COLORS.graphiteLight }}>
                Total profit
              </div>
              <div className="font-semibold" style={{ color: profit >= 0 ? COLORS.green : COLORS.rust }}>
                {formatPKR(profit)}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["Name", name, setName],
              ["Order", orderRef, setOrderRef],
              ["Party", partyName, setPartyName],
              ["Job order", jobOrderNo, setJobOrderNo],
              ["Challan", challanNo, setChallanNo],
              ["S/C #", scNo, setScNo],
              ["Date", date, setDate],
            ].map(([label, value, setter]) => (
              <label key={label} className="block">
                <span className="form-label">{label}</span>
                <input className="form-input" value={value} onChange={(e) => setter(e.target.value)} />
              </label>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            <table className="w-full text-[12px]">
              <thead style={{ background: COLORS.boneDim }}>
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Description</th>
                  <th className="text-right px-3 py-2 font-semibold w-20">Qty</th>
                  <th className="text-right px-3 py-2 font-semibold w-24">Rate</th>
                  <th className="text-right px-3 py-2 font-semibold w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-3 py-2">{row.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.qtyOrdered}</td>
                    <td className="px-3 py-2">
                      <input
                        className="form-input text-right"
                        value={row.rate}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r, idx) => (idx === i ? { ...r, rate: e.target.value } : r))
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {((Number(row.qtyOrdered) || 0) * (Number(row.rate) || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingCard({
  order,
  open,
  onToggle,
  qtyMap,
  notes,
  onNotes,
  onQty,
  onShipAll,
  onConfirm,
  saving,
  index,
  securityPct,
  onSecurityPct,
  dueDate,
  onDueDate,
  includeExpenses,
  onIncludeExpenses,
  canWrite = true,
}) {
  const drafts = order.draft_items || [];
  const totals = lineTotals(drafts, qtyMap);
  const secPct = Number(securityPct);
  const secAmt =
    Number.isFinite(secPct) && secPct >= 0 ? Math.round(((totals.goods * secPct) / 100) * 100) / 100 : 0;
  const expensesUnbilled = Number(order.expenses_unbilled) || 0;
  const invoicePreview =
    totals.goods + (includeExpenses ? expensesUnbilled : 0);

  return (
    <div
      className="ship-card fade-in rounded-2xl overflow-hidden"
      style={{
        background: COLORS.card,
        border: `1px solid ${open ? COLORS.gold : COLORS.border}`,
        boxShadow: open ? "0 16px 36px -28px rgba(28,25,23,0.45)" : "none",
        animationDelay: `${index * 50}ms`,
      }}
    >
      <button type="button" className="w-full text-left px-5 py-4" onClick={onToggle}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded"
                style={{ background: COLORS.inkSurface, color: COLORS.gold }}
              >
                ATM {order.atm_no}
              </span>
              <span
                className="text-[10.5px] font-medium px-2 py-0.5 rounded"
                style={{
                  background:
                    order.payment_status === "awaiting_shipment" ? COLORS.goldSoft : COLORS.boneDim,
                  color:
                    order.payment_status === "awaiting_shipment" ? COLORS.goldDim : COLORS.graphite,
                }}
              >
                {order.payment_status === "awaiting_shipment" ? "Waiting for Shipment" : "Ready stock"}
              </span>
            </div>
            <div className="text-[15px] font-semibold mt-2 truncate" style={{ color: COLORS.ink }}>
              {order.customer}
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              Order {formatDate(order.order_date)}
              {drafts.length ? ` · ${drafts.length} line${drafts.length === 1 ? "" : "s"}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <MetricChip label="Ready" value={totals.made} />
              <MetricChip label="Ship" value={totals.shipped} tone="ship" />
              <MetricChip label="Left" value={totals.left} tone="left" />
            </div>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform"
              style={{
                background: COLORS.boneDim,
                color: COLORS.graphite,
                transform: open ? "rotate(-90deg)" : "rotate(90deg)",
              }}
            >
              <ChevronIcon />
            </div>
          </div>
        </div>
        <div className="mt-3.5">
          <ShipProgress made={totals.made} shipped={totals.shipped} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          {!canWrite ? (
            <div className="pt-4 space-y-3">
              <p className="text-[12.5px]" style={{ color: COLORS.graphite }}>
                View only — an admin ships and invoices from this screen.
              </p>
              <div className="space-y-2">
                {drafts.map((it) => {
                  const made = Math.max(0, Math.round(Number(it.qty_made) || 0));
                  const ordered = Math.max(0, Math.round(Number(it.qty_ordered) || 0));
                  return (
                    <div
                      key={it.item_key}
                      className="rounded-xl px-3.5 py-3 flex flex-wrap items-center justify-between gap-2"
                      style={{ background: COLORS.bone }}
                    >
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
                          {it.description || it.item_key}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                          Ordered {ordered.toLocaleString()} · Ready {made.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {expensesUnbilled > 0 ? (
                <div className="text-[12px]" style={{ color: COLORS.graphite }}>
                  Unbilled expenses: <strong style={{ color: COLORS.ink }}>{formatPKR(expensesUnbilled)}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mb-3">
            <p className="text-[12px]" style={{ color: COLORS.graphite }}>
              Ship ≤ ready. Order qty on this ATM drops by what you ship. Leftover ready stays for the next ship.
            </p>
            <button
              type="button"
              className="btn-secondary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
              onClick={onShipAll}
            >
              Fill max ready
            </button>
          </div>

          <div className="space-y-2.5">
            {drafts.map((it) => {
              const made = Math.max(0, Math.round(Number(it.qty_made) || 0));
              const ordered = Math.max(0, Math.round(Number(it.qty_ordered) || 0));
              const raw = qtyMap?.[it.item_key];
              const defaultShip = Math.min(made, ordered > 0 ? ordered : made);
              const shippedNum = Math.round(Number(raw === "" || raw == null ? defaultShip : raw) || 0);
              const capped = Math.min(Math.max(0, shippedNum), made);
              const left = Math.max(0, made - capped);
              const invalid = shippedNum > made || shippedNum < 0;

              return (
                <div
                  key={it.item_key}
                  className="rounded-xl p-3.5"
                  style={{
                    background: COLORS.bone,
                    border: `1px solid ${invalid ? COLORS.rust : COLORS.border}`,
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>
                          {it.description}
                        </span>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                          style={{
                            background: it.item_type === "set" ? COLORS.inkSurface : COLORS.boneDim,
                            color: it.item_type === "set" ? COLORS.gold : COLORS.graphite,
                          }}
                        >
                          {it.item_type === "set" ? "Set" : "Article"}
                        </span>
                      </div>
                      <div
                        className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11.5px]"
                        style={{ color: COLORS.graphite }}
                      >
                        <span>
                          Ordered{" "}
                          <strong className="tabular-nums" style={{ color: COLORS.ink }}>
                            {ordered.toLocaleString()}
                          </strong>
                        </span>
                        <span>
                          Ready{" "}
                          <strong className="tabular-nums" style={{ color: COLORS.ink }}>
                            {made.toLocaleString()}
                          </strong>
                        </span>
                        {Number(it.unit_rate) > 0 && (
                          <span>
                            Rate{" "}
                            <strong className="tabular-nums" style={{ color: COLORS.ink }}>
                              {formatPKR(it.unit_rate)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-end gap-3 shrink-0">
                      <div className="ship-qty-field">
                        <label className="form-label">Shipped</label>
                        <input
                          type="number"
                          min={0}
                          max={made}
                          step={1}
                          className={`form-input text-right tabular-nums${invalid ? " form-input-error" : ""}`}
                          value={raw ?? String(defaultShip)}
                          onChange={(e) => onQty(it.item_key, e.target.value)}
                        />
                      </div>
                      <div className="text-right min-w-[64px] pb-1">
                        <div
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: COLORS.graphiteLight }}
                        >
                          Left ready
                        </div>
                        <div
                          className="text-[20px] font-semibold tabular-nums leading-none mt-1"
                          style={{ color: COLORS.graphite }}
                        >
                          {left.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  {invalid && (
                    <p className="text-[11px] mt-2" style={{ color: COLORS.rust }}>
                      Shipped cannot exceed ready ({made.toLocaleString()}).
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Security %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="form-input"
                value={securityPct}
                onChange={(e) => onSecurityPct(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Security due (optional)</label>
              <input
                type="date"
                className="form-input"
                value={dueDate || ""}
                onChange={(e) => onDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Notes (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. partial — balance on ATM"
                value={notes || ""}
                onChange={(e) => onNotes(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <label
            className="mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-3 cursor-pointer select-none"
            style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeExpenses !== false}
              onChange={(e) => onIncludeExpenses?.(e.target.checked)}
            />
            <span>
              <span className="block text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
                Include ATM expenses on invoice
              </span>
              <span className="block text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                {expensesUnbilled > 0
                  ? `${formatPKR(expensesUnbilled)} unbilled (food / overnight etc.) will be added. Security stays on goods only.`
                  : "No unbilled expenses on this ATM right now."}
              </span>
            </span>
          </label>

          <div
            className="mt-4 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{ background: COLORS.inkSurface }}
          >
            <div className="text-[12px]" style={{ color: COLORS.graphiteLight }}>
              Goods ~{" "}
              <strong className="tabular-nums" style={{ color: COLORS.bone }}>
                {formatPKR(totals.goods)}
              </strong>
              {includeExpenses !== false && expensesUnbilled > 0 ? (
                <>
                  <span className="mx-2">·</span>
                  Expenses ~{" "}
                  <strong className="tabular-nums" style={{ color: COLORS.bone }}>
                    {formatPKR(expensesUnbilled)}
                  </strong>
                </>
              ) : null}
              <span className="mx-2">·</span>
              Invoice ~{" "}
              <strong className="tabular-nums" style={{ color: COLORS.bone }}>
                {formatPKR(invoicePreview)}
              </strong>
              <span className="mx-2">·</span>
              Security ~{" "}
              <strong className="tabular-nums" style={{ color: COLORS.gold }}>
                {formatPKR(secAmt)}
              </strong>
            </div>
            <button
              type="button"
              className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-2"
              style={{
                background: totals.invalid || totals.shipped <= 0 ? COLORS.graphite : COLORS.gold,
                color: COLORS.ink,
                opacity: saving ? 0.7 : 1,
              }}
              disabled={saving || totals.invalid || totals.shipped <= 0}
              onClick={onConfirm}
            >
              <TruckIcon />
              {saving ? "Saving…" : "Ship & invoice"}
            </button>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ ship, index, open, onToggle }) {
  const items = ship.items || [];
  const shippedTotal = items.reduce((s, it) => s + (Number(it.qty_shipped) || 0), 0);

  return (
    <div
      className="ship-card fade-in rounded-2xl overflow-hidden"
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <button type="button" className="w-full text-left px-5 py-4" onClick={onToggle}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded"
                style={{ background: COLORS.inkSurface, color: COLORS.gold }}
              >
                ATM {ship.atm_no}
              </span>
              <span
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1"
                style={{ background: COLORS.greenSoft, color: COLORS.green }}
              >
                <DoneIcon /> Shipped
              </span>
            </div>
            <div className="text-[14px] font-semibold mt-2" style={{ color: COLORS.ink }}>
              {ship.customer}
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              {ship.bill_no ? `Bill ${ship.bill_no} · ` : ""}
              {formatDateTime(ship.shipped_at)}
              {ship.goods_total != null ? ` · ${formatPKR(ship.goods_total)}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MetricChip label="Shipped" value={shippedTotal} tone="ship" />
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: COLORS.boneDim,
                color: COLORS.graphite,
                transform: open ? "rotate(-90deg)" : "rotate(90deg)",
              }}
            >
              <ChevronIcon />
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <div className="pt-3 space-y-2">
            {items.map((it) => (
              <div
                key={it.item_id || it.item_key}
                className="rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                style={{ background: COLORS.bone }}
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
                    {it.description}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: COLORS.graphite }}>
                    Ready {Number(it.qty_made).toLocaleString()} → shipped{" "}
                    {Number(it.qty_shipped).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {ship.security_amount > 0 ? (
            <p className="text-[12px] px-1" style={{ color: COLORS.graphiteLight }}>
              Security {ship.security_pct}% · {formatPKR(ship.security_amount)} (see Security History)
            </p>
          ) : null}
          {ship.notes ? (
            <p className="text-[12px] px-1" style={{ color: COLORS.graphiteLight }}>
              Note: {ship.notes}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ShipmentPage() {
  const { canWrite } = useAuth();
  const [tab, setTab] = useState("pending");
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [shipQtyByOrder, setShipQtyByOrder] = useState({});
  const [notesByOrder, setNotesByOrder] = useState({});
  const [securityPctByOrder, setSecurityPctByOrder] = useState({});
  const [dueDateByOrder, setDueDateByOrder] = useState({});
  const [includeExpensesByOrder, setIncludeExpensesByOrder] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");
  const [invoiceResult, setInvoiceResult] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [pendRes, histRes] = await Promise.all([
        apiFetch("/api/shipments/pending"),
        apiFetch("/api/shipments"),
      ]);
      if (!pendRes.ok) throw new Error(await readApiError(pendRes, "Failed to load pending shipments"));
      if (!histRes.ok) throw new Error(await readApiError(histRes, "Failed to load shipment history"));
      const pendData = await pendRes.json();
      const histData = await histRes.json();
      setPending(Array.isArray(pendData) ? pendData : []);
      setHistory(Array.isArray(histData) ? histData : []);

      setShipQtyByOrder((prev) => {
        const next = { ...prev };
        for (const order of pendData || []) {
          const id = order.order_id;
          if (!next[id]) next[id] = draftToShipState(order.draft_items);
        }
        return next;
      });
      setSecurityPctByOrder((prev) => {
        const next = { ...prev };
        for (const order of pendData || []) {
          if (next[order.order_id] == null) next[order.order_id] = "3";
        }
        return next;
      });
      setIncludeExpensesByOrder((prev) => {
        const next = { ...prev };
        for (const order of pendData || []) {
          if (next[order.order_id] == null) next[order.order_id] = true;
        }
        return next;
      });

      setExpandedId((prev) => {
        if (prev && (pendData || []).some((o) => o.order_id === prev)) return prev;
        return (pendData || [])[0]?.order_id ?? null;
      });
    } catch (err) {
      setLoadError(err.message || "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter(
      (o) =>
        String(o.atm_no || "").toLowerCase().includes(q) ||
        String(o.customer || "").toLowerCase().includes(q) ||
        String(o.bill_no || "").toLowerCase().includes(q)
    );
  }, [pending, search]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (s) =>
        String(s.atm_no || "").toLowerCase().includes(q) ||
        String(s.customer || "").toLowerCase().includes(q) ||
        String(s.bill_no || "").toLowerCase().includes(q)
    );
  }, [history, search]);

  function setShippedQty(orderId, itemKey, value) {
    setShipQtyByOrder((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [itemKey]: value,
      },
    }));
  }

  function fillMax(order) {
    setShipQtyByOrder((prev) => ({
      ...prev,
      [order.order_id]: draftToShipState(order.draft_items),
    }));
  }

  async function confirmShip(order) {
    if (!canWrite) return;
    setActionError("");
    setActionOk("");
    const drafts = order.draft_items || [];
    const qtyMap = shipQtyByOrder[order.order_id] || {};
    const items = [];

    for (const it of drafts) {
      const made = Math.max(0, Math.round(Number(it.qty_made) || 0));
      const ordered = Math.max(0, Math.round(Number(it.qty_ordered) || 0));
      const raw = qtyMap[it.item_key];
      const defaultShip = Math.min(made, ordered > 0 ? ordered : made);
      const shipped = Math.round(Number(raw === "" || raw == null ? defaultShip : raw) || 0);
      if (shipped < 0) {
        setActionError(`${it.description}: shipped cannot be negative`);
        return;
      }
      if (shipped > made) {
        setActionError(`${it.description}: shipped (${shipped}) cannot exceed ready (${made})`);
        return;
      }
      items.push({
        item_key: it.item_key,
        item_type: it.item_type,
        description: it.description,
        qty_ordered: it.qty_ordered,
        qty_made: made,
        qty_shipped: shipped,
      });
    }

    if (!items.some((it) => it.qty_shipped > 0)) {
      setActionError("Ship at least one unit");
      return;
    }

    setSavingId(order.order_id);
    try {
      const res = await apiFetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          notes: notesByOrder[order.order_id] || "",
          security_pct: Number(securityPctByOrder[order.order_id] ?? 3),
          due_date: dueDateByOrder[order.order_id] || null,
          include_expenses: includeExpensesByOrder[order.order_id] !== false,
          items,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to record shipment"));
      const data = await res.json();
      setActionOk(
        `ATM ${order.atm_no} · Bill ${data.bill_no}` +
          (data.payment_status === "shipped" ? " · order closed" : " · balance stays on this ATM")
      );
      setExpandedId(null);
      if (data.invoice) setInvoiceResult(data.invoice);
      await loadAll();
    } catch (err) {
      setActionError(err.message || "Failed to record shipment");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AppShell
      title="Shipment"
      subtitle="Ship ready stock · invoice per ship · same ATM qty reduces"
      maxWidth="64rem"
      showAvatar={false}
      actions={
        <button
          type="button"
          className="btn-secondary text-[12px] font-semibold px-3 py-2 rounded-xl shrink-0"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
          onClick={loadAll}
        >
          Refresh
        </button>
      }
    >
      <ReadOnlyBanner />
      {(loadError || actionError || actionOk) && (
        <div className="space-y-2 mb-5">
          {loadError && (
            <div
              className="rounded-xl px-4 py-3 text-[12.5px]"
              style={{ background: COLORS.rustSoft, color: COLORS.rust }}
            >
              {loadError}
            </div>
          )}
          {actionError && (
            <div
              className="rounded-xl px-4 py-3 text-[12.5px]"
              style={{ background: COLORS.rustSoft, color: COLORS.rust }}
            >
              {actionError}
            </div>
          )}
          {actionOk && (
            <div
              className="rounded-xl px-4 py-3 text-[12.5px] font-medium"
              style={{ background: COLORS.greenSoft, color: COLORS.green }}
            >
              {actionOk}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MiniStat index={0} icon={<WaitingIcon />} label="Ready to ship" value={pending.length} sub="with packed stock" />
        <MiniStat index={1} icon={<TruckIcon />} label="Shipments" value={history.length} sub="on record" />
        <MiniStat
          index={2}
          icon={<DoneIcon />}
          label="Closed ATMs"
          value={history.filter((h, i, arr) => arr.findIndex((x) => x.order_id === h.order_id) === i).length}
          sub="had at least one ship"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div
          className="flex p-1 rounded-xl"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          {[
            { id: "pending", label: "Waiting", count: pending.length },
            { id: "history", label: "History", count: history.length },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="px-3.5 py-2 text-[12.5px] font-semibold rounded-lg inline-flex items-center gap-2"
              style={{
                background: tab === t.id ? COLORS.inkSurface : "transparent",
                color: tab === t.id ? COLORS.onDark : COLORS.graphite,
              }}
            >
              {t.label}
              <span
                className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                style={{
                  background: tab === t.id ? "rgba(255,255,255,0.12)" : COLORS.boneDim,
                  color: tab === t.id ? COLORS.gold : COLORS.graphite,
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ATM, customer, bill…"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl h-[108px] animate-pulse"
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                opacity: 1 - i * 0.15,
              }}
            />
          ))}
        </div>
      ) : tab === "pending" ? (
        filteredPending.length === 0 ? (
          <div
            className="rounded-2xl px-6 py-14 text-center fade-in"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex justify-center mb-3">
              <EmptyBoxIcon />
            </div>
            <div className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
              Nothing ready to ship
            </div>
            <p className="text-[13px] mt-1.5 max-w-sm mx-auto" style={{ color: COLORS.graphite }}>
              {search
                ? "No matches for that search."
                : "When packing hits stock, orders appear here. Waiting for Shipment tags on at 100%+."}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredPending.map((order, i) => (
              <PendingCard
                key={order.order_id}
                order={order}
                index={i}
                open={expandedId === order.order_id}
                onToggle={() => setExpandedId(expandedId === order.order_id ? null : order.order_id)}
                qtyMap={shipQtyByOrder[order.order_id] || {}}
                notes={notesByOrder[order.order_id] || ""}
                onNotes={(v) => setNotesByOrder((prev) => ({ ...prev, [order.order_id]: v }))}
                onQty={(key, v) => setShippedQty(order.order_id, key, v)}
                onShipAll={() => fillMax(order)}
                onConfirm={() => confirmShip(order)}
                saving={savingId === order.order_id}
                securityPct={securityPctByOrder[order.order_id] ?? "3"}
                onSecurityPct={(v) =>
                  setSecurityPctByOrder((prev) => ({ ...prev, [order.order_id]: v }))
                }
                dueDate={dueDateByOrder[order.order_id] || ""}
                onDueDate={(v) => setDueDateByOrder((prev) => ({ ...prev, [order.order_id]: v }))}
                includeExpenses={includeExpensesByOrder[order.order_id] !== false}
                onIncludeExpenses={(v) =>
                  setIncludeExpensesByOrder((prev) => ({ ...prev, [order.order_id]: v }))
                }
                canWrite={canWrite}
              />
            ))}
          </div>
        )
      ) : filteredHistory.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-14 text-center fade-in"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex justify-center mb-3">
            <EmptyBoxIcon />
          </div>
          <div className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
            No shipments yet
          </div>
          <p className="text-[13px] mt-1.5" style={{ color: COLORS.graphite }}>
            {search ? "No matches for that search." : "Confirmed shipments will land here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredHistory.map((ship, i) => (
            <HistoryCard
              key={ship.shipment_id}
              ship={ship}
              index={i}
              open={expandedHistoryId === ship.shipment_id}
              onToggle={() =>
                setExpandedHistoryId(
                  expandedHistoryId === ship.shipment_id ? null : ship.shipment_id
                )
              }
            />
          ))}
        </div>
      )}

      {invoiceResult && (
        <ShipmentInvoiceModal invoice={invoiceResult} onClose={() => setInvoiceResult(null)} />
      )}

      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes growBar { from { width: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-in { animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .ship-bar { animation: growBar 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .spin { animation: spin 0.7s linear infinite; }
        .modal-overlay { background: rgba(28,25,23,0.5); backdrop-filter: blur(2px); animation: overlayIn 0.18s ease both; }
        .modal-pop { animation: modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .ship-card, .btn-primary, .btn-secondary {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
        }
        .ship-card:hover { border-color: ${COLORS.gold} !important; }
        .btn-primary:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
        .btn-primary:disabled { cursor: not-allowed; filter: none; transform: none; }
        .btn-secondary:hover { border-color: ${COLORS.gold} !important; color: ${COLORS.goldDim} !important; }
        .form-label {
          font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em;
          color: ${COLORS.graphite}; margin-bottom: 4px; display: block;
        }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none; width: 100%;
        }
        .form-input:hover, .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .form-input-error { border-color: ${COLORS.rust} !important; }
        .ship-qty-field { width: 108px; }
        .ship-qty-field .form-input { font-weight: 600; }
        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 260px;
        }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        @media (max-width: 640px) {
          .search-wrap { width: 100%; }
          .search-wrap input { width: 100% !important; }
        }
      `}</style>
    </AppShell>
  );
}
