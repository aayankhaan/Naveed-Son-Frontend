// ========================================
// Orders.jsx
// Order pipeline by ATM group: packing progress per line, an order detail
// modal, invoice generation (screen preview + PDF via InvoiceDocument),
// and an add-order form.
// ========================================

import { useState, useMemo, useEffect } from "react";
import { pdf } from "@react-pdf/renderer";
import InvoiceDocument from "./InvoiceDocument";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, ChevronIcon, CloseIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

// Maps a real /api/orders order (order_id, atm_no, lines[].variants[]...) into
// the group/line/color shape the UI below was originally built against, so
// OrderGroupCard, OrderDetailModal, InvoiceModal etc. don't need to change.
function transformOrder(order) {
  return {
    id: order.order_id,
    atmNo: order.atm_no,
    customer: order.customer,
    date: formatDate(order.order_date),
    notes: order.notes || "",
    lines: (order.lines || []).map((line) => ({
      orderId: line.order_line_id,
      articleId: line.article_id,
      article: line.article_name,
      articleNo: String(line.article_id),
      sizeId: line.size_id,
      size: line.size_name || "—",
      dimensionId: line.dimension_id,
      dimensions: line.dimension_name || "—",
      packPerCtn: line.pack_per_ctn,
      quantity: line.quantity,
      readyQuantity: (line.variants || []).reduce((s, v) => s + (Number(v.ready_quantity) || 0), 0),
      netWeight: Number(line.net_weight) || 0,
      grossWeight: Number(line.gross_weight) || 0,
      cartonSize: line.carton_size || "—",
      cbm: Number(line.cbm) || 0,
      colors: (line.variants || []).map((v) => ({
        variantId: v.variant_id,
        design: v.variant_name || "Default",
        barcode: v.barcode || "—",
        quantity: v.quantity,
        readyQuantity: Number(v.ready_quantity) || 0,
      })),
    })),
  };
}

function calcLine(line) {
  const pack = Number(line.packPerCtn) || 1;
  const reqdCtns = Math.ceil(line.quantity / pack);
  const readyCtns = Math.ceil(line.readyQuantity / pack);
  const percent = line.quantity ? Math.min(100, Math.round((line.readyQuantity / line.quantity) * 100)) : 0;
  return { ...line, reqdCtns, readyCtns, percent };
}

function calcGroup(group) {
  const lines = group.lines.map(calcLine);
  const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0);
  const totalReady = lines.reduce((s, l) => s + l.readyQuantity, 0);
  const totalReqdCtns = lines.reduce((s, l) => s + l.reqdCtns, 0);
  const totalReadyCtns = lines.reduce((s, l) => s + l.readyCtns, 0);
  const percent = totalQuantity ? Math.min(100, Math.round((totalReady / totalQuantity) * 100)) : 0;
  return { ...group, lines, totalQuantity, totalReady, totalReqdCtns, totalReadyCtns, percent };
}

function statusOf(percent) {
  if (percent >= 100) return "Complete";
  if (percent > 0) return "In progress";
  return "Not started";
}

function statusColors(status) {
  if (status === "Complete") return { bg: COLORS.greenSoft, fg: COLORS.green };
  if (status === "In progress") return { bg: COLORS.goldSoft, fg: COLORS.goldDim };
  return { bg: COLORS.rustSoft, fg: COLORS.rust };
}

function OrdersStatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 1.8h9l1 2.7v9c0 .8-.6 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2.5 13.5v-9l1-2.7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.3 7.2h5.4M5.3 9.8h5.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function SetsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 6.5h8v8h-8z" stroke="currentColor" strokeWidth="1.3" fill={COLORS.card} />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.7l6 2.9v6.8L8 14.3l-6-2.9V4.6L8 1.7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2 4.6L8 7.5l6-2.9M8 7.5v6.8" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function ProgressIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 8V2.2A5.8 5.8 0 0 1 13.8 8H8z" fill="currentColor" opacity="0.35" />
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
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.6 8.2c0 .5.5.8 1 .8h3.8c.5 0 .9-.3 1-.8L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 1.5h5l2 2v9a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.5 1.5v2h2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M4.5 7h5M4.5 9h5M4.5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 5.5L14 14M5.5 10.5L14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8v8.6M4.3 7.3L8 11l3.7-3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.3 12.3v1.4c0 .7.6 1.2 1.2 1.2h9c.7 0 1.2-.5 1.2-1.2v-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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

function StatusBadge({ status }) {
  const c = statusColors(status);
  return (
    <span className="text-[10.5px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide whitespace-nowrap" style={{ background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}

function OrderGroupCard({ group, index, onOpen, onInvoice, onPartialSplit }) {
  const status = statusOf(group.percent);
  const c = statusColors(status);
  return (
    <div
      className="order-card fade-in rounded-2xl p-5 cursor-pointer"
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: `${index * 50}ms` }}
      onClick={() => onOpen(group)}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: COLORS.boneDim, color: COLORS.goldDim }}>
            {group.atmNo}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>{group.customer}</h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              ATM {group.atmNo} · {group.lines.length} order line{group.lines.length === 1 ? "" : "s"} · {group.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === "Complete" ? (
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-lg shrink-0"
              style={{ background: COLORS.green, color: COLORS.card }}
              onClick={(e) => {
                e.stopPropagation();
                onInvoice(group);
              }}
            >
              <InvoiceIcon /> Create invoice
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, background: COLORS.card }}
              onClick={(e) => {
                e.stopPropagation();
                onPartialSplit(group);
              }}
            >
              <ScissorsIcon /> Partial Split
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: COLORS.graphiteLight }}>Total sets</div>
          <div className="text-[14px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{group.totalQuantity.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: COLORS.graphiteLight }}>Cartons</div>
          <div className="text-[14px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{group.totalReadyCtns.toLocaleString()} / {group.totalReqdCtns.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: COLORS.graphiteLight }}>Ready</div>
          <div className="text-[14px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{group.totalReady.toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.boneDim }}>
          <div className="h-2 rounded-full due-bar" style={{ width: `${group.percent}%`, background: c.fg }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>{group.percent}% against order</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {group.lines.map((l) => (
              <span key={l.orderId} className="text-[10.5px] font-medium px-1.5 py-0.5 rounded" style={{ background: COLORS.boneDim, color: COLORS.graphite }}>
                #{l.orderId}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ group, onClose, onInvoice }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!group) return null;
  const status = statusOf(group.percent);

  return (
    <div className="modal-overlay fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-5 sticky top-0 z-10" style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>{group.customer}</h2>
              <StatusBadge status={status} />
            </div>
            <p className="text-[11.5px] mt-1" style={{ color: COLORS.graphiteLight }}>ATM No {group.atmNo} · {group.date}</p>
          </div>
          <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Order lines</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{group.lines.length}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Total sets</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{group.totalQuantity.toLocaleString()}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Cartons ready</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{group.totalReadyCtns.toLocaleString()} / {group.totalReqdCtns.toLocaleString()}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: COLORS.goldSoft }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>% against order</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{group.percent}%</div>
            </div>
          </div>

          {group.notes && (
            <div className="rounded-xl px-4 py-3 mb-4 text-[12px]" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
              {group.notes}
            </div>
          )}

          {/* Client Supplied Fabric & Yield Tracker */}
          <div className="rounded-2xl p-4 mb-6" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <h4 className="text-[12px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: COLORS.ink }}>Client Supplied Fabric Inventory &amp; Yield Efficiency</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
              <div>
                <span className="text-[10px] uppercase font-semibold block" style={{ color: COLORS.graphite }}>Fabric Received</span>
                <strong style={{ color: COLORS.ink }}>{(group.metersReceived || 5000).toLocaleString()} meters</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold block" style={{ color: COLORS.graphite }}>Expected Yield</span>
                <strong style={{ color: COLORS.ink }}>{(group.expectedYield || group.totalQuantity).toLocaleString()} pcs</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold block" style={{ color: COLORS.graphite }}>Actual Dispatched</span>
                <strong style={{ color: COLORS.ink }}>{group.totalReady.toLocaleString()} pcs</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold block" style={{ color: COLORS.graphite }}>Fabric Wastage %</span>
                <strong className="text-[13px]" style={{ color: COLORS.goldDim }}>
                  {Math.max(0, (((group.expectedYield || group.totalQuantity) - group.totalReady) / (group.expectedYield || group.totalQuantity) * 100)).toFixed(1)}%
                </strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {group.lines.map((line) => (
              <div key={line.orderId} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-3" style={{ background: COLORS.boneDim }}>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[12px] font-bold px-2 py-1 rounded" style={{ background: COLORS.ink, color: COLORS.gold }}>#{line.orderId}</span>
                    <span className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>{line.article}</span>
                    <span className="text-[11.5px]" style={{ color: COLORS.graphite }}>{line.size} · {line.dimensions}</span>
                  </div>
                  <StatusBadge status={statusOf(line.percent)} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-5">
                  <div className="lg:col-span-2">
                    <div className="text-[10.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.graphiteLight }}>Design / Color</div>
                    <div className="flex flex-col gap-1.5">
                      {line.colors.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: COLORS.bone }}>
                          <span style={{ color: COLORS.ink }}>{c.design}</span>
                          <span className="text-[10.5px]" style={{ color: COLORS.graphiteLight }}>
                            {(c.readyQuantity || 0).toLocaleString()} / {c.quantity.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <StatBlock label="Quantity" value={line.quantity.toLocaleString()} />
                      <StatBlock label="Pack / CTN" value={line.packPerCtn} />
                      <StatBlock label="Reqd CTNS" value={line.reqdCtns.toLocaleString()} />
                      <StatBlock label="Ready Qty" value={line.readyQuantity.toLocaleString()} />
                      <StatBlock label="Ready CTNS" value={line.readyCtns.toLocaleString()} />
                      <StatBlock label="% Against order" value={`${line.percent}%`} highlight />
                      <StatBlock label="Carton numbering" value={`1 to ${line.reqdCtns}`} />
                      <StatBlock label="Net / Gross wt" value={`${line.netWeight} / ${line.grossWeight} kg`} />
                      <StatBlock label="Carton size / CBM" value={`${line.cartonSize} · ${line.cbm}`} />
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mt-4" style={{ background: COLORS.boneDim }}>
                      <div className="h-1.5 rounded-full due-bar" style={{ width: `${line.percent}%`, background: statusColors(statusOf(line.percent)).fg }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {status === "Complete" && (
          <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 flex-wrap" style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
            <span className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>Every line is packed and ready — this order can be invoiced.</span>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-lg shrink-0"
              style={{ background: COLORS.green, color: COLORS.card }}
              onClick={() => onInvoice(group)}
            >
              <InvoiceIcon /> Create invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, highlight }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>{label}</div>
      <div className="text-[13px] font-semibold mt-0.5" style={{ color: highlight ? COLORS.goldDim : COLORS.ink }}>{value}</div>
    </div>
  );
}

function buildInvoiceRows(group) {
  const rows = [];
  group.lines.forEach((line) => {
    if (line.colors.length) {
      line.colors.forEach((c) => {
        rows.push({ description: `${line.article} (${line.size})`, design: c.design, qty: c.quantity, rate: "" });
      });
    } else {
      rows.push({ description: `${line.article} (${line.size})`, design: "—", qty: line.quantity, rate: "" });
    }
  });
  return rows;
}

function InvoiceModal({ group, billNo, onClose }) {
  const [rows, setRows] = useState(() => buildInvoiceRows(group));
  const [name, setName] = useState(group.customer);
  const [orderRef, setOrderRef] = useState(`ATM ${group.atmNo}`);
  const [challanNo, setChallanNo] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }));
  const [partyName, setPartyName] = useState(group.customer);
  const [jobOrderNo, setJobOrderNo] = useState(group.atmNo);
  const [scNo, setScNo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function updateRow(i, field, value) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  const subTotal = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);

  function buildInvoiceElement() {
    return (
      <InvoiceDocument
        billNo={billNo}
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
      link.download = `Invoice-${billNo}-${group.customer.replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      window.alert("Couldn't generate the PDF. Check the console for details.");
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
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.src = url;

      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        URL.revokeObjectURL(url);
      };

      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.warn("In-place print failed, opening PDF in a new tab instead:", err);
          window.open(url, "_blank");
        }
        setTimeout(cleanup, 60000);
      };

      document.body.appendChild(iframe);
    } catch (err) {
      console.error("PDF print failed:", err);
      window.alert("Couldn't prepare the PDF for printing. Check the console for details.");
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
        <div className="no-print flex items-center justify-between gap-3 px-6 py-4 sticky top-0 z-10" style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Invoice preview</h2>
            <p className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>Fill in rates, then download or print — no printer needed to check the layout</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, opacity: isExporting ? 0.7 : 1, cursor: isExporting ? "wait" : "pointer" }}
              onClick={handleDownloadPdf}
              disabled={isExporting}
            >
              {isExporting ? <SpinnerIcon /> : <DownloadIcon />} {isExporting ? "Generating…" : "Download PDF"}
            </button>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, opacity: isPrinting ? 0.7 : 1, cursor: isPrinting ? "wait" : "pointer" }}
              onClick={handlePrintPdf}
              disabled={isPrinting}
            >
              {isPrinting ? <SpinnerIcon /> : <PrintIcon />} {isPrinting ? "Preparing…" : "Print"}
            </button>
            <button type="button" className="btn-secondary p-2 rounded-lg" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="invoice-print p-6">
          <div
            className="rounded-lg p-4"
            style={{
              border: "1.5px solid #000",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <h1
              className="text-[20px] font-bold tracking-wide"
              style={{ color: "#000", fontFamily: "Georgia, 'Times New Roman', serif", textAlign: "center", margin: 0, lineHeight: 1.4 }}
            >
              NAVEED &amp; SONS
            </h1>
          </div>

          <div className="flex items-center gap-1 mt-4 text-[13px]" style={{ color: "#000" }}>
             <div className="text-[12px] font-bold text-center mb-3 border border-transparent px-3 py-1 rounded-md" style={{ color: "#000" }}>Bill No.</div>
            <div className="mb-3 border border-black px-3 py-1 rounded-md flex item-c">
                <p className="text-[12px] font-bold text-center">{billNo}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-3">
            
              <div className="rounded-lg p-4" style={{ border: "1px solid #000" }}>
                <div className="text-[12px] font-bold text-center mb-3" style={{ color: "#000" }}>Billing Details</div>
                <InvoiceField label="Name" value={name} onChange={setName} />
                <InvoiceField label="Order" value={orderRef} onChange={setOrderRef} />
                <InvoiceField label="Challan #" value={challanNo} onChange={setChallanNo} />
              </div>
              <div className="rounded-lg p-4" style={{ border: "1px solid #000" }}>
                <InvoiceField label="Date" value={date} onChange={setDate} />
                <InvoiceField label="Party Name" value={partyName} onChange={setPartyName} />
                <InvoiceField label="Job Order #" value={jobOrderNo} onChange={setJobOrderNo} />
                <InvoiceField label="S/C #" value={scNo} onChange={setScNo} />
              </div>
          </div>

          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: "1px solid #000" }}>
            <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fff" }}>
                  <th className="text-center font-semibold px-2 py-2" style={{ border: "1px solid #000", color: "#000" }}>SR#</th>
                  <th className="text-left font-semibold px-3 py-2" style={{ border: "1px solid #000", color: "#000" }}>Description</th>
                  <th className="text-left font-semibold px-3 py-2" style={{ border: "1px solid #000", color: "#000" }}>Design</th>
                  <th className="text-right font-semibold px-3 py-2" style={{ border: "1px solid #000", color: "#000" }}>Qty</th>
                  <th className="text-right font-semibold px-3 py-2" style={{ border: "1px solid #000", color: "#000" }}>Rate</th>
                  <th className="text-right font-semibold px-3 py-2" style={{ border: "1px solid #000", color: "#000" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="text-center px-2 py-1.5" style={{ border: "1px solid #000", color: "#000" }}>{i + 1}</td>
                    <td className="px-1 py-1" style={{ border: "1px solid #000", color: "#000" }}>{row.description}</td>
                    <td className="px-1 py-1" style={{ border: "1px solid #000", color: "#000" }}>{row.design}</td>
                    <td className="px-1 py-1" style={{ border: "1px solid #000", color: "#000" }}>
                      <input className="invoice-cell-input text-right" value={row.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} />
                    </td>
                    <td className="px-1 py-1" style={{ border: "1px solid #000", color: "#000" }}>
                      <input className="invoice-cell-input text-right" placeholder="0" value={row.rate} onChange={(e) => updateRow(i, "rate", e.target.value)} />
                    </td>
                    <td className="text-right px-3 py-1.5 font-medium" style={{ border: "1px solid #000", color: "#000" }}>
                      {((Number(row.qty) || 0) * (Number(row.rate) || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="text-right px-3 py-2 font-semibold" style={{ border: "1px solid #000", color: "#000" }}>Sub Total</td>
                  <td className="text-right px-3 py-2 font-bold" style={{ border: "1px solid #000", color: "#000" }}>{subTotal.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-10 text-[11px] text-center" style={{ color: "#000" }}>
            <div>
              <div className="pt-6" style={{ borderTop: "1px solid #000" }}>Prepared By</div>
            </div>
            <div>
              <div className="pt-6" style={{ borderTop: "1px solid #000" }}>Approved By</div>
            </div>
            <div>
              <div className="pt-6" style={{ borderTop: "1px solid #000" }}>Checked By</div>
            </div>
            <div>
              <div className="pt-6" style={{ borderTop: "1px solid #000" }}>Contractor</div>
            </div>
          </div>
        </div>

        <div className="no-print px-6 pb-5 text-[11px]" style={{ color: COLORS.graphiteLight }}>
          Once your backend is connected, printing this can automatically move the order off the active list and into an Invoices page.
        </div>
      </div>
    </div>
  );
}

function InvoiceField({ label, value, onChange }) {
  return (
    <div className="flex items-baseline gap-2 mb-2 text-[12px]">
      <span className="font-semibold shrink-0" style={{ color: COLORS.ink, minWidth: 78 }}>{label}:</span>
      <input
        className="invoice-line-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function emptyLine() {
  return {
    articleId: null,
    sizeId: null,
    dimensionId: null,
    packPerCtn: 6,
    quantity: "",
    netWeight: "",
    grossWeight: "",
    cartonSize: "",
    cbm: "",
    splitMode: "equal", // "equal" | "custom"
    selectedVariantIds: [], // article_variants chosen as designs/colors for this line
    variantMeta: {}, // variantId -> { quantity: '', barcode: '' } (quantity used only in custom mode)
  };
}
function emptyDraft() {
  return { atmNo: "", customer: "", date: "", lines: [emptyLine()] };
}

// Splits `quantity` across `ids` as evenly as possible — remainder pieces go
// to the first few designs so the numbers always add up exactly.
function equalSplit(quantity, ids) {
  const n = ids.length;
  if (!n) return {};
  const base = Math.floor(quantity / n);
  const remainder = quantity - base * n;
  const out = {};
  ids.forEach((id, i) => { out[id] = base + (i < remainder ? 1 : 0); });
  return out;
}

function PartialOrderModal({ group, onClose, onConfirmSplit, isSaving, error }) {
  const totalQty = group.totalQuantity;
  const readyQty = group.totalReady;
  const remainingQty = Math.max(0, totalQty - readyQty);

  function handleSubmit(e) {
    e.preventDefault();
    if (onConfirmSplit) onConfirmSplit(group);
  }

  return (
    <div className="modal-overlay fixed inset-0 z-70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[14px] font-bold" style={{ background: COLORS.goldSoft, color: COLORS.goldDim, border: `1px solid ${COLORS.border}` }}>
              <ScissorsIcon />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Partial Order Split &amp; Invoice</h3>
              <p className="text-[11px]" style={{ color: COLORS.graphiteLight }}>ATM {group.atmNo} · {group.customer}</p>
            </div>
          </div>
          <button type="button" className="p-1 rounded-lg" onClick={onClose}><CloseIcon /></button>
        </div>

        {error && (
          <div className="rounded-xl px-3.5 py-2.5 mb-4 text-[12px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <p className="text-[12px] mb-4" style={{ color: COLORS.graphite }}>
            This splits off everything that's actually been packed so far into a new order ready to invoice, and leaves the rest as a balance order still in progress — based on real packing records, not a manual guess.
          </p>

          <div className="rounded-xl p-3.5 mb-5 space-y-2 text-[12px]" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
            <div className="flex justify-between">
              <span style={{ color: COLORS.ink }}>Ready to invoice now:</span>
              <strong className="text-[13px]" style={{ color: COLORS.goldDim }}>{readyQty.toLocaleString()} pcs</strong>
            </div>
            <div className="flex justify-between pt-1 border-t" style={{ borderColor: COLORS.border }}>
              <span style={{ color: COLORS.graphite }}>New Balance Order (Pending):</span>
              <strong style={{ color: COLORS.rust }}>{remainingQty.toLocaleString()} pcs</strong>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" className="btn-secondary text-[12px] font-semibold px-4 py-2 rounded-lg" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.ink, cursor: isSaving || readyQty === 0 ? "not-allowed" : "pointer", opacity: isSaving || readyQty === 0 ? 0.7 : 1 }} disabled={isSaving || readyQty === 0}>
              {isSaving ? "Splitting…" : readyQty === 0 ? "Nothing packed yet" : "Process Partial Shipment & Split"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Null when the line's design/color split is fine (or not applicable);
// otherwise a short message describing why it doesn't add up yet.
function lineSplitError(line) {
  if (!line.selectedVariantIds.length) return null;
  if (line.splitMode !== "custom") return null; // equal split always sums exactly by construction
  const qty = Number(line.quantity) || 0;
  const sum = line.selectedVariantIds.reduce((s, id) => s + (Number(line.variantMeta[id]?.quantity) || 0), 0);
  if (sum !== qty) return `Split adds up to ${sum.toLocaleString()}, needs to equal ${qty.toLocaleString()}`;
  return null;
}

function AddOrderModal({ articles, onClose, onSave, isSaving, error }) {
  const [draft, setDraft] = useState(() => ({ ...emptyDraft(), date: todayISO() }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function setField(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }
  function setLineField(idx, field, value) {
    setDraft((d) => ({ ...d, lines: d.lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)) }));
  }
  function setLineArticle(idx, articleId) {
    // Size/dimension/design choices are all specific to the article, so
    // switching articles clears them rather than leaving stale ids around.
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l, i) => (i !== idx ? l : { ...l, articleId, sizeId: null, dimensionId: null, selectedVariantIds: [], variantMeta: {} })),
    }));
  }
  function addLine() {
    setDraft((d) => ({ ...d, lines: [...d.lines, emptyLine()] }));
  }
  function removeLine(idx) {
    setDraft((d) => ({ ...d, lines: d.lines.filter((_, i) => i !== idx) }));
  }
  function toggleVariant(lineIdx, variantId) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l, i) => {
        if (i !== lineIdx) return l;
        const selected = l.selectedVariantIds.includes(variantId);
        const selectedVariantIds = selected ? l.selectedVariantIds.filter((id) => id !== variantId) : [...l.selectedVariantIds, variantId];
        const variantMeta = { ...l.variantMeta };
        if (!selected && !variantMeta[variantId]) variantMeta[variantId] = { quantity: "", barcode: "" };
        return { ...l, selectedVariantIds, variantMeta };
      }),
    }));
  }
  function setSplitMode(lineIdx, mode) {
    setLineField(lineIdx, "splitMode", mode);
  }
  function setVariantMeta(lineIdx, variantId, field, value) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l, i) =>
        i !== lineIdx ? l : { ...l, variantMeta: { ...l.variantMeta, [variantId]: { ...l.variantMeta[variantId], [field]: value } } }
      ),
    }));
  }

  const isValid =
    draft.atmNo.trim() &&
    draft.customer.trim() &&
    draft.lines.some((l) => l.articleId && Number(l.quantity) > 0) &&
    draft.lines.every((l) => !(l.articleId && Number(l.quantity) > 0) || !lineSplitError(l));

  function handleSubmit() {
    if (!isValid || isSaving) return;
    const cleanLines = draft.lines
      .filter((l) => l.articleId && Number(l.quantity) > 0)
      .map((l) => {
        const qty = Number(l.quantity) || 0;
        const split = l.splitMode === "equal" ? equalSplit(qty, l.selectedVariantIds) : null;
        return {
          article_id: l.articleId,
          size_id: l.sizeId || null,
          dimension_id: l.dimensionId || null,
          quantity: qty,
          pack_per_ctn: Number(l.packPerCtn) || 1,
          net_weight: l.netWeight === "" ? null : Number(l.netWeight),
          gross_weight: l.grossWeight === "" ? null : Number(l.grossWeight),
          carton_size: l.cartonSize.trim() || null,
          cbm: l.cbm === "" ? null : Number(l.cbm),
          variants: l.selectedVariantIds.map((id) => ({
            variant_id: id,
            barcode: l.variantMeta[id]?.barcode?.trim() || null,
            quantity: l.splitMode === "equal" ? split[id] : Number(l.variantMeta[id]?.quantity) || 0,
          })),
        };
      });

    onSave({
      atm_no: draft.atmNo.trim(),
      customer: draft.customer.trim(),
      order_date: draft.date || todayISO(),
      notes: "",
      lines: cleanLines,
    });
  }

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
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>New order</h2>
            <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>Add an ATM order with one or more order lines, pulled straight from your articles</p>
          </div>
          <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-[12px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div>
              <label className="form-label">ATM No</label>
              <input className="form-input" value={draft.atmNo} onChange={(e) => setField("atmNo", e.target.value)} placeholder="e.g. 4431" />
            </div>
            <div>
              <label className="form-label">Customer</label>
              <input className="form-input" value={draft.customer} onChange={(e) => setField("customer", e.target.value)} placeholder="e.g. ZEEMAN" />
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={draft.date} onChange={(e) => setField("date", e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {draft.lines.map((line, lineIdx) => {
              const article = articles.find((a) => a.article_id === line.articleId) || null;
              const qty = Number(line.quantity) || 0;
              const splitError = lineSplitError(line);
              const equalPreview = line.splitMode === "equal" ? equalSplit(qty, line.selectedVariantIds) : null;
              const customSum = line.selectedVariantIds.reduce((s, id) => s + (Number(line.variantMeta[id]?.quantity) || 0), 0);

              return (
                <div key={lineIdx} className="line-card rounded-2xl p-4" style={{ border: `1.5px dashed ${COLORS.boneBorder}`, background: COLORS.bone }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Order line {lineIdx + 1}</span>
                    {draft.lines.length > 1 && (
                      <button type="button" className="icon-btn-remove" onClick={() => removeLine(lineIdx)} aria-label="Remove line">
                        <TrashIcon />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="sm:col-span-2">
                      <label className="form-label">Article</label>
                      <div className="select-wrap w-full">
                        <select className="w-full" value={line.articleId ?? ""} onChange={(e) => setLineArticle(lineIdx, e.target.value ? Number(e.target.value) : null)}>
                          <option value="">Select article…</option>
                          {articles.map((a) => (
                            <option key={a.article_id} value={a.article_id}>{a.article_name}</option>
                          ))}
                        </select>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                          <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Size</label>
                      {article?.sizes?.length > 0 ? (
                        <div className="select-wrap w-full">
                          <select className="w-full" value={line.sizeId ?? ""} onChange={(e) => setLineField(lineIdx, "sizeId", e.target.value ? Number(e.target.value) : null)}>
                            <option value="">No size</option>
                            {article.sizes.map((s) => (
                              <option key={s.size_id} value={s.size_id}>{s.size_name}</option>
                            ))}
                          </select>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                            <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : (
                        <div className="form-input" style={{ color: COLORS.graphiteLight, background: COLORS.boneDim }}>{article ? "No sizes" : "—"}</div>
                      )}
                    </div>
                    <div>
                      <label className="form-label">Dimensions</label>
                      {article?.dimensions?.length > 0 ? (
                        <div className="select-wrap w-full">
                          <select className="w-full" value={line.dimensionId ?? ""} onChange={(e) => setLineField(lineIdx, "dimensionId", e.target.value ? Number(e.target.value) : null)}>
                            <option value="">No dimension</option>
                            {article.dimensions.map((d) => (
                              <option key={d.dimension_id} value={d.dimension_id}>{d.dimension_name}</option>
                            ))}
                          </select>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                            <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : (
                        <div className="form-input" style={{ color: COLORS.graphiteLight, background: COLORS.boneDim }}>{article ? "No dimensions" : "—"}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="form-label">Pack / CTN</label>
                      <input type="number" className="form-input" value={line.packPerCtn} onChange={(e) => setLineField(lineIdx, "packPerCtn", e.target.value)} placeholder="6" />
                    </div>
                    <div>
                      <label className="form-label">Quantity</label>
                      <input type="number" className="form-input" value={line.quantity} onChange={(e) => setLineField(lineIdx, "quantity", e.target.value)} placeholder="5502" />
                    </div>
                    <div>
                      <label className="form-label">Reqd CTNS</label>
                      <input className="form-input" value={qty && line.packPerCtn ? Math.ceil(qty / Number(line.packPerCtn)) : ""} disabled placeholder="auto" style={{ color: COLORS.graphiteLight, background: COLORS.boneDim }} />
                    </div>
                  </div>

                  <details className="mb-3">
                    <summary className="text-[11px] font-semibold cursor-pointer select-none" style={{ color: COLORS.goldDim }}>
                      Shipping details (optional)
                    </summary>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2.5">
                      <div>
                        <label className="form-label">Net weight (kg)</label>
                        <input type="number" className="form-input" value={line.netWeight} onChange={(e) => setLineField(lineIdx, "netWeight", e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label">Gross weight (kg)</label>
                        <input type="number" className="form-input" value={line.grossWeight} onChange={(e) => setLineField(lineIdx, "grossWeight", e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label">Carton size</label>
                        <input className="form-input" value={line.cartonSize} onChange={(e) => setLineField(lineIdx, "cartonSize", e.target.value)} placeholder="47x35x14" />
                      </div>
                      <div>
                        <label className="form-label">CBM</label>
                        <input type="number" className="form-input" value={line.cbm} onChange={(e) => setLineField(lineIdx, "cbm", e.target.value)} />
                      </div>
                    </div>
                  </details>

                  <div>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <label className="form-label mb-0">Design / Color</label>
                      {line.selectedVariantIds.length > 1 && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold">
                          <button type="button" className={line.splitMode === "equal" ? "btn-primary" : "btn-secondary"} style={{ padding: "3px 9px", borderRadius: 6, background: line.splitMode === "equal" ? COLORS.gold : COLORS.card, color: line.splitMode === "equal" ? COLORS.ink : COLORS.graphite, border: `1px solid ${COLORS.border}` }} onClick={() => setSplitMode(lineIdx, "equal")}>
                            Equal split
                          </button>
                          <button type="button" className={line.splitMode === "custom" ? "btn-primary" : "btn-secondary"} style={{ padding: "3px 9px", borderRadius: 6, background: line.splitMode === "custom" ? COLORS.gold : COLORS.card, color: line.splitMode === "custom" ? COLORS.ink : COLORS.graphite, border: `1px solid ${COLORS.border}` }} onClick={() => setSplitMode(lineIdx, "custom")}>
                            Custom split
                          </button>
                        </div>
                      )}
                    </div>

                    {!article ? (
                      <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>Select an article first</span>
                    ) : article.variants?.length > 0 ? (
                      <>
                        <div className="flex flex-col gap-1.5">
                          {article.variants.map((v) => {
                            const checked = line.selectedVariantIds.includes(v.variant_id);
                            const meta = line.variantMeta[v.variant_id] || { quantity: "", barcode: "" };
                            return (
                              <div key={v.variant_id} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                                <input type="checkbox" checked={checked} onChange={() => toggleVariant(lineIdx, v.variant_id)} />
                                <span className="flex-1" style={{ color: COLORS.ink }}>{v.variant_name}</span>
                                {checked && (
                                  <>
                                    <input
                                      className="form-input"
                                      style={{ width: 130 }}
                                      value={meta.barcode}
                                      onChange={(e) => setVariantMeta(lineIdx, v.variant_id, "barcode", e.target.value)}
                                      placeholder="barcode (optional)"
                                    />
                                    {line.splitMode === "custom" && line.selectedVariantIds.length > 1 ? (
                                      <input
                                        type="number"
                                        className="form-input text-right"
                                        style={{ width: 84 }}
                                        value={meta.quantity}
                                        onChange={(e) => setVariantMeta(lineIdx, v.variant_id, "quantity", e.target.value)}
                                        placeholder="qty"
                                      />
                                    ) : (
                                      <span className="text-[12px] font-semibold" style={{ width: 84, textAlign: "right", color: COLORS.graphite }}>
                                        {(equalPreview ? equalPreview[v.variant_id] : qty).toLocaleString()}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {line.selectedVariantIds.length > 0 && (
                          <p className="text-[11px] mt-1.5" style={{ color: splitError ? COLORS.rust : COLORS.graphiteLight }}>
                            {line.splitMode === "custom" && line.selectedVariantIds.length > 1
                              ? `Split: ${customSum.toLocaleString()} / ${qty.toLocaleString()} needed`
                              : "Quantity split evenly across selected designs"}
                          </p>
                        )}
                        {!line.selectedVariantIds.length && (
                          <p className="text-[11px] mt-1.5" style={{ color: COLORS.graphiteLight }}>No design selected — quantity will be tracked without a design/color split.</p>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>This article has no design/color variants set up in Costing.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" className="btn-dashed mt-4 w-full justify-center py-3" onClick={addLine}>
            <PlusIcon /> Add order line
          </button>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4" style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
          <button type="button" className="btn-secondary text-[12.5px] font-medium px-4 py-2 rounded-lg" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: isValid ? COLORS.gold : COLORS.boneBorder, color: isValid ? COLORS.ink : COLORS.graphiteLight, cursor: isValid && !isSaving ? "pointer" : "not-allowed" }}
            onClick={handleSubmit}
            disabled={!isValid || isSaving}
          >
            {isSaving ? "Saving…" : "Add order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [orders, setOrders] = useState([]);
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openGroupId, setOpenGroupId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [saveOrderError, setSaveOrderError] = useState("");
  const [invoiceGroupId, setInvoiceGroupId] = useState(null);
  const [partialSplitGroup, setPartialSplitGroup] = useState(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitError, setSplitError] = useState("");
  const [billNumbers, setBillNumbers] = useState({});
  const [nextBillNo, setNextBillNo] = useState(2309);

  async function fetchOrders() {
    const res = await apiFetch("/api/orders");
    if (!res.ok) throw new Error("Failed to load orders");
    return res.json();
  }

  useEffect(() => {
    async function fetchAll() {
      setIsLoading(true);
      setLoadError("");
      try {
        const [ordersData, artRes] = await Promise.all([fetchOrders(), apiFetch("/api/articles")]);
        setOrders(ordersData);
        setArticles(await artRes.json());
      } catch (err) {
        console.error("Failed to load orders/articles", err);
        setLoadError("Couldn't load orders from the server. Try refreshing the page.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  const orderGroups = useMemo(() => orders.map((o) => calcGroup(transformOrder(o))), [orders]);
  const openGroup = useMemo(() => orderGroups.find((g) => g.id === openGroupId) || null, [orderGroups, openGroupId]);
  const invoiceGroup = useMemo(() => orderGroups.find((g) => g.id === invoiceGroupId) || null, [orderGroups, invoiceGroupId]);
  const partialGroupLive = useMemo(
    () => (partialSplitGroup ? orderGroups.find((g) => g.id === partialSplitGroup.id) || null : null),
    [orderGroups, partialSplitGroup]
  );

  function handleOpenInvoice(group) {
    if (!billNumbers[group.id]) {
      setBillNumbers((prev) => ({ ...prev, [group.id]: nextBillNo }));
      setNextBillNo((n) => n + 1);
    }
    setInvoiceGroupId(group.id);
    setOpenGroupId(null);
  }

  async function handleSaveOrder(payload) {
    setIsSavingOrder(true);
    setSaveOrderError("");
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong saving the order");
      setOrders((prev) => [data, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      console.error("Failed to save order", err);
      setSaveOrderError(err.message);
    } finally {
      setIsSavingOrder(false);
    }
  }

  async function handleConfirmSplit(group) {
    setIsSplitting(true);
    setSplitError("");
    try {
      const res = await apiFetch(`/api/orders/${group.id}/split`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong splitting the order");
      setOrders((prev) => [data.shipped, data.balance, ...prev.filter((o) => o.order_id !== group.id)]);
      setPartialSplitGroup(null);
      handleOpenInvoice(calcGroup(transformOrder(data.shipped)));
    } catch (err) {
      console.error("Failed to split order", err);
      setSplitError(err.message);
    } finally {
      setIsSplitting(false);
    }
  }

  const filtered = useMemo(() => {
    return orderGroups
      .filter((g) => (statusFilter === "All statuses" ? true : statusOf(g.percent) === statusFilter))
      .filter((g) => {
        const q = search.toLowerCase();
        return g.customer.toLowerCase().includes(q) || g.atmNo.includes(q) || g.lines.some((l) => String(l.orderId).includes(q));
      });
  }, [orderGroups, search, statusFilter]);

  const totalOrders = orderGroups.length;
  const totalSets = orderGroups.reduce((s, g) => s + g.totalQuantity, 0);
  const totalCartons = orderGroups.reduce((s, g) => s + g.totalReqdCtns, 0);
  const readyCartons = orderGroups.reduce((s, g) => s + g.totalReadyCtns, 0);

  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.bone, fontFamily: FONT }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 px-5 md:px-8 py-4 sticky top-0 z-30 backdrop-blur" style={{ background: `${COLORS.bone}F2`, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" className="md:hidden p-2 rounded-lg btn-secondary shrink-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4h12M2 8h12M2 12h12" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{ color: COLORS.ink }}>Orders</h1>
              <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>{totalOrders} ATM order{totalOrders === 1 ? "" : "s"} on the floor</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button type="button" className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={() => { setSaveOrderError(""); setShowAddModal(true); }}>
              <PlusIcon /> <span className="hidden xs:inline">New order</span>
            </button>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: COLORS.ink, color: COLORS.gold, border: `2px solid ${COLORS.goldSoft}` }}>
              A
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          {loadError && (
            <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>{loadError}</div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<OrdersStatIcon />} label="ATM orders" value={totalOrders} sub="active on the floor" />
            <MiniStat index={1} icon={<SetsIcon />} label="Total sets" value={totalSets.toLocaleString()} sub="across all orders" />
            <MiniStat index={2} icon={<BoxIcon />} label="Cartons ready" value={`${readyCartons.toLocaleString()} / ${totalCartons.toLocaleString()}`} sub="packed vs required" />
            <MiniStat index={3} icon={<ProgressIcon />} label="In progress" value={orderGroups.filter((g) => statusOf(g.percent) === "In progress").length} sub={`${orderGroups.filter((g) => statusOf(g.percent) === "Not started").length} not started`} />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="search-wrap">
              <SearchIcon />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, ATM no, order #" style={{ width: 260 }} />
            </div>
            <div className="select-wrap">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {["All statuses", "Not started", "In progress", "Complete"].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>{isLoading ? "Loading…" : `${filtered.length} shown`}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((group, i) => (
              <OrderGroupCard
                key={group.id}
                group={group}
                index={i}
                onOpen={(g) => setOpenGroupId(g.id)}
                onInvoice={handleOpenInvoice}
                onPartialSplit={(g) => { setSplitError(""); setPartialSplitGroup(g); }}
              />
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="lg:col-span-2 rounded-2xl p-8 text-center text-[12.5px]" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.graphiteLight }}>
                No orders match your search.
              </div>
            )}
          </div>
        </div>
      </div>

      {openGroup && <OrderDetailModal group={openGroup} onClose={() => setOpenGroupId(null)} onInvoice={handleOpenInvoice} />}
      {partialGroupLive && (
        <PartialOrderModal
          group={partialGroupLive}
          onClose={() => setPartialSplitGroup(null)}
          onConfirmSplit={handleConfirmSplit}
          isSaving={isSplitting}
          error={splitError}
        />
      )}
      {showAddModal && (
        <AddOrderModal
          articles={articles}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveOrder}
          isSaving={isSavingOrder}
          error={saveOrderError}
        />
      )}
      {invoiceGroup && <InvoiceModal group={invoiceGroup} billNo={billNumbers[invoiceGroup.id]} onClose={() => setInvoiceGroupId(null)} />}


      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes growBar { from { width: 0; } }

        .fade-in { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .due-bar { animation: growBar 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .modal-overlay { background: rgba(28,25,23,0.5); backdrop-filter: blur(2px); animation: overlayIn 0.18s ease both; }
        .modal-pop { animation: modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .stat-card, .order-card, .btn-primary, .btn-secondary, .btn-link, .btn-dashed, .icon-btn-remove {
          transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, color .18s ease;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 14px 28px -18px rgba(28,25,23,0.28); border-color: ${COLORS.gold} !important; }
        .order-card:hover { transform: translateY(-2px); box-shadow: 0 12px 26px -16px rgba(28,25,23,0.24); border-color: ${COLORS.gold} !important; }

        .btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 8px 18px -8px rgba(184,135,61,0.5); }
        .btn-primary:active { transform: translateY(0); }
        .btn-primary:disabled:hover { filter: none; transform: none; box-shadow: none; }
        .btn-secondary:hover { border-color: ${COLORS.gold} !important; color: ${COLORS.goldDim} !important; background: ${COLORS.goldSoft}55 !important; }

        .btn-dashed {
          border: 1.5px dashed ${COLORS.boneBorder}; border-radius: 10px; padding: 9px 14px; font-size: 12px; font-weight: 600;
          color: ${COLORS.graphite}; background: transparent; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: ${FONT};
        }
        .btn-dashed:hover { border-color: ${COLORS.gold}; color: ${COLORS.goldDim}; background: ${COLORS.goldSoft}33; }

        .icon-btn-remove {
          width: 24px; height: 24px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
          background: ${COLORS.rustSoft}; color: ${COLORS.rust}; border: none; cursor: pointer;
        }
        .icon-btn-remove:hover { background: ${COLORS.rust}; color: ${COLORS.card}; }

        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: ${COLORS.graphite}; margin-bottom: 4px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none; width: 100%;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .form-input:hover, .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .form-input:disabled { cursor: not-allowed; }

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
          outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .search-wrap input::placeholder { color: ${COLORS.graphiteLight}; }
        .search-wrap input:hover, .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        .nav-item { transition: background .18s ease, transform .18s ease, color .18s ease; }
        .nav-item:hover:not(:disabled) { background: ${COLORS.inkSoft} !important; transform: translateX(2px); }

        details summary::-webkit-details-marker { display: none; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }

        details summary { list-style: none; }

        .invoice-line-input {
          flex: 1; font-family: ${FONT}; font-size: 12px; color: #000; background: transparent;
          border: none; border-bottom: 1px solid #000; outline: none; padding: 2px 2px;
        }
        .invoice-line-input:focus { border-color: #000; }
        .invoice-cell-input {
          width: 100%; font-family: ${FONT}; font-size: 12px; color: ${COLORS.ink}; background: transparent;
          border: none; outline: none; padding: 2px 4px;
        }
        .invoice-cell-input:focus { background: ${COLORS.goldSoft}55; border-radius: 4px; }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.boneBorder}; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.graphiteLight}; }

        @media print {
          body * { visibility: hidden; }
          .invoice-print, .invoice-print * { visibility: visible; }
          .invoice-print { position: absolute; top: 0; left: 0; width: 100%; padding: 0 !important; }
          .no-print { display: none !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .due-bar, .stat-card, .order-card, .modal-pop, .modal-overlay, .btn-primary, .btn-secondary { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}