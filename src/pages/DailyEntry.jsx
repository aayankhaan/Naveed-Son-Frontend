// ========================================
// DailyEntry.jsx
// Floor board + per-employee add data.
// Pick a Karachi date: empty → add form; has data → locked batch.
// ========================================

import { useState, useMemo, useEffect, Fragment, useCallback } from "react";
import { FONT, COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";
import {
  STATION_ORDER,
  skipMap,
  previousStation,
  emptyStationTotals,
  liveStationTotals,
  liveAddonTotals,
  availableForStation,
  availableForAddon,
  describePipelineStatus,
  stationWipTotals,
  lineSelectedAddons,
  findLineAddon,
  addonsForStation,
  addonWorkStation,
  buildSetPackContext,
  completeSetsReadyForPack,
  qtyPerSetOf,
  setGroupKey,
  availableSetPackSets,
  setPackCatchUpNeeds,
  lineSetMeta,
  partNameOf,
  addonWipQty,
} from "../lib/productionFlow";
import {
  karachiTodayISO,
  formatKarachiDMY,
  toIsoDateOnly,
  catchUpWindow,
  missingDaysInWindow,
  addDaysISO,
} from "../lib/karachiDate";

const STATION_COLORS = {
  Cutting: COLORS.graphiteLight,
  Stitching: COLORS.gold,
  Checking: COLORS.goldDim,
  Packing: COLORS.green,
};

const STATION_SHORT = { Cutting: "Cut", Stitching: "Sti", Checking: "Che", Packing: "Pac" };
const LOOKBACK_DAYS = 31;

function initials(name) {
  if (!name) return "E";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function emptyEntry() {
  return {
    orderId: null,
    orderLineId: null,
    variantId: null,
    addonId: null,
    qty: "",
    defects: "",
    packItemKey: null,
    setGroupKey: null,
  };
}

/** Packing picker: one option per set + standalone articles. */
function buildPackItems(order) {
  const lines = order?.lines || [];
  const items = [];
  const seen = new Set();
  for (const line of lines) {
    const gk = setGroupKey(line);
    if (gk) {
      if (seen.has(gk)) continue;
      seen.add(gk);
      const groupLines = lines.filter((l) => setGroupKey(l) === gk);
      const meta = lineSetMeta(line) || {};
      const size = meta.measurement || meta.sizeText || meta.sizeName || line.dimension_name || "";
      const material = meta.materialName || "";
      const title = meta.setName || [meta.articleName, meta.typeName].filter(Boolean).join(" · ") || "Set";
      const bits = [title, material, size].filter(Boolean);
      items.push({
        type: "set",
        key: `set:${gk}`,
        groupKey: gk,
        lines: groupLines,
        primaryLine: groupLines[0],
        label: bits.join(" · "),
        setName: title,
        setPackingRate:
          meta.setPackingRate != null
            ? Number(meta.setPackingRate) || 0
            : setPackRatePerSet(groupLines),
      });
    } else if (!skipMap(line).Packing) {
      const meta = lineSetMeta(line) || {};
      const size = meta.measurement || meta.sizeText || line.dimension_name || "";
      const material = meta.materialName || "";
      const title = line.article_name || meta.typeName || "Item";
      items.push({
        type: "article",
        key: `art:${line.order_line_id}`,
        line,
        label: [title, material, size].filter(Boolean).join(" · "),
      });
    }
  }
  return items;
}

function packItemFromEntry(order, entry) {
  if (!order || !entry) return null;
  const items = buildPackItems(order);
  if (entry.packItemKey) {
    return items.find((i) => i.key === entry.packItemKey) || null;
  }
  if (entry.setGroupKey) {
    return items.find((i) => i.type === "set" && i.groupKey === entry.setGroupKey) || null;
  }
  if (entry.orderLineId) {
    const line = (order.lines || []).find((l) => l.order_line_id === Number(entry.orderLineId));
    const gk = line ? setGroupKey(line) : null;
    if (gk) return items.find((i) => i.type === "set" && i.groupKey === gk) || null;
    return items.find((i) => i.type === "article" && i.line.order_line_id === Number(entry.orderLineId)) || null;
  }
  return null;
}

function designNameFromVariant(line, variantId) {
  const v = (line?.variants || []).find((x) => x.variant_id === variantId);
  return String(v?.variant_name || "Default").trim() || "Default";
}

function matchVariantByDesign(line, designName) {
  const name = String(designName || "Default").trim() || "Default";
  const vars = line?.variants || [];
  return vars.find((v) => String(v.variant_name || "Default").trim() === name) || vars[0] || null;
}

/** Rate paid per complete set packed (prefer setPackingRate snapshot; else legacy sum). */
function setPackRatePerSet(groupLines) {
  const first = (groupLines || [])[0];
  const meta = first?.set_order_meta || first?.set_meta || {};
  if (meta.setPackingRate != null && meta.setPackingRate !== "") {
    return Number(meta.setPackingRate) || 0;
  }
  if (meta.packingRate != null && meta.packingRate !== "") {
    return Number(meta.packingRate) || 0;
  }
  return (groupLines || []).reduce((sum, l) => {
    return sum + (Number(l.packing_rate) || 0) * qtyPerSetOf(l);
  }, 0);
}

function emptyDraft(targetDate) {
  return {
    targetDate: targetDate || karachiTodayISO(),
    isLeave: false,
    addingMore: false,
    entries: [emptyEntry()],
  };
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

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L1.5 5 8 8.5 14.5 5 8 1.5zM1.5 8L8 11.5 14.5 8M1.5 11L8 14.5 14.5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BanknoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8.25" r="2" stroke="currentColor" strokeWidth="1.2" />
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

function stationRate(line, station) {
  if (!line) return 0;
  if (station === "Packing") {
    const meta = line.set_order_meta || line.set_meta || {};
    // Single-piece / display: prefer explicit set packing when present without multi-part group
    if (meta.setPackingRate != null && meta.setPackingRate !== "" && !meta.setId) {
      return Number(meta.setPackingRate) || 0;
    }
  }
  const map = {
    Cutting: line.cutting_rate,
    Stitching: line.stitching_rate,
    Checking: line.checking_rate,
    Packing: line.packing_rate,
  };
  return Number(map[station]) || 0;
}

function entryRate(line, station, addonId) {
  if (addonId) {
    const ad = findLineAddon(line, addonId);
    return Number(ad?.addonRate) || 0;
  }
  return stationRate(line, station);
}

function clampQtyToHeadroom(raw, headroom) {
  if (raw === "" || raw == null) return "";
  let n = Number(raw);
  if (Number.isNaN(n) || n < 0) return "0";
  if (headroom != null) {
    if (headroom <= 0) return "";
    n = Math.min(n, headroom);
  }
  return String(n);
}

function StationPills({ line, totals, orderQty, addonTotals }) {
  const skips = skipMap(line);
  const live = totals || emptyStationTotals();
  const wip = stationWipTotals(line, live);
  const enabled = STATION_ORDER.filter((s) => !skips[s]);
  const last = enabled[enabled.length - 1];
  const addons = lineSelectedAddons(line);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {STATION_ORDER.map((s, i) => {
        const skipped = skips[s];
        const qty = Number(wip[s]) || 0;
        const finishedHere = s === last;
        const over = !skipped && finishedHere && (Number(live[s]) || 0) > (Number(orderQty) || 0);
        const afterPills = addons.filter((a) => addonWorkStation(a) === s);
        return (
          <Fragment key={s}>
            {i > 0 && <span className="text-[10px]" style={{ color: COLORS.graphiteLight }}>→</span>}
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{
                background: skipped ? COLORS.boneDim : over ? COLORS.goldSoft : COLORS.card,
                color: skipped ? COLORS.graphiteLight : COLORS.ink,
                textDecoration: skipped ? "line-through" : "none",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {STATION_SHORT[s]} {skipped ? "—" : qty.toLocaleString()}
            </span>
            {afterPills.map((a) => {
              const sitting = addonWipQty(a, live, addonTotals?.[a.id]);
              return (
              <Fragment key={a.id}>
                <span className="text-[10px]" style={{ color: COLORS.graphiteLight }}>→</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{
                    background: sitting > 0 ? COLORS.goldSoft : COLORS.card,
                    color: COLORS.ink,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  {a.name} {sitting.toLocaleString()}
                </span>
              </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

function formContributionByVariant(employees, rowsState, orders = [], histTotals = {}) {
  const map = {};
  const orderMap = {};
  (orders || []).forEach((o) => {
    orderMap[o.order_id] = o;
  });

  (employees || []).forEach((emp) => {
    const row = rowsState?.[emp.id];
    if (!row || row.isLeave) return;
    row.entries.forEach((entry) => {
      if (!entry.variantId || entry.addonId) return;
      const qty = Number(entry.qty) || 0;
      if (qty <= 0) return;

      // Packing a set: qty is complete sets — catch up every part (leaders may need 0)
      if (emp.station === "Packing") {
        const order = orderMap[Number(entry.orderId)];
        const primary = (order?.lines || []).find((l) => l.order_line_id === Number(entry.orderLineId));
        const gk = entry.setGroupKey || (primary ? setGroupKey(primary) : null);
        if (gk && primary) {
          const design = designNameFromVariant(primary, entry.variantId);
          const groupLines = (order?.lines || []).filter((l) => setGroupKey(l) === gk);
          const siblings = [];
          for (const gl of groupLines) {
            const mv = matchVariantByDesign(gl, design);
            if (!mv) continue;
            siblings.push({
              line: gl,
              variantId: mv.variant_id,
              qtyPerSet: qtyPerSetOf(gl),
              partName: partNameOf(gl),
            });
          }
          if (siblings.length >= 2) {
            const needs = setPackCatchUpNeeds(siblings, qty, histTotals);
            for (const n of needs) {
              if (n.need <= 0) continue;
              if (!map[n.variantId]) map[n.variantId] = emptyStationTotals();
              map[n.variantId].Packing = (Number(map[n.variantId].Packing) || 0) + n.need;
            }
            return;
          }
        }
      }

      if (!map[entry.variantId]) map[entry.variantId] = emptyStationTotals();
      map[entry.variantId][emp.station] =
        (Number(map[entry.variantId][emp.station]) || 0) + qty;
    });
  });
  return map;
}

function formAddonContributionByVariant(employees, rowsState) {
  const map = {};
  (employees || []).forEach((emp) => {
    const row = rowsState?.[emp.id];
    if (!row || row.isLeave) return;
    row.entries.forEach((entry) => {
      if (!entry.variantId || !entry.addonId) return;
      const qty = Number(entry.qty) || 0;
      if (qty <= 0) return;
      if (!map[entry.variantId]) map[entry.variantId] = {};
      map[entry.variantId][entry.addonId] =
        (Number(map[entry.variantId][entry.addonId]) || 0) + qty;
    });
  });
  return map;
}

function FloorBoard({ orders, totalsForVariant, addonTotalsForVariant, onPick }) {
  const cards = useMemo(() => {
    return (orders || []).map((order) => {
      const parts = (order.lines || []).flatMap((line) =>
        (line.variants || []).map((v) => {
          const totals = totalsForVariant(v.variant_id);
          const addonTotals = addonTotalsForVariant?.(v.variant_id) || {};
          return {
            key: `${line.order_line_id}-${v.variant_id}`,
            orderId: order.order_id,
            orderLineId: line.order_line_id,
            variantId: v.variant_id,
            line,
            variant: v,
            totals,
            status: describePipelineStatus(line, totals, addonTotals),
          };
        })
      );
      return { order, parts };
    }).filter((c) => c.parts.length);
  }, [orders, totalsForVariant, addonTotalsForVariant]);

  if (!cards.length) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
        <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>No open ATM orders yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map(({ order, parts }) => (
        <div key={order.order_id} className="rounded-2xl overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: COLORS.boneDim, borderBottom: `1px solid ${COLORS.border}` }}>
            <div>
              <div className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>
                ATM {order.atm_no} · {order.customer}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                {parts.length} part{parts.length === 1 ? "" : "s"} on the floor
              </div>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {parts.map((p) => (
              <button
                key={p.key}
                type="button"
                className="w-full text-left px-4 py-3 hover:brightness-[0.99] transition"
                style={{ background: COLORS.card }}
                onClick={() => onPick?.(p)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>
                      {p.line.article_name}
                      {p.line.dimension_name ? ` · ${p.line.dimension_name}` : ""}
                    </div>
                    <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphite }}>
                      {p.variant.variant_name} · order {Number(p.variant.quantity || 0).toLocaleString()} pcs
                    </div>
                  </div>
                  <div className="text-[11.5px] font-semibold text-right" style={{ color: COLORS.goldDim }}>
                    {p.status}
                  </div>
                </div>
                <StationPills line={p.line} totals={p.totals} orderQty={p.variant.quantity} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LockedBatch({ date, day }) {
  const unitWord = (day.lines || []).some((ln) => ln.unit_label === "sets") ? "units" : "pcs";
  return (
    <div className="rounded-xl px-3 py-3 space-y-2" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>
          {formatKarachiDMY(date)}
          {day.status === "leave" ? (
            <span className="font-normal" style={{ color: COLORS.rust }}> · no work / leave</span>
          ) : (
            <span className="font-normal" style={{ color: COLORS.graphite }}>
              {" "}· {Number(day.qty || 0).toLocaleString()} {unitWord}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>
          This batch is locked
        </span>
      </div>
      {day.status === "work" && (day.lines || []).map((ln) => (
        <div key={ln.log_id} className="text-[11.5px]" style={{ color: COLORS.graphite }}>
          {(ln.atm_no ? `ATM ${ln.atm_no}` : "ATM")}
          {ln.article_name ? ` · ${ln.article_name}` : ""}
          {ln.variant_name ? ` · ${ln.variant_name}` : ""}
          {ln.addon_id ? " · add-on" : ln.station ? ` · ${ln.station}` : ""}
          {" · "}
          {Number(ln.quantity || 0).toLocaleString()} {ln.unit_label === "sets" ? "set" : "pcs"}
          {ln.unit_label === "sets" && Number(ln.quantity) !== 1 ? "s" : ""}
          {ln.defects ? ` · ${ln.defects} def` : ""}
        </div>
      ))}
      <p className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
        Saved · locked (editing would break stock). You can still add more below.
      </p>
    </div>
  );
}

export default function DailyEntryPage() {
  const karachiToday = karachiTodayISO();
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("All stations");
  const [activeEmpId, setActiveEmpId] = useState(null);
  const [floorPick, setFloorPick] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fullTotals, setFullTotals] = useState({});
  const [fullAddonTotals, setFullAddonTotals] = useState({});
  /** EMP-id → { dates: { ISO: { status, qty, lines } } } */
  const [employeeDays, setEmployeeDays] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [rows, setRows] = useState({});

  const refreshFullTotals = useCallback(async () => {
    try {
      const res = await apiFetch("/api/production/station-totals");
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.stations && typeof data.stations === "object") {
        setFullTotals(data.stations);
        setFullAddonTotals(data.addons || {});
      } else {
        // legacy shape: flat variant → stations
        const { stations: _s, addons: a, ...rest } = data || {};
        setFullTotals(rest);
        setFullAddonTotals(a || {});
      }
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  const loadEmployeeDays = useCallback(async (emps, { keepDrafts = false } = {}) => {
    const today = karachiTodayISO();
    let from = addDaysISO(today, -(LOOKBACK_DAYS - 1));
    for (const emp of emps) {
      if (emp.joiningDate && emp.joiningDate > from && emp.joiningDate <= today) {
        // keep from as lookback; joining only clamps min date on picker
      }
      if (emp.joiningDate && emp.joiningDate < from) {
        /* lookback wins for API range */
      }
    }
    const res = await apiFetch(`/api/production/employee-days?from=${from}&to=${today}`);
    if (!res.ok) throw new Error(await readApiError(res, "Failed to load employee days"));
    const data = await res.json();

    const map = {};
    emps.forEach((emp) => {
      map[emp.id] = { dates: {} };
    });
    (Array.isArray(data) ? data : []).forEach((row) => {
      const id = `EMP-${row.employee_id}`;
      map[id] = { dates: row.dates || {} };
    });
    setEmployeeDays(map);

    if (!keepDrafts) {
      setRows((prev) => {
        const next = {};
        emps.forEach((emp) => {
          const prevDate = prev[emp.id]?.targetDate;
          const date =
            prevDate && prevDate <= today && (!emp.joiningDate || prevDate >= emp.joiningDate)
              ? prevDate
              : today;
          next[emp.id] = emptyDraft(date);
        });
        return next;
      });
    }
    return map;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBase() {
      setLoading(true);
      setLoadError("");
      try {
        const [empRes, ordRes] = await Promise.all([
          apiFetch("/api/employees"),
          apiFetch("/api/orders"),
        ]);
        if (!empRes.ok) throw new Error(await readApiError(empRes, "Failed to load employees"));
        if (!ordRes.ok) throw new Error(await readApiError(ordRes, "Failed to load orders"));
        const [empData, ordData] = await Promise.all([empRes.json(), ordRes.json()]);
        if (cancelled) return;
        const today = karachiTodayISO();
        const emps = (Array.isArray(empData) ? empData : [])
          .filter((e) => String(e.station || "").trim().toLowerCase() !== "management")
          .map((e) => ({
          id: `EMP-${e.e_id}`,
          numericId: e.e_id,
          name: e.full_name,
          station: e.station || "Stitching",
          image: e.image_link,
          joiningDate: toIsoDateOnly(e.joining_date) || null,
        }));
        setEmployees(emps);
        // Shipped orders are closed — no further daily production on them
        setOrders(
          (Array.isArray(ordData) ? ordData : []).filter((o) => o.payment_status !== "shipped")
        );
        const blank = {};
        emps.forEach((emp) => {
          blank[emp.id] = emptyDraft(today);
        });
        setRows(blank);
        await Promise.all([refreshFullTotals(), loadEmployeeDays(emps)]);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(err.message || "Could not load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBase();
    return () => { cancelled = true; };
  }, [refreshFullTotals, loadEmployeeDays]);

  const orderById = (id) => orders.find((o) => o.order_id === Number(id)) || null;

  const formByVariant = useMemo(
    () => formContributionByVariant(employees, rows, orders, fullTotals),
    [employees, rows, orders, fullTotals]
  );
  const formAddonByVariant = useMemo(
    () => formAddonContributionByVariant(employees, rows),
    [employees, rows]
  );

  const totalsForVariant = useCallback(
    (variantId) => liveStationTotals(fullTotals[variantId], formByVariant[variantId]),
    [fullTotals, formByVariant]
  );
  const addonTotalsForVariant = useCallback(
    (variantId) => liveAddonTotals(fullAddonTotals[variantId], formAddonByVariant[variantId]),
    [fullAddonTotals, formAddonByVariant]
  );

  /** Live station totals map for all variants (history + today's form). */
  const allLiveTotalsByVariant = useMemo(() => {
    const map = { ...fullTotals };
    Object.keys(formByVariant || {}).forEach((vid) => {
      map[vid] = liveStationTotals(fullTotals[vid], formByVariant[vid]);
    });
    // Ensure every known hist key is live-merged
    Object.keys(fullTotals || {}).forEach((vid) => {
      if (!map[vid] || formByVariant[vid]) {
        map[vid] = liveStationTotals(fullTotals[vid], formByVariant[vid]);
      }
    });
    return map;
  }, [fullTotals, formByVariant]);

  function setPackContextFor(order, line, variantId, totalsMap) {
    if (!order || !line || !variantId) return null;
    return buildSetPackContext(order.lines || [], line, variantId, totalsMap || allLiveTotalsByVariant);
  }

  useEffect(() => {
    setRows((prev) => {
      const currentForm = formContributionByVariant(employees, prev, orders, fullTotals);
      const currentAddonForm = formAddonContributionByVariant(employees, prev);
      let changed = false;
      const next = { ...prev };
      for (const emp of employees) {
        const row = next[emp.id];
        if (!row || row.isLeave) continue;
        let rowChanged = false;
        const entries = row.entries.map((entry) => {
          if (!entry.variantId || !entry.orderId || !entry.orderLineId) return entry;
          const order = orders.find((o) => o.order_id === Number(entry.orderId));
          const line = order?.lines?.find((l) => l.order_line_id === Number(entry.orderLineId));
          if (!line) return entry;

          if (entry.addonId) {
            const addon = findLineAddon(line, entry.addonId);
            if (!addon || addonWorkStation(addon) !== emp.station) {
              if (!entry.addonId && (entry.qty === "" || entry.qty == null)) return entry;
              rowChanged = true;
              return { ...entry, addonId: null, qty: "" };
            }
            const formWithout = { ...(currentAddonForm[entry.variantId] || {}) };
            const q = Number(entry.qty) || 0;
            formWithout[entry.addonId] = Math.max(0, (Number(formWithout[entry.addonId]) || 0) - q);
            const liveAddons = liveAddonTotals(fullAddonTotals[entry.variantId], formWithout);
            const stationLive = liveStationTotals(fullTotals[entry.variantId], currentForm[entry.variantId]);
            const headroom = availableForAddon(
              line,
              addon,
              stationLive,
              Number(liveAddons[entry.addonId]) || 0
            );
            const capped = clampQtyToHeadroom(entry.qty, headroom);
            if (capped !== String(entry.qty ?? "")) {
              rowChanged = true;
              return { ...entry, qty: capped };
            }
            return entry;
          }

          if (skipMap(line)[emp.station]) {
            if (entry.qty === "" || entry.qty == null) return entry;
            rowChanged = true;
            return { ...entry, qty: "" };
          }

          // Packing a set: qty is complete sets (catch-up all parts)
          if (emp.station === "Packing") {
            const gk = entry.setGroupKey || setGroupKey(line);
            if (gk) {
              const groupLines = (order.lines || []).filter((l) => setGroupKey(l) === gk);
              if (groupLines.length >= 2) {
                // Headroom vs hist only (exclude this draft — catch-up uses hist base)
                const ctx = buildSetPackContext(order.lines || [], line, entry.variantId, fullTotals);
                const packPrev = previousStation(line, "Packing");
                const headroom = availableSetPackSets(ctx, packPrev);
                const capped = clampQtyToHeadroom(entry.qty, headroom);
                if (capped !== String(entry.qty ?? "") || !entry.setGroupKey) {
                  rowChanged = true;
                  return { ...entry, qty: capped, setGroupKey: gk };
                }
                return entry;
              }
            }
          }

          const formWithoutThis = { ...emptyStationTotals(), ...(currentForm[entry.variantId] || {}) };
          const q = Number(entry.qty) || 0;
          formWithoutThis[emp.station] = Math.max(0, (Number(formWithoutThis[emp.station]) || 0) - q);
          const liveWithout = liveStationTotals(fullTotals[entry.variantId], formWithoutThis);
          const totalsMap = {};
          Object.keys(fullTotals || {}).forEach((vid) => {
            totalsMap[vid] = liveStationTotals(fullTotals[vid], currentForm[vid]);
          });
          Object.keys(currentForm || {}).forEach((vid) => {
            totalsMap[vid] = liveStationTotals(fullTotals[vid], currentForm[vid]);
          });
          totalsMap[entry.variantId] = liveWithout;
          const setPackCtx =
            emp.station === "Packing"
              ? buildSetPackContext(order.lines || [], line, entry.variantId, totalsMap)
              : null;
          const headroom = availableForStation(
            line,
            emp.station,
            liveWithout,
            liveAddonTotals(fullAddonTotals[entry.variantId], currentAddonForm[entry.variantId]),
            setPackCtx
          );
          if (headroom == null) return entry;
          const capped = clampQtyToHeadroom(entry.qty, headroom);
          if (capped !== String(entry.qty ?? "")) {
            rowChanged = true;
            return { ...entry, qty: capped };
          }
          return entry;
        });
        if (rowChanged) {
          changed = true;
          next[emp.id] = { ...row, entries };
        }
      }
      return changed ? next : prev;
    });
  }, [employees, orders, fullTotals, fullAddonTotals]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (stationFilter !== "All stations" && emp.station !== stationFilter) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return emp.name.toLowerCase().includes(q) || emp.station.toLowerCase().includes(q) || String(emp.numericId).includes(q);
    });
  }, [employees, search, stationFilter]);

  const stats = useMemo(() => {
    let entriesCount = 0;
    let totalQty = 0;
    let totalPayout = 0;
    let onLeave = 0;
    employees.forEach((emp) => {
      const row = rows[emp.id];
      const dayToday = employeeDays[emp.id]?.dates?.[karachiToday];
      if (dayToday?.status === "leave" || row?.isLeave) onLeave += 1;
      if (!row || row.isLeave) return;
      row.entries.forEach((entry) => {
        const qty = Number(entry.qty) || 0;
        if (!entry.orderId || qty <= 0) return;
        entriesCount += 1;
        totalQty += qty;
        const order = orderById(entry.orderId);
        const line = order?.lines?.find((l) => l.order_line_id === Number(entry.orderLineId));
        if (emp.station === "Packing" && entry.setGroupKey) {
          const groupLines = (order?.lines || []).filter((l) => setGroupKey(l) === entry.setGroupKey);
          totalPayout += Math.round(qty * setPackRatePerSet(groupLines));
        } else {
          totalPayout += Math.round(qty * entryRate(line, emp.station, entry.addonId));
        }
      });
    });
    return { entriesCount, totalQty, totalPayout, onLeave, atmCount: orders.length };
  }, [employees, rows, orders, employeeDays, karachiToday]);

  function patchRow(empId, patch) {
    setRows((prev) => ({ ...prev, [empId]: { ...prev[empId], ...patch } }));
  }

  function setEmpDate(empId, iso) {
    const emp = employees.find((e) => e.id === empId);
    let date = iso || karachiToday;
    if (date > karachiToday) date = karachiToday;
    if (emp?.joiningDate && date < emp.joiningDate) date = emp.joiningDate;
    setRows((prev) => ({
      ...prev,
      [empId]: emptyDraft(date),
    }));
  }

  function patchEntry(empId, index, patch) {
    setRows((prev) => {
      const row = prev[empId] || emptyDraft(karachiToday);
      return {
        ...prev,
        [empId]: {
          ...row,
          entries: row.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
        },
      };
    });
  }

  function addEntry(empId, preset = null) {
    setRows((prev) => {
      const row = prev[empId] || emptyDraft(karachiToday);
      const nextEntry = preset
        ? {
            ...emptyEntry(),
            orderId: preset.orderId,
            orderLineId: preset.orderLineId,
            variantId: preset.variantId,
            addonId: preset.addonId || null,
            packItemKey: preset.packItemKey || null,
            setGroupKey: preset.setGroupKey || null,
          }
        : emptyEntry();
      const entries = row.entries;
      const onlyEmpty =
        entries.length === 1 &&
        !entries[0].orderId &&
        !entries[0].qty;
      return {
        ...prev,
        [empId]: {
          ...row,
          isLeave: false,
          addingMore: true,
          entries: onlyEmpty ? [nextEntry] : [...entries, nextEntry],
        },
      };
    });
  }

  function removeEntry(empId, index) {
    setRows((prev) => {
      const row = prev[empId];
      if (!row) return prev;
      const entries = row.entries.filter((_, i) => i !== index);
      return { ...prev, [empId]: { ...row, entries: entries.length ? entries : [emptyEntry()] } };
    });
  }

  function handleFloorPick(part) {
    setFloorPick(part);
    if (!activeEmpId) return;
    const emp = employees.find((e) => e.id === activeEmpId);
    const order = orders.find((o) => o.order_id === Number(part.orderId));
    let preset = {
      orderId: part.orderId,
      orderLineId: part.orderLineId,
      variantId: part.variantId,
    };
    // Packing: floor-pick a set part → select the whole set
    if (emp?.station === "Packing" && order) {
      const line = (order.lines || []).find((l) => l.order_line_id === Number(part.orderLineId));
      const gk = line ? setGroupKey(line) : null;
      if (gk) {
        const items = buildPackItems(order);
        const item = items.find((i) => i.type === "set" && i.groupKey === gk);
        if (item) {
          const design = designNameFromVariant(line, part.variantId);
          const primaryVar = matchVariantByDesign(item.primaryLine, design);
          preset = {
            orderId: part.orderId,
            orderLineId: item.primaryLine.order_line_id,
            variantId: primaryVar?.variant_id || null,
            packItemKey: item.key,
            setGroupKey: gk,
          };
        }
      }
    }
    const row = rows[activeEmpId];
    const day = employeeDays[activeEmpId]?.dates?.[row?.targetDate || karachiToday];
    const locked = Boolean(day);
    if (locked && !row?.addingMore) {
      addEntry(activeEmpId, preset);
      return;
    }
    addEntry(activeEmpId, preset);
  }

  function openEmployee(empId) {
    setActiveEmpId(empId);
    setRows((prev) => {
      const row = prev[empId] || emptyDraft(karachiToday);
      return { ...prev, [empId]: { ...row, targetDate: row.targetDate || karachiToday } };
    });
    if (floorPick) {
      addEntry(empId, {
        orderId: floorPick.orderId,
        orderLineId: floorPick.orderLineId,
        variantId: floorPick.variantId,
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSavedSuccess(false);
    try {
      const byDateAppend = {};
      const leaveByDate = {};

      for (const emp of employees) {
        const row = rows[emp.id];
        if (!row) continue;
        const date = toIsoDateOnly(row.targetDate) || karachiToday;
        const already = employeeDays[emp.id]?.dates?.[date]?.status;

        if (row.isLeave) {
          if (already === "leave") continue;
          if (already === "work") {
            setSaveError(`${emp.name}: ${formatKarachiDMY(date)} already has saved work (locked)`);
            setSaving(false);
            return;
          }
          if (!leaveByDate[date]) leaveByDate[date] = [];
          leaveByDate[date].push(emp.numericId);
          continue;
        }

        // Only save drafts when day is empty OR user opened “Add more”
        if (already && !row.addingMore) continue;

        for (const entry of row.entries) {
          const qty = Number(entry.qty) || 0;
          const defects = Number(entry.defects) || 0;
          if (qty <= 0 && defects <= 0) continue;
          if (!entry.orderId || !entry.orderLineId || !entry.variantId) {
            setSaveError(`${emp.name}: select ATM, item, and variant for every qty entry`);
            setSaving(false);
            return;
          }
          const order = orderById(entry.orderId);
          const line = order?.lines?.find((l) => l.order_line_id === Number(entry.orderLineId));
          if (line && !entry.addonId && skipMap(line)[emp.station]) {
            setSaveError(`${emp.name}: ${emp.station} is skipped on that order part`);
            setSaving(false);
            return;
          }
          if (entry.addonId && line) {
            const addon = findLineAddon(line, entry.addonId);
            if (!addon) {
              setSaveError(`${emp.name}: that add-on is not on the selected order part`);
              setSaving(false);
              return;
            }
            if (addonWorkStation(addon) !== emp.station) {
              setSaveError(
                `${emp.name}: ${addon.name} is logged by ${addonWorkStation(addon)}, not ${emp.station}`
              );
              setSaving(false);
              return;
            }
          }
          if (!byDateAppend[date]) byDateAppend[date] = [];

          // Packing a set: one UI qty (sets) → catch-up packing on every part
          if (emp.station === "Packing") {
            const gk = entry.setGroupKey || (line ? setGroupKey(line) : null);
            if (gk) {
              const design = designNameFromVariant(line, entry.variantId);
              const groupLines = (order?.lines || []).filter((l) => setGroupKey(l) === gk);
              if (groupLines.length < 2) {
                setSaveError(`${emp.name}: set packing needs at least 2 parts`);
                setSaving(false);
                return;
              }
              const siblings = [];
              for (const gl of groupLines) {
                const mv = matchVariantByDesign(gl, design);
                if (!mv) {
                  setSaveError(`${emp.name}: missing design "${design}" on ${partNameOf(gl)}`);
                  setSaving(false);
                  return;
                }
                siblings.push({
                  line: gl,
                  variantId: mv.variant_id,
                  qtyPerSet: qtyPerSetOf(gl),
                  partName: partNameOf(gl),
                });
              }
              const needs = setPackCatchUpNeeds(siblings, qty, fullTotals);
              for (const n of needs) {
                if (n.need <= 0) continue;
                byDateAppend[date].push({
                  employee_id: emp.numericId,
                  is_leave: false,
                  order_id: Number(entry.orderId),
                  order_line_id: n.line.order_line_id,
                  variant_id: n.variantId,
                  quantity: n.need,
                  defects: defects > 0 ? defects : 0,
                  addon_id: null,
                });
              }
              // If everything already caught up, still count as handled (no orphan primary row)
              continue;
            }
          }

          byDateAppend[date].push({
            employee_id: emp.numericId,
            is_leave: false,
            order_id: Number(entry.orderId),
            order_line_id: Number(entry.orderLineId),
            variant_id: entry.variantId,
            quantity: qty,
            defects,
            addon_id: entry.addonId || null,
          });
        }
      }

      const hasAppend = Object.values(byDateAppend).some((e) => e.length);
      const hasLeave = Object.values(leaveByDate).some((e) => e.length);
      if (!hasAppend && !hasLeave) {
        setSaveError("Nothing new to save — pick a date with no data, or Add more on a locked day");
        setSaving(false);
        return;
      }

      for (const emp of employees) {
        const row = rows[emp.id];
        if (!row || row.isLeave) continue;
        for (const entry of row.entries) {
          const qty = Number(entry.qty) || 0;
          if (!entry.variantId || qty <= 0) continue;
          const order = orderById(entry.orderId);
          const line = order?.lines?.find((l) => l.order_line_id === Number(entry.orderLineId));
          if (!line) continue;
          const live = liveStationTotals(fullTotals[entry.variantId], formByVariant[entry.variantId]);
          const liveAddons = liveAddonTotals(fullAddonTotals[entry.variantId], formAddonByVariant[entry.variantId]);

          if (entry.addonId) {
            const addon = findLineAddon(line, entry.addonId);
            if (!addon) continue;
            const done = Number(liveAddons[entry.addonId]) || 0;
            const requires = addon.requiresStations || ["Cutting", "Stitching"];
            let maxUp = Infinity;
            for (const s of requires) {
              if (skipMap(line)[s]) continue;
              maxUp = Math.min(maxUp, Number(live[s]) || 0);
            }
            if (Number.isFinite(maxUp) && done > maxUp) {
              setSaveError(
                `${addon.name} (${done.toLocaleString()}) cannot exceed finished prerequisites (${maxUp.toLocaleString()}).`
              );
              setSaving(false);
              return;
            }
            continue;
          }

          // Set packing: qty is complete sets — headroom vs hist (catch-up)
          if (emp.station === "Packing") {
            const gk = entry.setGroupKey || setGroupKey(line);
            if (gk) {
              const ctx = setPackContextFor(order, line, entry.variantId, fullTotals);
              const packPrev = previousStation(line, "Packing");
              const avail = availableSetPackSets(ctx, packPrev);
              if (avail != null && qty > avail) {
                const info = completeSetsReadyForPack(ctx, packPrev);
                const short = (info?.bottlenecks || [])
                  .filter((b) => b.partSets <= (info?.sets ?? 0))
                  .map((b) => `${b.partName} (${b.upstream} ready / ${b.qtyPerSet} per set)`)
                  .slice(0, 2)
                  .join(", ");
                setSaveError(
                  `Only ${avail} complete set(s) can be packed` +
                    (short ? ` — limited by ${short}` : "") +
                    `. Check all parts first.`
                );
                setSaving(false);
                return;
              }
              continue;
            }
          }

          const prev = previousStation(line, emp.station);
          if (prev) {
            const upstream = Number(live[prev]) || 0;
            const here = Number(live[emp.station]) || 0;
            if (here > upstream) {
              setSaveError(
                `${emp.station} (${here.toLocaleString()}) cannot exceed ${prev} (${upstream.toLocaleString()}). More upstream first — over-order is OK.`
              );
              setSaving(false);
              return;
            }
          }
          if (emp.station === "Packing") {
            const ctx = setPackContextFor(order, line, entry.variantId, allLiveTotalsByVariant);
            if (ctx) {
              const packPrev = previousStation(line, "Packing");
              const info = completeSetsReadyForPack(ctx, packPrev);
              if (info) {
                const packed = Number(live.Packing) || 0;
                const maxPieces = info.sets * qtyPerSetOf(line);
                if (packed > maxPieces) {
                  const short = (info.bottlenecks || [])
                    .filter((b) => b.partSets <= info.sets)
                    .map((b) => `${b.partName} (${b.upstream} ready / ${b.qtyPerSet} per set)`)
                    .slice(0, 2)
                    .join(", ");
                  setSaveError(
                    `Packing needs complete sets — only ${info.sets} set(s) ready` +
                      (short ? ` (limited by ${short})` : "") +
                      `. Pack matching parts together.`
                  );
                  setSaving(false);
                  return;
                }
              }
            }
          }
          const hereQty = Number(live[emp.station]) || 0;
          for (const ad of lineSelectedAddons(line)) {
            if ((ad.afterStation || "Checking") !== emp.station) continue;
            const addonDone = Number(liveAddons[ad.id]) || 0;
            if (hereQty > addonDone) {
              setSaveError(
                `${emp.station} (${hereQty.toLocaleString()}) needs more ${ad.name} first (${addonDone.toLocaleString()} done).`
              );
              setSaving(false);
              return;
            }
          }
        }
      }

      for (const [work_date, ids] of Object.entries(leaveByDate)) {
        const res = await apiFetch("/api/production", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_date,
            replace_all: false,
            replace_employee_ids: ids,
            entries: ids.map((id) => ({ employee_id: id, is_leave: true })),
          }),
        });
        if (!res.ok) {
          setSaveError(await readApiError(res, "Failed to save leave"));
          return;
        }
      }

      for (const [work_date, entries] of Object.entries(byDateAppend)) {
        if (!entries.length) continue;
        const res = await apiFetch("/api/production", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_date,
            append: true,
            replace_all: false,
            entries,
          }),
        });
        if (!res.ok) {
          setSaveError(await readApiError(res, "Failed to save production"));
          return;
        }
      }

      const [ordRes] = await Promise.all([
        apiFetch("/api/orders"),
        refreshFullTotals(),
      ]);
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(
          (Array.isArray(ordData) ? ordData : []).filter((o) => o.payment_status !== "shipped")
        );
      }
      await loadEmployeeDays(employees, { keepDrafts: false });
      setSavedSuccess(true);
    } catch (err) {
      console.error(err);
      setSaveError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  function renderEntryForm(emp, row) {
    return (
      <div className="space-y-3">
        {row.entries.map((entry, ei) => {
          const order = orderById(entry.orderId);
          const lines = order?.lines || [];
          const line = lines.find((l) => l.order_line_id === Number(entry.orderLineId));
          const packItem = emp.station === "Packing" ? packItemFromEntry(order, entry) : null;
          const isSetPack = Boolean(packItem?.type === "set" || entry.setGroupKey);
          const packItems = emp.station === "Packing" && order ? buildPackItems(order) : [];
          const setGroupLines = isSetPack && order
            ? (order.lines || []).filter((l) => setGroupKey(l) === (entry.setGroupKey || packItem?.groupKey))
            : [];
          const stationAddons = isSetPack ? [] : addonsForStation(line, emp.station);
          const selectedAddon = entry.addonId ? findLineAddon(line, entry.addonId) : null;
          const isAddonWork = Boolean(selectedAddon && addonWorkStation(selectedAddon) === emp.station);
          const rate = isSetPack
            ? setPackRatePerSet(setGroupLines)
            : entryRate(line, emp.station, isAddonWork ? entry.addonId : null);
          const qty = Number(entry.qty) || 0;
          const skips = skipMap(line);
          const stationSkipped = Boolean(line && !isAddonWork && !isSetPack && skips[emp.station]);
          const live = entry.variantId ? totalsForVariant(entry.variantId) : emptyStationTotals();
          const liveAddons = entry.variantId ? addonTotalsForVariant(entry.variantId) : {};

          let headroom = null;
          let isFirstStation = false;
          if (line && entry.variantId && isAddonWork) {
            const formWithout = { ...(formAddonByVariant[entry.variantId] || {}) };
            if (qty > 0) {
              formWithout[entry.addonId] = Math.max(0, (Number(formWithout[entry.addonId]) || 0) - qty);
            }
            const addonsExcluding = liveAddonTotals(fullAddonTotals[entry.variantId], formWithout);
            headroom = availableForAddon(
              line,
              selectedAddon,
              live,
              Number(addonsExcluding[entry.addonId]) || 0
            );
          } else if (isSetPack && line && entry.variantId && order) {
            const ctx = buildSetPackContext(order.lines || [], line, entry.variantId, fullTotals);
            headroom = availableSetPackSets(ctx, previousStation(line, "Packing"));
          } else if (line && entry.variantId) {
            const formWithoutThis = { ...(formByVariant[entry.variantId] || emptyStationTotals()) };
            if (qty > 0) {
              formWithoutThis[emp.station] = Math.max(
                0,
                (Number(formWithoutThis[emp.station]) || 0) - qty
              );
            }
            const totalsExcludingRow = liveStationTotals(fullTotals[entry.variantId], formWithoutThis);
            const totalsMap = { ...allLiveTotalsByVariant, [entry.variantId]: totalsExcludingRow };
            const setPackCtx =
              emp.station === "Packing"
                ? setPackContextFor(order, line, entry.variantId, totalsMap)
                : null;
            headroom = availableForStation(
              line,
              emp.station,
              totalsExcludingRow,
              liveAddons,
              setPackCtx
            );
            isFirstStation = previousStation(line, emp.station) == null
              && !lineSelectedAddons(line).some((a) => (a.afterStation || "Checking") === emp.station);
          }

          const setPackHint =
            isSetPack && line && entry.variantId
              ? (() => {
                  const ctx = setPackContextFor(order, line, entry.variantId, fullTotals);
                  if (!ctx) return null;
                  const prev = previousStation(line, "Packing");
                  const info = completeSetsReadyForPack(ctx, prev);
                  if (!info) return null;
                  const short = (info.bottlenecks || [])
                    .filter((b) => b.partSets === info.sets)
                    .map((b) => b.partName)
                    .slice(0, 2);
                  return {
                    sets: info.sets,
                    limitedBy: short,
                    prev: prev || "upstream",
                  };
                })()
              : null;

          const blocked = stationSkipped || headroom === 0;
          const needHint = isAddonWork
            ? `Need ${(selectedAddon.requiresStations || []).join(" + ") || "upstream"}`
            : setPackHint && headroom === 0
              ? `Need complete set (${setPackHint.limitedBy.join(" + ") || "all parts"} at ${setPackHint.prev})`
              : `Need ${previousStation(line, emp.station)
                || lineSelectedAddons(line).find((a) => (a.afterStation || "Checking") === emp.station)?.name
                || "upstream"}`;

          // Design options: for sets use primary line variants (shared design names)
          const variantSourceLine = isSetPack ? (packItem?.primaryLine || setGroupLines[0] || line) : line;
          const variants = variantSourceLine?.variants || [];
          const variant = variants.find((v) => v.variant_id === entry.variantId);

          return (
            <div key={ei} className="rounded-xl p-3 space-y-3" style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">ATM</label>
                  <select
                    className="form-input"
                    value={entry.orderId ?? ""}
                    onChange={(e) => patchEntry(emp.id, ei, {
                      orderId: e.target.value ? Number(e.target.value) : null,
                      orderLineId: null,
                      variantId: null,
                      addonId: null,
                      packItemKey: null,
                      setGroupKey: null,
                      qty: "",
                    })}
                  >
                    <option value="">Select ATM…</option>
                    {orders.map((o) => (
                      <option key={o.order_id} value={o.order_id}>{o.atm_no} · {o.customer}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">{emp.station === "Packing" ? "Item / set" : "Item / part"}</label>
                  {emp.station === "Packing" ? (
                    <select
                      className="form-input"
                      value={packItem?.key || entry.packItemKey || ""}
                      disabled={!order}
                      onChange={(e) => {
                        const item = packItems.find((i) => i.key === e.target.value);
                        if (!item) {
                          patchEntry(emp.id, ei, {
                            packItemKey: null,
                            setGroupKey: null,
                            orderLineId: null,
                            variantId: null,
                            addonId: null,
                            qty: "",
                          });
                          return;
                        }
                        if (item.type === "set") {
                          patchEntry(emp.id, ei, {
                            packItemKey: item.key,
                            setGroupKey: item.groupKey,
                            orderLineId: item.primaryLine.order_line_id,
                            variantId: null,
                            addonId: null,
                            qty: "",
                          });
                        } else {
                          patchEntry(emp.id, ei, {
                            packItemKey: item.key,
                            setGroupKey: null,
                            orderLineId: item.line.order_line_id,
                            variantId: null,
                            addonId: null,
                            qty: "",
                          });
                        }
                      }}
                    >
                      <option value="">Select set or article…</option>
                      {packItems.map((item) => (
                        <option key={item.key} value={item.key}>{item.label}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="form-input"
                      value={entry.orderLineId ?? ""}
                      disabled={!order}
                      onChange={(e) => patchEntry(emp.id, ei, {
                        orderLineId: e.target.value ? Number(e.target.value) : null,
                        variantId: null,
                        addonId: null,
                        packItemKey: null,
                        setGroupKey: null,
                      })}
                    >
                      <option value="">Select part…</option>
                      {lines.map((l) => {
                        const stationCanAddon = addonsForStation(l, emp.station).length > 0;
                        const skippedForStation = !stationCanAddon && skipMap(l)[emp.station];
                        return (
                          <option key={l.order_line_id} value={l.order_line_id} disabled={skippedForStation}>
                            {l.article_name}{l.dimension_name ? ` · ${l.dimension_name}` : ""}{skippedForStation ? " (skipped)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
                <div>
                  <label className="form-label">Design / variant</label>
                  <select
                    className="form-input"
                    value={entry.variantId ?? ""}
                    disabled={!line && !isSetPack}
                    onChange={(e) => patchEntry(emp.id, ei, {
                      variantId: e.target.value || null,
                      qty: "",
                    })}
                  >
                    <option value="">Select…</option>
                    {variants.map((v) => {
                      const setQty = isSetPack
                        ? Number(lineSetMeta(variantSourceLine)?.orderQuantity) ||
                          Math.round((Number(v.quantity) || 0) / qtyPerSetOf(variantSourceLine))
                        : Number(v.quantity || 0);
                      return (
                        <option key={v.variant_id} value={v.variant_id}>
                          {v.variant_name} · order {setQty.toLocaleString()}
                          {isSetPack ? " sets" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {stationAddons.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="form-label">Work type</label>
                    <select
                      className="form-input"
                      value={isAddonWork ? entry.addonId || "" : ""}
                      disabled={!line}
                      onChange={(e) => patchEntry(emp.id, ei, {
                        addonId: e.target.value || null,
                        qty: "",
                      })}
                    >
                      <option value="">{emp.station} station work</option>
                      {stationAddons.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (add-on) · {formatPKR(a.addonRate)}/pc
                        </option>
                      ))}
                    </select>
                    <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                      {emp.station} can log{" "}
                      <strong style={{ color: COLORS.ink }}>{stationAddons.map((a) => a.name).join(" / ")}</strong>
                      {" "}after prerequisites are done.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">
                      {isSetPack ? "Sets to pack" : "Qty"}
                      {isFirstStation && !isAddonWork
                        ? " · can exceed order"
                        : headroom != null
                          ? isSetPack
                            ? ` · max ${headroom.toLocaleString()} set${headroom === 1 ? "" : "s"}`
                            : setPackHint
                              ? ` · max ${headroom.toLocaleString()} (${setPackHint.sets} set${setPackHint.sets === 1 ? "" : "s"})`
                              : ` · max ${headroom.toLocaleString()}`
                          : ""}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={headroom != null ? headroom : undefined}
                      step="1"
                      className="form-input"
                      value={blocked ? "" : entry.qty}
                      disabled={blocked || !entry.variantId}
                      onChange={(e) => patchEntry(emp.id, ei, {
                        qty: clampQtyToHeadroom(e.target.value, headroom),
                      })}
                      placeholder={headroom === 0 ? needHint : "0"}
                      style={
                        blocked
                          ? { background: COLORS.boneDim, color: COLORS.graphiteLight }
                          : undefined
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Defects</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={entry.defects}
                      disabled={blocked}
                      onChange={(e) => patchEntry(emp.id, ei, { defects: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                  {stationSkipped ? (
                    <span style={{ color: COLORS.rust }}>{emp.station} skipped — pick add-on work type if available</span>
                  ) : headroom === 0 ? (
                    <span style={{ color: COLORS.rust }}>{needHint}</span>
                  ) : (
                    <span>
                      {isAddonWork ? `${selectedAddon.name} · ` : ""}
                      {isSetPack
                        ? `Packing sets · `
                        : setPackHint
                          ? `Complete sets ${setPackHint.sets.toLocaleString()} · `
                          : ""}
                      Rate {formatPKR(rate)}{isSetPack ? "/set" : ""} · {formatPKR(qty * rate)}
                    </span>
                  )}
                </div>
                {row.entries.length > 1 && (
                  <button type="button" className="text-[11px] font-semibold" style={{ color: COLORS.rust }} onClick={() => removeEntry(emp.id, ei)}>
                    Remove line
                  </button>
                )}
              </div>

              {line && entry.variantId && (
                <div className="pt-1">
                  {isSetPack ? (
                    <>
                      <p className="text-[11px] mb-1.5" style={{ color: COLORS.graphite }}>
                        Packs as one set (packing pay 1×):{" "}
                        {setGroupLines.map((gl) => `${qtyPerSetOf(gl)}× ${partNameOf(gl)}`).join(" + ")}
                      </p>
                      <p className="text-[11px] mb-1.5" style={{ color: COLORS.graphiteLight }}>
                        Enter complete sets — each part is caught up automatically
                      </p>
                      {setPackHint && (
                        <p className="text-[11px]" style={{ color: COLORS.goldDim }}>
                          {setPackHint.sets.toLocaleString()} complete set{setPackHint.sets === 1 ? "" : "s"} ready at {setPackHint.prev}
                          {setPackHint.limitedBy?.length ? ` · limited by ${setPackHint.limitedBy.join(", ")}` : ""}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <StationPills
                        line={line}
                        totals={live}
                        orderQty={variant?.quantity ?? line.quantity}
                        addonTotals={liveAddons}
                      />
                      <p className="text-[11px] mt-1.5" style={{ color: COLORS.goldDim }}>
                        {describePipelineStatus(line, live, liveAddons)}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg"
          style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
          onClick={() => addEntry(emp.id, floorPick)}
        >
          <PlusIcon /> Add another line
        </button>
      </div>
    );
  }

  return (
    <AppShell
      title="Production floor"
      subtitle={`Karachi today · ${formatKarachiDMY(karachiToday)} · pick a date per employee`}
      maxWidth="1400px"
      showAvatar={false}
      actions={
        <button
          type="button"
          className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-xl shrink-0"
          style={{ background: COLORS.gold, color: COLORS.inkSurface, opacity: saving ? 0.7 : 1 }}
          disabled={saving || loading}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save data"}
        </button>
      }
    >
          {loadError && (
            <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>{loadError}</div>
          )}
          {saveError && (
            <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>{saveError}</div>
          )}
          {savedSuccess && (
            <div className="rounded-xl px-4 py-3 mb-5 text-[12.5px]" style={{ background: COLORS.greenSoft || COLORS.goldSoft, color: COLORS.green }}>
              Data saved · ATM floor updated
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<LayersIcon />} label="ATMs on floor" value={stats.atmCount} sub="open orders" />
            <MiniStat index={1} icon={<UsersIcon />} label="Employees" value={employees.length} sub={`${stats.onLeave} leave today`} />
            <MiniStat index={2} icon={<LayersIcon />} label="Draft entries" value={stats.entriesCount} sub={`${stats.totalQty.toLocaleString()} pcs`} />
            <MiniStat index={3} icon={<BanknoteIcon />} label="Est. payout" value={formatPKR(stats.totalPayout)} sub="draft qty × rate" />
          </div>

          {loading ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>Loading…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <section className="xl:col-span-5">
                <div className="mb-3">
                  <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>ATM floor</h2>
                  <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
                    Stock left at each step · updates when you save
                  </p>
                </div>
                {floorPick && (
                  <div className="rounded-xl px-3 py-2 mb-3 text-[12px]" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}>
                    Selected: <span className="font-semibold">{floorPick.line.article_name}</span>
                    {" · "}{floorPick.variant.variant_name}
                    <button type="button" className="ml-2 font-semibold" style={{ color: COLORS.rust }} onClick={() => setFloorPick(null)}>Clear</button>
                  </div>
                )}
                <FloorBoard
                  orders={orders}
                  totalsForVariant={totalsForVariant}
                  addonTotalsForVariant={addonTotalsForVariant}
                  onPick={handleFloorPick}
                />
              </section>

              <section className="xl:col-span-7">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Add data</h2>
                    <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
                      Change date → empty day = add · saved day = locked batch
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="search-wrap">
                      <SearchIcon />
                      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee" />
                    </div>
                    <select className="form-input" style={{ width: "auto" }} value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}>
                      <option>All stations</option>
                      <option>Cutting</option>
                      <option>Stitching</option>
                      <option>Checking</option>
                      <option>Packing</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {filteredEmployees.map((emp) => {
                    const row = rows[emp.id] || emptyDraft(karachiToday);
                    const date = row.targetDate || karachiToday;
                    const day = employeeDays[emp.id]?.dates?.[date] || null;
                    const locked = Boolean(day);
                    const stationColor = STATION_COLORS[emp.station] || COLORS.graphite;
                    const open = activeEmpId === emp.id;
                    const draftCount = row.isLeave
                      ? 0
                      : row.entries.filter((e) => (Number(e.qty) || 0) > 0).length;
                    const minDate = emp.joiningDate || addDaysISO(karachiToday, -(LOOKBACK_DAYS - 1));
                    const hintWin = catchUpWindow({
                      today: karachiToday,
                      joiningDate: emp.joiningDate,
                      daysBack: 7,
                    });
                    const missing = missingDaysInWindow(hintWin.days, employeeDays[emp.id]?.dates || {})
                      .filter((d) => d < karachiToday)
                      .slice(0, 4);

                    return (
                      <div key={emp.id} className="rounded-2xl overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${open ? COLORS.gold : COLORS.border}` }}>
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ background: COLORS.boneDim }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: COLORS.inkSurface, color: COLORS.gold }}>
                              {initials(emp.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>{emp.name}</div>
                              <div className="text-[11px]" style={{ color: stationColor }}>
                                {emp.station}
                                {" · "}{formatKarachiDMY(date)}
                                {locked ? " · locked" : " · no data yet"}
                                {draftCount > 0 ? ` · +${draftCount} draft` : ""}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                            style={{
                              background: open ? COLORS.inkSurface : COLORS.gold,
                              color: open ? COLORS.gold : COLORS.inkSurface,
                            }}
                            onClick={() => (open ? setActiveEmpId(null) : openEmployee(emp.id))}
                          >
                            {open ? "Close" : "Open"}
                          </button>
                        </div>

                        {open && (
                          <div className="p-4 space-y-4">
                            <div className="rounded-xl px-3 py-3 space-y-2" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
                              <div className="flex flex-wrap items-end gap-3">
                                <div className="min-w-[160px]">
                                  <label className="form-label">Batch date (Karachi)</label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={date}
                                    min={minDate}
                                    max={karachiToday}
                                    onChange={(e) => setEmpDate(emp.id, e.target.value)}
                                  />
                                </div>
                                <p className="text-[12px] pb-2" style={{ color: COLORS.ink }}>
                                  Today is <span className="font-semibold">{formatKarachiDMY(karachiToday)}</span>
                                  {" · "}showing <span className="font-semibold">{formatKarachiDMY(date)}</span>
                                </p>
                              </div>
                              {missing.length > 0 && (
                                <p className="text-[11.5px]" style={{ color: COLORS.graphite }}>
                                  Hint — no data yet for{" "}
                                  {missing.map((d, i) => (
                                    <span key={d}>
                                      {i > 0 ? ", " : ""}
                                      <button
                                        type="button"
                                        className="font-semibold underline-offset-2 hover:underline"
                                        style={{ color: COLORS.goldDim }}
                                        onClick={() => setEmpDate(emp.id, d)}
                                      >
                                        {formatKarachiDMY(d)}
                                      </button>
                                    </span>
                                  ))}
                                  . Tap a date to open it.
                                </p>
                              )}
                            </div>

                            {locked && <LockedBatch date={date} day={day} />}

                            {!locked && (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h3 className="text-[12px] font-semibold" style={{ color: COLORS.ink }}>
                                    No data for {formatKarachiDMY(date)} — add below
                                  </h3>
                                  <label className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: COLORS.rust }}>
                                    <input
                                      type="checkbox"
                                      checked={row.isLeave}
                                      onChange={(e) => patchRow(emp.id, {
                                        isLeave: e.target.checked,
                                        entries: e.target.checked ? [emptyEntry()] : row.entries,
                                      })}
                                    />
                                    No work / leave
                                  </label>
                                </div>
                                {row.isLeave ? (
                                  <p className="text-[12.5px]" style={{ color: COLORS.graphite }}>
                                    Will mark {formatKarachiDMY(date)} as no work on Save data.
                                  </p>
                                ) : (
                                  renderEntryForm(emp, row)
                                )}
                              </div>
                            )}

                            {locked && day.status === "work" && (
                              <div className="space-y-3">
                                {!row.addingMore ? (
                                  <button
                                    type="button"
                                    className="text-[12px] font-semibold px-3 py-2 rounded-lg"
                                    style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
                                    onClick={() => patchRow(emp.id, { addingMore: true, isLeave: false, entries: [emptyEntry()] })}
                                  >
                                    Add more pcs to this day
                                  </button>
                                ) : (
                                  <>
                                    <h3 className="text-[12px] font-semibold" style={{ color: COLORS.ink }}>
                                      Add more · {formatKarachiDMY(date)}
                                    </h3>
                                    {renderEntryForm(emp, row)}
                                    <button
                                      type="button"
                                      className="text-[11px] font-semibold"
                                      style={{ color: COLORS.graphite }}
                                      onClick={() => patchRow(emp.id, { addingMore: false, entries: [emptyEntry()] })}
                                    >
                                      Cancel add more
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!filteredEmployees.length && (
                    <div className="rounded-2xl p-12 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                      <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>No employees match your filters.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

      <style>{`
        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: ${COLORS.graphite}; margin-bottom: 4px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none; width: 100%;
        }
        .form-input:hover, .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .form-input:disabled { background: ${COLORS.boneDim}; color: ${COLORS.graphiteLight}; }
        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px; outline: none; width: 200px;
        }
        .btn-primary:hover { filter: brightness(1.06); }
      `}</style>
    </AppShell>
  );
}
