// ========================================
// Orders.jsx
// Order pipeline by ATM group: packing progress per line, an order detail
// modal, invoice generation (screen preview + PDF via InvoiceDocument),
// and an add-order form.
// ========================================

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import InvoiceDocument from "./InvoiceDocument";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, ChevronIcon, CloseIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";
import { flattenSetOrderToLines } from "../lib/manufacturingPricing";
import {
  STATION_ORDER,
  emptyStationTotals,
  stationWipTotals,
  lineSelectedAddons,
  skipMap,
  addonWipQty,
} from "../lib/productionFlow";
import AddOrderModal from "../components/orders/AddOrderModal";
import { DEFAULT_DEPARTMENTS } from "../components/orders/SetOrderBuilder";
import OrderAtmExpenses from "../components/orders/OrderAtmExpenses";
import { useAuth } from "../context/AuthContext";
import ReadOnlyBanner from "../components/auth/ReadOnlyBanner";
import {
  emptyDesignColor,
  equalSplit,
  designColorSplitError,
  buildVariantsFromDesignColors,
  designColorsFromVariants,
} from "../lib/orderDesignColor";

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

const STATION_SHORT = { Cutting: "Cut", Stitching: "Sti", Checking: "Che", Packing: "Pac" };

function aggregateStationTotals(variantIds, stationsByVariant) {
  const totals = emptyStationTotals();
  for (const vid of variantIds || []) {
    const t = stationsByVariant?.[vid] || emptyStationTotals();
    STATION_ORDER.forEach((s) => {
      totals[s] = (Number(totals[s]) || 0) + (Number(t[s]) || 0);
    });
  }
  return totals;
}

function aggregateAddonTotals(variantIds, addonsByVariant) {
  const out = {};
  for (const vid of variantIds || []) {
    const a = addonsByVariant?.[vid] || {};
    Object.entries(a).forEach(([id, qty]) => {
      out[id] = (Number(out[id]) || 0) + (Number(qty) || 0);
    });
  }
  return out;
}

/** Cut → Sti → Button → Che → Pac with WIP counts for a part (or one design). */
function PartStationFlow({ line, cumulativeTotals, addonTotals, compact = false }) {
  const skips = skipMap(line);
  const live = cumulativeTotals || emptyStationTotals();
  const wip = stationWipTotals(line, live);
  const enabled = STATION_ORDER.filter((s) => !skips[s]);
  const last = enabled[enabled.length - 1];
  const addons = lineSelectedAddons(line);
  const textSize = compact ? "text-[9.5px]" : "text-[10.5px]";
  const pad = compact ? "px-1.5 py-0.5" : "px-2 py-0.5";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {STATION_ORDER.map((s, i) => {
        const skipped = skips[s];
        const qty = Number(wip[s]) || 0;
        const finishedHere = s === last;
        const afterPills = addons.filter((a) => {
          const req = a.requiresStations || [];
          let lastReq = null;
          let lastIdx = -1;
          for (const r of req) {
            const idx = STATION_ORDER.indexOf(r);
            if (idx > lastIdx) {
              lastIdx = idx;
              lastReq = r;
            }
          }
          return lastReq === s;
        });
        return (
          <span key={s} className="inline-flex items-center gap-1">
            {i > 0 && <span className={textSize} style={{ color: COLORS.graphiteLight }}>→</span>}
            <span
              className={`${textSize} font-semibold ${pad} rounded`}
              style={{
                background: skipped ? COLORS.boneDim : finishedHere && qty > 0 ? COLORS.goldSoft : COLORS.card,
                color: skipped ? COLORS.graphiteLight : COLORS.ink,
                textDecoration: skipped ? "line-through" : "none",
                border: `1px solid ${COLORS.border}`,
              }}
              title={`${s}: ${skipped ? "skipped" : `${qty.toLocaleString()} at station`}`}
            >
              {STATION_SHORT[s]} {skipped ? "—" : qty.toLocaleString()}
            </span>
            {afterPills.map((a) => {
              const sitting = addonWipQty(a, live, addonTotals?.[a.id]);
              return (
              <span key={a.id} className="inline-flex items-center gap-1">
                <span className={textSize} style={{ color: COLORS.graphiteLight }}>→</span>
                <span
                  className={`${textSize} font-semibold ${pad} rounded`}
                  style={{
                    background: sitting > 0 ? COLORS.goldSoft : COLORS.card,
                    color: COLORS.ink,
                    border: `1px solid ${COLORS.border}`,
                  }}
                  title={`${a.name}: ${sitting.toLocaleString()} waiting (not yet ${(a.afterStation || "Checking").toLowerCase()})`}
                >
                  {a.name} {sitting.toLocaleString()}
                </span>
              </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
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
    billNo: order.bill_no || null,
    paymentStatus: order.payment_status || null,
    lines: (order.lines || []).map((line) => {
      const setMeta = line.set_order_meta || line.set_meta || null;
      return {
        orderId: line.order_line_id,
        articleId: line.article_id,
        article: line.article_name,
        articleNo: String(line.article_id),
        sizeId: line.size_id,
        size: line.dimension_name || line.size_name || setMeta?.sizeText || "—",
        dimensionId: line.dimension_id,
        dimensions: line.dimension_name || setMeta?.sizeText || "—",
        packPerCtn: line.pack_per_ctn,
        quantity: line.quantity,
        readyQuantity: (line.variants || []).reduce((s, v) => s + (Number(v.ready_quantity) || 0), 0),
        netWeight: Number(line.net_weight) || 0,
        grossWeight: Number(line.gross_weight) || 0,
        cartonSize: line.carton_size || "—",
        cbm: Number(line.cbm) || 0,
        setMeta,
        skip_cutting: Boolean(line.skip_cutting),
        skip_stitching: Boolean(line.skip_stitching),
        skip_checking: Boolean(line.skip_checking),
        skip_packing: Boolean(line.skip_packing),
        set_order_meta: setMeta,
        set_meta: setMeta,
        colors: (line.variants || []).map((v) => ({
          variantId: v.variant_id,
          design: v.variant_name || "Default",
          barcode: v.barcode || "—",
          quantity: v.quantity,
          readyQuantity: Number(v.ready_quantity) || 0,
        })),
      };
    }),
  };
}

function calcLine(line) {
  const pack = Number(line.packPerCtn) || 1;
  const reqdCtns = Math.ceil(line.quantity / pack);
  const readyCtns = Math.ceil(line.readyQuantity / pack);
  const percent = line.quantity ? Math.min(100, Math.round((line.readyQuantity / line.quantity) * 100)) : 0;
  return { ...line, reqdCtns, readyCtns, percent };
}

function setOrderKey(line) {
  const meta = line.setMeta;
  if (!meta?.setId) return null;
  if (meta.groupId) return String(meta.groupId);
  const setQty =
    meta.orderQuantity != null && meta.orderQuantity !== ""
      ? Number(meta.orderQuantity)
      : meta.quantityPerSet
        ? Math.round(line.quantity / (Number(meta.quantityPerSet) || 1))
        : line.quantity;
  const designs = (meta.designColors || []).map((d) => d.name || "").join("|");
  return `${meta.setId}::${meta.configurationId || ""}::${line.packPerCtn}::${setQty}::${designs}`;
}

function setQuantityOf(line) {
  const meta = line.setMeta;
  if (!meta) return 0;
  if (meta.orderQuantity != null && meta.orderQuantity !== "") return Number(meta.orderQuantity) || 0;
  const qps = Number(meta.quantityPerSet) || 0;
  return qps > 0 ? Math.round(line.quantity / qps) : line.quantity;
}

function partDisplayName(line) {
  const meta = line.setMeta;
  if (meta?.partName) return meta.partName;
  const setName = meta?.setName;
  if (setName && line.article?.startsWith(`${setName} · `)) {
    return line.article.slice(setName.length + 3);
  }
  return line.article;
}

/** Complete sets ready = bottleneck across parts (fewest finished set-equivalents). */
function readySetsOf(setItem) {
  if (!setItem?.lines?.length) return 0;
  let minSets = Infinity;
  for (const line of setItem.lines) {
    const qps = Number(line.setMeta?.quantityPerSet) || 1;
    const setsReady = Math.floor((Number(line.readyQuantity) || 0) / qps);
    minSets = Math.min(minSets, setsReady);
  }
  return minSets === Infinity ? 0 : minSets;
}

/** Group flattened set parts under one set card; keep standalone articles as-is. */
function groupLinesForDisplay(lines) {
  const items = [];
  const setMap = new Map();

  for (const line of lines) {
    const key = setOrderKey(line);
    if (!key) {
      items.push({ type: "article", key: `art-${line.orderId}`, line });
      continue;
    }
    let group = setMap.get(key);
    if (!group) {
      group = {
        type: "set",
        key,
        setName: line.setMeta.setName || "Set",
        configurationName: line.setMeta.sizeText || line.setMeta.configurationName || "",
        setQuantity: setQuantityOf(line),
        setSellingPerUnit: line.setMeta.setSellingPerUnit,
        packPerCtn: Number(line.packPerCtn) || 6,
        cartonSize: line.cartonSize,
        cbm: line.cbm,
        netWeight: line.netWeight,
        grossWeight: line.grossWeight,
        lines: [],
      };
      setMap.set(key, group);
      items.push(group);
    }
    group.lines.push(line);
  }

  return items.map((item) => {
    if (item.type !== "set") return item;
    const pack = Number(item.packPerCtn) || 1;
    const setQty = Number(item.setQuantity) || 0;
    const readySets = readySetsOf(item);
    const reqdCtns = Math.ceil(setQty / pack);
    const readyCtns = Math.ceil(readySets / pack);
    const percent = setQty ? Math.min(100, Math.round((readySets / setQty) * 100)) : 0;
    const totalQty = item.lines.reduce((s, l) => s + l.quantity, 0);
    const totalReady = item.lines.reduce((s, l) => s + l.readyQuantity, 0);
    return {
      ...item,
      readySets,
      reqdCtns,
      readyCtns,
      percent,
      totalQty,
      totalReady,
    };
  });
}

function calcGroup(group) {
  const lines = group.lines.map(calcLine);
  const displayItems = groupLinesForDisplay(lines);
  const totalQuantity = displayItems.reduce((sum, item) => {
    if (item.type === "set") return sum + (Number(item.setQuantity) || 0);
    return sum + (Number(item.line.quantity) || 0);
  }, 0);
  // Sets pack as one unit — count cartons once per set group, not per part
  const totalReqdCtns = displayItems.reduce((sum, item) => {
    if (item.type === "set") return sum + (Number(item.reqdCtns) || 0);
    return sum + (Number(item.line.reqdCtns) || 0);
  }, 0);
  const totalReadyCtns = displayItems.reduce((sum, item) => {
    if (item.type === "set") return sum + (Number(item.readyCtns) || 0);
    return sum + (Number(item.line.readyCtns) || 0);
  }, 0);
  const totalReady = displayItems.reduce((sum, item) => {
    if (item.type === "set") return sum + (Number(item.readySets) || 0);
    return sum + (Number(item.line.readyQuantity) || 0);
  }, 0);
  const percent = totalQuantity ? Math.min(100, Math.round((totalReady / totalQuantity) * 100)) : 0;
  return {
    ...group,
    lines,
    displayItems,
    itemCount: displayItems.length,
    totalQuantity,
    totalReady,
    totalReqdCtns,
    totalReadyCtns,
    percent,
  };
}

function statusOf(percent) {
  if (percent >= 100) return "Complete";
  if (percent > 0) return "In progress";
  return "Not started";
}

function isShipped(group) {
  return group?.paymentStatus === "shipped";
}

function isAwaitingShipment(group) {
  if (isShipped(group)) return false;
  const ps = group?.paymentStatus;
  return (
    ps === "awaiting_shipment" ||
    ps === "awaiting_payment" ||
    Boolean(group?.billNo)
  );
}

/** Packing progress status, overridden by payment lifecycle when applicable. */
function orderLifecycleStatus(group) {
  if (isShipped(group)) return "Shipped";
  if (isAwaitingShipment(group)) return "Waiting for Shipment";
  return statusOf(group.percent);
}

function statusColors(status) {
  if (status === "Shipped") return { bg: COLORS.ink, fg: COLORS.gold };
  if (status === "Complete") return { bg: COLORS.greenSoft, fg: COLORS.green };
  if (status === "In progress") return { bg: COLORS.goldSoft, fg: COLORS.goldDim };
  if (status === "Waiting for Shipment") return { bg: COLORS.goldSoft, fg: COLORS.goldDim };
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

function OrderGroupCard({ group, index, onOpen }) {
  const lifecycle = orderLifecycleStatus(group);
  const awaiting = isAwaitingShipment(group);
  const shipped = isShipped(group);
  const packStatus = statusOf(group.percent);
  const c = statusColors(lifecycle);
  return (
    <div
      className="order-card fade-in rounded-2xl p-5 cursor-pointer"
      style={{
        background: COLORS.card,
        border: `1px solid ${shipped ? COLORS.ink : COLORS.border}`,
        animationDelay: `${index * 50}ms`,
        opacity: shipped ? 0.92 : 1,
      }}
      onClick={() => onOpen(group)}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: shipped ? COLORS.ink : COLORS.boneDim, color: COLORS.goldDim }}>
            {group.atmNo}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>{group.customer}</h3>
              <StatusBadge status={lifecycle} />
              {group.billNo ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: COLORS.boneDim, color: COLORS.graphite }}>
                  {group.billNo}
                </span>
              ) : null}
            </div>
            <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              ATM {group.atmNo} · {group.itemCount ?? group.lines.length} item{(group.itemCount ?? group.lines.length) === 1 ? "" : "s"} · {group.date}
              {shipped ? " · closed" : awaiting ? " · waiting for shipment" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {shipped ? (
            <span className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: COLORS.ink, color: COLORS.gold }}>
              Order closed
            </span>
          ) : awaiting ? (
            <span className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
              Ready to ship
            </span>
          ) : packStatus === "Complete" ? (
            <span className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
              Packing complete
            </span>
          ) : null}
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

function OrderPartBody({ line, cartonMode = "own", stationTotals = {}, addonTotals = {} }) {
  // Set parts share one carton plan at set level — only show piece progress here
  const showCartons = cartonMode === "own";
  const variantIds = (line.colors || []).map((c) => c.variantId).filter(Boolean);
  const lineStations = aggregateStationTotals(variantIds, stationTotals);
  const lineAddons = aggregateAddonTotals(variantIds, addonTotals);
  const multiDesign = (line.colors || []).length > 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-5">
      <div className="lg:col-span-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.graphiteLight }}>Design / Color</div>
        <div className="flex flex-col gap-2">
          {line.colors.map((c, i) => {
            const designStations = aggregateStationTotals([c.variantId], stationTotals);
            const designAddons = aggregateAddonTotals([c.variantId], addonTotals);
            return (
              <div key={i} className="rounded-lg px-2.5 py-2" style={{ background: COLORS.bone }}>
                <div className="flex items-center justify-between text-[12px] gap-2">
                  <span style={{ color: COLORS.ink }}>{c.design}</span>
                  <span className="text-[10.5px] shrink-0" style={{ color: COLORS.graphiteLight }}>
                    packed {(c.readyQuantity || 0).toLocaleString()} / {c.quantity.toLocaleString()}
                  </span>
                </div>
                {multiDesign && (
                  <div className="mt-1.5">
                    <PartStationFlow
                      line={line}
                      cumulativeTotals={designStations}
                      addonTotals={designAddons}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="mb-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: COLORS.graphiteLight }}>
            Floor progress
          </div>
          <PartStationFlow line={line} cumulativeTotals={lineStations} addonTotals={lineAddons} />
          <p className="text-[10.5px] mt-1.5" style={{ color: COLORS.graphiteLight }}>
            Numbers are pieces sitting at each step (not yet moved on).
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatBlock label="Quantity" value={line.quantity.toLocaleString()} />
          <StatBlock label="Ready Qty" value={line.readyQuantity.toLocaleString()} />
          <StatBlock label="% Against order" value={`${line.percent}%`} highlight />
          {showCartons && (
            <>
              <StatBlock label="Pack / CTN" value={line.packPerCtn} />
              <StatBlock label="Reqd CTNS" value={line.reqdCtns.toLocaleString()} />
              <StatBlock label="Ready CTNS" value={line.readyCtns.toLocaleString()} />
              <StatBlock label="Carton numbering" value={`1 to ${line.reqdCtns}`} />
              <StatBlock label="Net / Gross wt" value={`${line.netWeight} / ${line.grossWeight} kg`} />
              <StatBlock label="Carton size / CBM" value={`${line.cartonSize} · ${line.cbm}`} />
            </>
          )}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mt-4" style={{ background: COLORS.boneDim }}>
          <div className="h-1.5 rounded-full due-bar" style={{ width: `${line.percent}%`, background: statusColors(statusOf(line.percent)).fg }} />
        </div>
      </div>
    </div>
  );
}

function ArticleLineCard({ line, stationTotals, addonTotals }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
      <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-3" style={{ background: COLORS.boneDim }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[12px] font-bold px-2 py-1 rounded" style={{ background: COLORS.ink, color: COLORS.gold }}>#{line.orderId}</span>
          <span className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>{line.article}</span>
          <span className="text-[11.5px]" style={{ color: COLORS.graphite }}>{line.size} · {line.dimensions}</span>
        </div>
        <StatusBadge status={statusOf(line.percent)} />
      </div>
      <OrderPartBody line={line} stationTotals={stationTotals} addonTotals={addonTotals} />
    </div>
  );
}

function SetOrderGroupCard({ item, index, stationTotals, addonTotals }) {
  const [open, setOpen] = useState(true);
  const status = statusOf(item.percent);
  const configLabel = item.configurationName || "—";
  const pack = Number(item.packPerCtn) || 6;
  const reqdCtns = Number(item.reqdCtns) || 0;
  const readyCtns = Number(item.readyCtns) || 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
      <div style={{ background: COLORS.boneDim }}>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-5 pt-4 pb-3 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span className="text-[12px] font-bold px-2 py-1 rounded shrink-0" style={{ background: COLORS.ink, color: COLORS.gold }}>
              {index}
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                {Number(item.setQuantity || 0).toLocaleString()}× {item.setName}
              </div>
              <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                {configLabel} · {item.lines.length} part{item.lines.length === 1 ? "" : "s"} packed together
                {item.setSellingPerUnit != null ? ` · PKR ${Math.round(Number(item.setSellingPerUnit) || 0).toLocaleString()}/set` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <StatusBadge status={status} />
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <path d="M3.5 5.5L7 9l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 pb-3">
          <StatBlock label="Sets" value={Number(item.setQuantity || 0).toLocaleString()} />
          <StatBlock label="Pack / CTN" value={pack} />
          <StatBlock label="Reqd CTNS" value={reqdCtns.toLocaleString()} />
          <StatBlock label="Carton numbering" value={reqdCtns ? `1 to ${reqdCtns}` : "—"} />
          <StatBlock label="Ready sets" value={Number(item.readySets || 0).toLocaleString()} />
          <StatBlock label="Ready CTNS" value={readyCtns.toLocaleString()} />
          <StatBlock label="% Against order" value={`${item.percent}%`} highlight />
          <StatBlock label="Net / Gross wt" value={`${item.netWeight ?? 0} / ${item.grossWeight ?? 0} kg`} />
        </div>
        <div className="px-5 pb-4">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.card }}>
            <div className="h-1.5 rounded-full due-bar" style={{ width: `${item.percent}%`, background: statusColors(status).fg }} />
          </div>
        </div>
      </div>

      {open && (
        <div className="flex flex-col" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <div className="px-5 pt-3 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>
            Parts in this set · production qty
          </div>
          {item.lines.map((line, partIdx) => (
            <div key={line.orderId} style={partIdx > 0 ? { borderTop: `1px solid ${COLORS.border}` } : undefined}>
              <div className="flex items-center justify-between flex-wrap gap-2 px-5 pt-4 pb-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
                    #{line.orderId}
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>{partDisplayName(line)}</span>
                  <span className="text-[11.5px]" style={{ color: COLORS.graphite }}>{line.dimensions}</span>
                </div>
                <StatusBadge status={statusOf(line.percent)} />
              </div>
              <OrderPartBody line={line} cartonMode="shared" stationTotals={stationTotals} addonTotals={addonTotals} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderDetailModal({ group, onClose, onEdit, onDelete, isDeleting, stationTotals = {}, addonTotals = {}, canWrite = true }) {
  const [detailTab, setDetailTab] = useState("floor");

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
    setDetailTab("floor");
  }, [group?.id, group?.order_id]);

  if (!group) return null;
  const lifecycle = orderLifecycleStatus(group);
  const shipped = isShipped(group);
  const displayItems = group.displayItems || groupLinesForDisplay(group.lines);
  const orderId = group.order_id || group.orderId || group.id;

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
              <StatusBadge status={lifecycle} />
            </div>
            <p className="text-[11.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
              ATM No {group.atmNo} · {group.date}
              {shipped ? " · shipped & closed" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canWrite && !shipped && (
              <button
                type="button"
                className="btn-secondary text-[11.5px] font-semibold px-3 py-2 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
                onClick={() => onEdit(group)}
              >
                Edit
              </button>
            )}
            {canWrite && !shipped && (
              <button
                type="button"
                className="btn-secondary text-[11.5px] font-semibold px-3 py-2 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust, cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.6 : 1 }}
                onClick={() => onDelete(group)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            )}
            <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="px-6 pt-4">
          <div
            className="segmented inline-flex rounded-xl p-1 gap-1"
            style={{ background: COLORS.boneDim }}
            role="tablist"
          >
            {[
              { id: "floor", label: "Floor" },
              { id: "expenses", label: "Expenses" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={detailTab === t.id}
                className="text-[12px] font-semibold px-4 py-1.5 rounded-lg"
                style={{
                  background: detailTab === t.id ? COLORS.inkSurface : "transparent",
                  color: detailTab === t.id ? COLORS.gold : COLORS.graphite,
                }}
                onClick={() => setDetailTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {detailTab === "expenses" ? (
            orderId ? (
              <OrderAtmExpenses orderId={Number(orderId)} />
            ) : (
              <p className="text-[12.5px]" style={{ color: COLORS.graphite }}>
                Order id missing — cannot load expenses.
              </p>
            )
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl p-4" style={{ background: COLORS.boneDim }}>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>Items</div>
                  <div className="text-[19px] font-semibold mt-1" style={{ color: COLORS.ink }}>{displayItems.length}</div>
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

              <div className="flex flex-col gap-4">
                {displayItems.map((item, idx) =>
                  item.type === "set" ? (
                    <SetOrderGroupCard
                      key={item.key}
                      item={item}
                      index={idx + 1}
                      stationTotals={stationTotals}
                      addonTotals={addonTotals}
                    />
                  ) : (
                    <ArticleLineCard
                      key={item.key}
                      line={item.line}
                      stationTotals={stationTotals}
                      addonTotals={addonTotals}
                    />
                  )
                )}
              </div>
            </>
          )}
        </div>

        {shipped ? (
          <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 flex-wrap" style={{ background: COLORS.ink, borderTop: `1px solid ${COLORS.border}` }}>
            <span className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
              Fully shipped and closed. Partial leftovers stay on this ATM until shipped.
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: COLORS.gold }}>
              Order closed
            </span>
          </div>
        ) : isAwaitingShipment(group) ? (
          <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 flex-wrap" style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
            <span className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
              Packing is at 100%+. Open Shipment to ship (full or partial) — invoice and security are created there.
            </span>
            <Link
              to="/shipment"
              className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-lg shrink-0 no-underline"
              style={{ background: COLORS.gold, color: COLORS.ink }}
            >
              Go to Shipment
            </Link>
          </div>
        ) : statusOf(group.percent) === "Complete" ? (
          <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 flex-wrap" style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
            <span className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
              Packing complete — status will move to Waiting for Shipment automatically.
            </span>
          </div>
        ) : null}
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

function uniqueDesignNames(colors, metaDesignColors) {
  const names = [];
  const seen = new Set();
  const push = (name) => {
    const n = String(name || "").trim() || "—";
    if (seen.has(n)) return;
    seen.add(n);
    names.push(n);
  };
  (metaDesignColors || []).forEach((d) => push(d?.name || d));
  (colors || []).forEach((c) => push(c.design));
  return names.length ? names : ["—"];
}

function rateFromMeta(meta) {
  if (!meta) return "";
  const candidates = [meta.orderPriceOverride, meta.setSellingPerUnit, meta.suggestedSellingPerUnit];
  for (const c of candidates) {
    if (c != null && c !== "" && !Number.isNaN(Number(c))) return String(Math.round(Number(c)));
  }
  return "";
}

/** One row per set (or article). Rate from order; qty = ordered; also tracks made. */
function buildInvoiceRows(group) {
  const lines = (group.lines || []).map((l) => (l.percent != null ? l : calcLine(l)));
  const items = group.displayItems || groupLinesForDisplay(lines);
  return items.map((item) => {
    if (item.type === "set") {
      const meta = item.lines[0]?.setMeta;
      const designLines = uniqueDesignNames(
        item.lines.flatMap((l) => l.colors || []),
        meta?.designColors
      );
      const qtyOrdered = Number(item.setQuantity) || 0;
      const qtyMade = Number(item.readySets) || 0;
      return {
        description: item.configurationName
          ? `${item.setName} · ${item.configurationName}`
          : item.setName,
        design: designLines.join("\n"),
        designLines,
        qty: String(qtyOrdered),
        qtyOrdered,
        qtyMade,
        rate: rateFromMeta({ ...meta, setSellingPerUnit: item.setSellingPerUnit ?? meta?.setSellingPerUnit }),
      };
    }
    const line = item.line;
    const designLines = uniqueDesignNames(line.colors, line.setMeta?.designColors);
    const qtyOrdered = Number(line.quantity) || 0;
    const qtyMade = Number(line.readyQuantity) || 0;
    return {
      description: `${line.article}${line.size && line.size !== "—" ? ` (${line.size})` : ""}`,
      design: designLines.join("\n"),
      designLines,
      qty: String(qtyOrdered),
      qtyOrdered,
      qtyMade,
      rate: rateFromMeta(line.setMeta),
    };
  });
}

function InvoiceModal({ group, billNo, onClose, onInvoiced }) {
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
    setRows(buildInvoiceRows(group));
  }, [group]);

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

  const subTotal = rows.reduce(
    (s, r) => s + (Number(r.qtyOrdered ?? r.qty ?? 0) || 0) * (Number(r.rate) || 0),
    0
  );

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
      onInvoiced?.(group);
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
        onInvoiced?.(group);
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
            <p className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              Rates from order · sets as one row · download or print moves order to waiting for payment
            </p>
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
                    <td className="px-1 py-1 whitespace-pre-line" style={{ border: "1px solid #000", color: "#000" }}>
                      {(row.designLines || String(row.design || "").split("\n")).join("\n")}
                    </td>
                    <td className="px-2 py-1.5 text-right" style={{ border: "1px solid #000", color: "#000" }}>
                      <div className="font-medium">{Number(row.qtyOrdered ?? row.qty ?? 0).toLocaleString()}</div>
                      <div className="text-[10px]" style={{ color: "#444" }}>
                        Order {Number(row.qtyOrdered ?? row.qty ?? 0).toLocaleString()}
                        {" · "}Made {Number(row.qtyMade || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-1 py-1" style={{ border: "1px solid #000", color: "#000" }}>
                      <input className="invoice-cell-input text-right" placeholder="0" value={row.rate} onChange={(e) => updateRow(i, "rate", e.target.value)} />
                    </td>
                    <td className="text-right px-3 py-1.5 font-medium" style={{ border: "1px solid #000", color: "#000" }}>
                      {((Number(row.qtyOrdered ?? row.qty ?? 0)) * (Number(row.rate) || 0)).toLocaleString()}
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
          Creating an invoice keeps the order and moves it to Waiting for Shipment. You can recreate the invoice anytime.
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
    sizeText: "",
    orderPriceOverride: "",
    packPerCtn: 6,
    quantity: "",
    netWeight: "",
    grossWeight: "",
    cartonSize: "",
    cbm: "",
    departments: { ...DEFAULT_DEPARTMENTS },
    splitMode: "equal",
    designColors: [],
    addonIds: [],
  };
}

function snapshotAddonsForArticle(article, addonIds) {
  const ids = Array.isArray(addonIds) ? addonIds : [];
  return (article?.addons || [])
    .filter((a) => ids.includes(a.addon_id || a.id))
    .map((a) => ({
      id: a.addon_id || a.id,
      name: a.addon_name || a.name,
      addonRate: Number(a.addon_rate ?? a.addonRate) || 0,
      requiresStations: a.requires_stations || a.requiresStations || ["Cutting", "Stitching"],
      afterStation: a.after_station || a.afterStation || "Checking",
      sellingPrice: a.extra_selling_price ?? a.sellingPrice ?? null,
    }));
}

function departmentsFromApiLine(l) {
  const meta = l.set_order_meta || l.set_meta;
  if (meta?.departments) return { ...DEFAULT_DEPARTMENTS, ...meta.departments };
  return {
    cutting: !l.skip_cutting,
    stitching: !l.skip_stitching,
    checking: !l.skip_checking,
    packing: !l.skip_packing,
  };
}

function skipsFromDepartments(departments) {
  const d = { ...DEFAULT_DEPARTMENTS, ...(departments || {}) };
  return {
    skip_cutting: !d.cutting,
    skip_stitching: !d.stitching,
    skip_checking: !d.checking,
    skip_packing: !d.packing,
  };
}

/** Rebuild set-builder blocks from saved set order lines (for edit). */
function setBlocksFromOrder(order, sets) {
  const setLines = (order?.lines || []).filter((l) => (l.set_order_meta || l.set_meta)?.setId);
  if (!setLines.length) return [];

  const groups = new Map();
  for (const line of setLines) {
    const meta = line.set_order_meta || line.set_meta;
    const setQty =
      meta.orderQuantity != null && meta.orderQuantity !== ""
        ? Number(meta.orderQuantity)
        : meta.quantityPerSet
          ? Math.round(line.quantity / (Number(meta.quantityPerSet) || 1))
          : line.quantity;
    const designs = (meta.designColors || []).map((d) => d.name || "").join("|");
    const key =
      meta.groupId ||
      `${meta.setId}::${meta.configurationId || ""}::${line.pack_per_ctn}::${setQty}::${designs}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }

  return [...groups.entries()].map(([key, groupLines]) => {
    const first = groupLines[0];
    const meta = first.set_order_meta || first.set_meta || {};
    const qps = Number(meta.quantityPerSet) || 1;
    const setQty =
      meta.orderQuantity != null && meta.orderQuantity !== ""
        ? Number(meta.orderQuantity)
        : Math.round(first.quantity / qps);

    const fromVar = designColorsFromVariants(first.variants || []);
    const splitMode = meta.splitMode || fromVar.splitMode || "equal";
    let designColors = [];
    if ((meta.designColors || []).length) {
      designColors = meta.designColors.map((dc) => {
        const match = fromVar.designColors.find((v) => v.id === dc.id || v.name === dc.name);
        const pieceQty = match ? Number(match.quantity) || 0 : 0;
        const namedCount = (meta.designColors || []).filter((d) => d.name?.trim()).length;
        return {
          id: dc.id || match?.id || emptyDesignColor().id,
          name: dc.name || "",
          barcode: dc.barcode || match?.barcode || "",
          quantity:
            splitMode === "custom" && namedCount > 1
              ? String(Math.round(pieceQty / qps) || "")
              : dc.quantity != null && dc.quantity !== ""
                ? String(dc.quantity)
                : "",
        };
      });
    } else {
      designColors = fromVar.designColors.map((dc) => ({
        ...dc,
        quantity: String(Math.round((Number(dc.quantity) || 0) / qps) || ""),
      }));
    }

    const override = meta.orderPriceOverride;

    return {
      key: meta.groupId || key,
      setId: meta.setId || "",
      sizeText: meta.sizeText || meta.configurationName || first.dimension_name || "",
      orderQuantity: setQty || 1,
      packPerCtn: first.pack_per_ctn || 6,
      orderPriceOverride: override != null && override !== "" ? String(override) : "",
      splitMode,
      designColors,
      departments: departmentsFromApiLine(first),
      parts: groupLines.map((l) => {
        const m = l.set_order_meta || l.set_meta || {};
        const setArticleId =
          m.setArticleId ||
          (String(l.article_id).includes(":") ? String(l.article_id).split(":").slice(1).join(":") : "");
        return {
          setArticleId,
          quantityPerSet: Number(m.quantityPerSet) || 1,
          addonIds: [...(m.addonIds || [])],
          sizeNote: m.sizeNote || "",
        };
      }),
      expanded: true,
    };
  });
}
function emptyDraft() {
  return { atmNo: "", customer: "", date: "", lines: [emptyLine()] };
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

function lineSplitError(line) {
  return designColorSplitError(line.designColors, line.splitMode, line.quantity);
}

function buildVariantsFromLine(line) {
  return buildVariantsFromDesignColors(line.designColors, line.splitMode, line.quantity);
}

function draftFromOrder(order) {
  // Set parts belong in the Set order tab — only keep standalone article lines here
  const articleLines = (order.lines || [])
    .filter((l) => !(l.set_order_meta || l.set_meta)?.setId)
    .map((l) => {
      const { designColors, splitMode } = designColorsFromVariants(l.variants);
      const meta = l.set_order_meta || l.set_meta || {};
      return {
        articleId: l.article_id,
        sizeId: l.size_id,
        dimensionId: null,
        sizeText: meta.sizeText || l.dimension_name || "",
        orderPriceOverride:
          meta.orderPriceOverride != null && meta.orderPriceOverride !== ""
            ? String(meta.orderPriceOverride)
            : "",
        packPerCtn: l.pack_per_ctn,
        quantity: String(l.quantity),
        netWeight: l.net_weight == null ? "" : String(l.net_weight),
        grossWeight: l.gross_weight == null ? "" : String(l.gross_weight),
        cartonSize: l.carton_size || "",
        cbm: l.cbm == null ? "" : String(l.cbm),
        departments: departmentsFromApiLine(l),
        splitMode,
        designColors,
        addonIds: Array.isArray(meta.addonIds)
          ? [...meta.addonIds]
          : Array.isArray(meta.addons)
            ? meta.addons.map((a) => a.id)
            : [],
        cutting_rate: l.cutting_rate,
        stitching_rate: l.stitching_rate,
        checking_rate: l.checking_rate,
        packing_rate: l.packing_rate,
        articleLabel: l.article_name,
        dimensionLabel: meta.sizeText || l.dimension_name,
      };
    });

  return {
    atmNo: order.atm_no,
    customer: order.customer,
    date: order.order_date ? String(order.order_date).slice(0, 10) : todayISO(),
    lines: articleLines.length ? articleLines : [emptyLine()],
  };
}

function setPayloadsToDraftLines(payloads) {
  return (payloads || []).flatMap(({ set, setOrder }) => {
    if (!set || !setOrder) return [];
    const flattened = flattenSetOrderToLines(set, setOrder, setOrder.packPerCtn || 6);
    const departments = { ...DEFAULT_DEPARTMENTS, ...(setOrder.departments || {}) };
    return flattened.map((line) => {
      const { designColors, splitMode } = designColorsFromVariants(line.variants);
      return {
        articleId: line.article_id,
        sizeId: null,
        dimensionId: line.dimension_id,
        packPerCtn: line.pack_per_ctn,
        quantity: String(line.quantity),
        netWeight: line.net_weight != null ? String(line.net_weight) : "",
        grossWeight: line.gross_weight != null ? String(line.gross_weight) : "",
        cartonSize: line.carton_size || "",
        cbm: line.cbm != null ? String(line.cbm) : "",
        departments,
        splitMode,
        designColors,
        cutting_rate: line.cutting_rate,
        stitching_rate: line.stitching_rate,
        checking_rate: line.checking_rate,
        packing_rate: line.packing_rate,
        setOrderMeta: line.set_order_meta,
        articleLabel: line.article_name,
        dimensionLabel: line.dimension_name,
      };
    });
  });
}

function draftLineToApiLine(l, articles) {
  const qty = Number(l.quantity) || 0;
  const skips = skipsFromDepartments(l.departments);
  const article = articles.find((a) => a.article_id === l.articleId) || null;
  const addonIds = Array.isArray(l.addonIds) ? l.addonIds : [];
  const addonSnapshots = snapshotAddonsForArticle(article, addonIds);
  const sizeText = (l.sizeText || l.dimensionLabel || "").trim();
  const orderPriceOverride =
    l.orderPriceOverride !== "" && l.orderPriceOverride != null
      ? Number(l.orderPriceOverride) || 0
      : null;

  // Set lines keep full set meta; standalone articles store size + price + add-ons
  let set_order_meta = null;
  if (l.setOrderMeta) {
    set_order_meta = {
      ...l.setOrderMeta,
      departments: { ...DEFAULT_DEPARTMENTS, ...(l.departments || l.setOrderMeta.departments || {}) },
    };
  } else {
    set_order_meta = {
      addonIds,
      addons: addonSnapshots,
      departments: { ...DEFAULT_DEPARTMENTS, ...(l.departments || {}) },
      ...(sizeText ? { sizeText } : {}),
      ...(orderPriceOverride != null ? { orderPriceOverride } : {}),
    };
  }

  return {
    article_id: l.articleId,
    article_name: l.articleLabel || article?.article_name || String(l.articleId),
    size_id: null,
    size_name: null,
    dimension_id: null,
    dimension_name: sizeText || null,
    quantity: qty,
    pack_per_ctn: Number(l.packPerCtn) || 1,
    net_weight: l.netWeight === "" ? null : Number(l.netWeight),
    gross_weight: l.grossWeight === "" ? null : Number(l.grossWeight),
    carton_size: l.cartonSize.trim() || null,
    cbm: l.cbm === "" ? null : Number(l.cbm),
    ...skips,
    cutting_rate: l.cutting_rate,
    stitching_rate: l.stitching_rate,
    checking_rate: l.checking_rate,
    packing_rate: l.packing_rate,
    variants: buildVariantsFromLine(l),
    set_order_meta,
  };
}

export default function OrdersPage() {
  const { canWrite } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [orders, setOrders] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stationTotals, setStationTotals] = useState({});
  const [addonTotals, setAddonTotals] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openGroupId, setOpenGroupId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [saveOrderError, setSaveOrderError] = useState("");
  const [deletingOrderId, setDeletingOrderId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError("");
      try {
        const [ordersRes, articlesRes, totalsRes] = await Promise.all([
          apiFetch("/api/orders"),
          apiFetch("/api/articles"),
          apiFetch("/api/production/station-totals"),
        ]);
        if (!ordersRes.ok) throw new Error(await readApiError(ordersRes, "Failed to load orders"));
        if (!articlesRes.ok) throw new Error(await readApiError(articlesRes, "Failed to load articles"));
        const [ordersData, articlesData] = await Promise.all([
          ordersRes.json(),
          articlesRes.json(),
        ]);
        if (cancelled) return;
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setArticles(Array.isArray(articlesData) ? articlesData : []);
        if (totalsRes.ok) {
          const totalsData = await totalsRes.json();
          if (totalsData?.stations && typeof totalsData.stations === "object") {
            setStationTotals(totalsData.stations);
            setAddonTotals(totalsData.addons || {});
          } else {
            const { stations: _s, addons: a, ...rest } = totalsData || {};
            setStationTotals(rest);
            setAddonTotals(a || {});
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(err.message || "Could not load orders");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const refreshStationTotals = async () => {
    try {
      const totalsRes = await apiFetch("/api/production/station-totals");
      if (!totalsRes.ok) return;
      const totalsData = await totalsRes.json();
      if (totalsData?.stations && typeof totalsData.stations === "object") {
        setStationTotals(totalsData.stations);
        setAddonTotals(totalsData.addons || {});
      } else {
        const { stations: _s, addons: a, ...rest } = totalsData || {};
        setStationTotals(rest);
        setAddonTotals(a || {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (openGroupId) refreshStationTotals();
  }, [openGroupId]);

  const orderGroups = useMemo(() => orders.map((o) => calcGroup(transformOrder(o))), [orders]);
  const openGroup = useMemo(() => orderGroups.find((g) => g.id === openGroupId) || null, [orderGroups, openGroupId]);

  function handleStartEdit(group) {
    if (isShipped(group)) return;
    const rawOrder = orders.find((o) => o.order_id === group.id);
    if (!rawOrder) return;
    setSaveOrderError("");
    setEditingOrder(rawOrder);
    setShowAddModal(true);
    setOpenGroupId(null);
  }

  async function handleSaveOrder(payload) {
    setIsSavingOrder(true);
    setSaveOrderError("");
    const isEdit = Boolean(editingOrder);
    try {
      const res = await apiFetch(isEdit ? `/api/orders/${editingOrder.order_id}` : "/api/orders", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSaveOrderError(await readApiError(res, "Failed to save order"));
        return;
      }
      const saved = await res.json();
      setOrders((prev) => {
        const exists = prev.some((o) => o.order_id === saved.order_id);
        if (exists) return prev.map((o) => (o.order_id === saved.order_id ? saved : o));
        return [saved, ...prev];
      });
      setShowAddModal(false);
      setEditingOrder(null);
    } catch (err) {
      console.error(err);
      setSaveOrderError("Could not reach the server");
    } finally {
      setIsSavingOrder(false);
    }
  }

  async function handleDeleteOrder(group) {
    if (!window.confirm(`Delete order ATM ${group.atmNo} (${group.customer})?`)) return;
    try {
      const res = await apiFetch(`/api/orders/${group.id}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert(await readApiError(res, "Failed to delete order"));
        return;
      }
      setOrders((prev) => prev.filter((order) => order.order_id !== group.id));
      setOpenGroupId(null);
    } catch (err) {
      console.error(err);
      window.alert("Could not reach the server");
    }
  }

  const filtered = useMemo(() => {
    return orderGroups
      .filter((g) => {
        // Closed/shipped only when filter is "Shipped" — hidden from All statuses
        if (statusFilter === "All statuses") return !isShipped(g);
        if (statusFilter === "Shipped") return isShipped(g);
        if (statusFilter === "Waiting for Shipment") return isAwaitingShipment(g);
        if (isShipped(g) || isAwaitingShipment(g)) return false;
        return statusOf(g.percent) === statusFilter;
      })
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
            {canWrite ? (
              <button type="button" className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={() => { setSaveOrderError(""); setEditingOrder(null); setShowAddModal(true); }}>
                <PlusIcon /> <span className="hidden xs:inline">New order</span>
              </button>
            ) : null}
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: COLORS.ink, color: COLORS.gold, border: `2px solid ${COLORS.goldSoft}` }}>
              A
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          <ReadOnlyBanner />
          {loadError && (
            <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>{loadError}</div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<OrdersStatIcon />} label="ATM orders" value={totalOrders} sub="active on the floor" />
            <MiniStat index={1} icon={<SetsIcon />} label="Total sets" value={totalSets.toLocaleString()} sub="across all orders" />
            <MiniStat index={2} icon={<BoxIcon />} label="Cartons ready" value={`${readyCartons.toLocaleString()} / ${totalCartons.toLocaleString()}`} sub="packed vs required" />
            <MiniStat
              index={3}
              icon={<ProgressIcon />}
              label="Waiting shipment"
              value={orderGroups.filter((g) => isAwaitingShipment(g)).length}
              sub={`${orderGroups.filter((g) => statusOf(g.percent) === "In progress" && !isAwaitingShipment(g)).length} in progress`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="search-wrap">
              <SearchIcon />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, ATM no, order #" style={{ width: 260 }} />
            </div>
            <div className="select-wrap">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {["All statuses", "Not started", "In progress", "Complete", "Waiting for Shipment", "Shipped"].map((opt) => (
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

      {openGroup && (
        <OrderDetailModal
          group={openGroup}
          stationTotals={stationTotals}
          addonTotals={addonTotals}
          onClose={() => setOpenGroupId(null)}
          onEdit={handleStartEdit}
          onDelete={handleDeleteOrder}
          isDeleting={deletingOrderId === openGroup.id}
          canWrite={canWrite}
        />
      )}
      {canWrite && showAddModal && (
        <AddOrderModal
          articles={articles}
          editingOrder={editingOrder}
          onClose={() => { setShowAddModal(false); setEditingOrder(null); }}
          onSave={handleSaveOrder}
          isSaving={isSavingOrder}
          error={saveOrderError}
        />
      )}


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