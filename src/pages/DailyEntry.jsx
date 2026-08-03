// ========================================
// DailyEntry.jsx
// Bulk Daily Work Data & Attendance Entry page.
// Wired to the real backend: employees + articles are fetched live,
// and each day's batch is saved to / loaded from Postgres (production_logs +
// daily_batches), with permanent lock enforcement handled server-side.
// ========================================

import { useState, useMemo, useEffect, Fragment } from "react";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, CloseIcon } from "../components/icons/CommonIcons";
import { API_BASE, apiFetch } from "../lib/api";

const STATION_COLORS = {
  Cutting: COLORS.graphiteLight,
  Stitching: COLORS.gold,
  Checking: COLORS.goldDim,
  Packing: COLORS.green,
};

function initials(name) {
  if (!name) return "E";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function getImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("http") || imagePath.startsWith("blob:")) return imagePath;
  return `${API_BASE}${imagePath}`;
}

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

function getFormattedDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split("T")[0];
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 11V2M4.5 5.5L8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 12.5v1.5c0 .6.4 1 1 1h9c.6 0 1-.4 1-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M3.3 6v.01M12.7 10.5v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 7V4.5a3 3 0 0 1 6 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8l6.2 11.2H1.8L8 1.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v3.5M8 11.8v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function DailyEntryPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [workDate, setWorkDate] = useState(getFormattedDate(0));
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("All stations");
  const [statusFilter, setStatusFilter] = useState("All status");
  const [bulkItemSelect, setBulkItemSelect] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");

  const todayStr = getFormattedDate(0);
  const isPastDate = workDate < todayStr;

  // Live data from the backend — replaces the old hardcoded INITIAL_EMPLOYEES / ITEMS_LIST.
  const [employees, setEmployees] = useState([]);
  const [articles, setArticles] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [empRes, artRes, ordRes] = await Promise.all([
          apiFetch("/api/employees"),
          apiFetch("/api/articles"),
          apiFetch("/api/orders"),
        ]);
        const empData = await empRes.json();
        const artData = await artRes.json();
        const ordData = await ordRes.json();

        setEmployees(
          empData.map((emp) => ({
            id: `EMP-${emp.e_id}`,
            numericId: emp.e_id,
            name: emp.full_name,
            station: emp.station,
            image: emp.image_link,
          }))
        );

        setArticles(
          artData.map((a) => ({
            id: a.article_id,
            name: a.article_name,
            rates: {
              Cutting: Number(a.rate_cutting),
              Stitching: Number(a.rate_stitching),
              Checking: Number(a.rate_checking),
              Packing: Number(a.rate_packing),
            },
            sizes: Array.isArray(a.sizes) ? a.sizes : [],
            dimensions: Array.isArray(a.dimensions) ? a.dimensions : [],
            variants: Array.isArray(a.variants) ? a.variants : [],
          }))
        );

        setOrders(Array.isArray(ordData) ? ordData : []);
      } catch (err) {
        console.error("Failed to fetch employees/articles/orders", err);
      }
    }
    fetchData();
  }, []);

  // Order lines still open (not yet fully packed) for the article/size/dimension
  // an entry has selected — this is what populates the "For Order" dropdown.
  function openOrderLinesFor(entry) {
    const options = [];
    orders.forEach((order) => {
      (order.lines || []).forEach((line) => {
        if (line.article_id !== entry.articleId) return;
        if ((line.size_id || null) !== (entry.sizeId || null)) return;
        if ((line.dimension_id || null) !== (entry.dimensionId || null)) return;
        const readyQty = (line.variants || []).reduce((s, v) => s + (Number(v.ready_quantity) || 0), 0);
        if (readyQty >= line.quantity) return; // already fully packed
        options.push({
          orderId: order.order_id,
          label: `ATM ${order.atm_no} · ${order.customer} — ${line.quantity - readyQty} left`,
        });
      });
    });
    return options;
  }

  // Active grid rows — populated from the real batch fetch below, keyed by employee id.
  const [rows, setRows] = useState({});
  const [isLocked, setIsLocked] = useState(false);

  const isDateLocked = isLocked;

  function emptyEntry() {
    return { articleId: articles[0]?.id ?? null, sizeId: null, dimensionId: null, variantId: null, allocation: "SIDE_STOCK", orderId: null, qty: 0, defects: 0 };
  }

  function emptyRow() { return { entries: [emptyEntry()], isLeave: false }; }
  function rowEntries(row) { return row?.entries?.length ? row.entries : [emptyEntry()]; }

  // Effective rate cascade: article base -> overridden by the chosen Size's
  // non-null fields -> overridden by the chosen Dimension's non-null fields
  // (Dimension wins on conflict, since dimension differences usually drive
  // labor cost the most directly — e.g. multi-piece duvet sets).
  function entryRate(entry, station) {
    const article = articles.find((item) => item.id === entry.articleId) || articles[0];
    const rateField = { Cutting: "rate_cutting", Stitching: "rate_stitching", Checking: "rate_checking", Packing: "rate_packing" }[station];
    let rate = Number(article?.rates?.[station] ?? 0);

    const size = article?.sizes?.find((s) => s.size_id === entry.sizeId);
    if (size && size[rateField] !== null && size[rateField] !== undefined) rate = Number(size[rateField]);

    const dimension = article?.dimensions?.find((d) => d.dimension_id === entry.dimensionId);
    if (dimension && dimension[rateField] !== null && dimension[rateField] !== undefined) rate = Number(dimension[rateField]);

    return rate;
  }

  // Load whichever date is selected: pulls the real saved batch if one exists
  // (and locks the UI if it's already submitted), otherwise starts a blank sheet.
  useEffect(() => {
    async function fetchBatch() {
      try {
        const res = await apiFetch(`/api/production/batch/${workDate}`);
        const data = await res.json();
        setIsLocked(data.isLocked);

        if (data.rows.length > 0) {
          const loadedRows = {};
          data.rows.forEach((r) => {
            const empId = `EMP-${r.employee_id}`;
            if (r.isLeave) {
              loadedRows[empId] = { entries: [emptyEntry()], isLeave: true };
              return;
            }
            const entry = {
              articleId: r.article_id,
              sizeId: r.size_id || null,
              dimensionId: r.dimension_id || null,
              variantId: r.variant_id || null,
              allocation: r.allocation || "SIDE_STOCK",
              orderId: r.order_id || null,
              qty: r.quantity,
              defects: r.defects || 0,
            };
            if (loadedRows[empId]) {
              loadedRows[empId] = { ...loadedRows[empId], entries: [...loadedRows[empId].entries, entry] };
            } else {
              loadedRows[empId] = { entries: [entry], isLeave: false };
            }
          });
          // Any employee with no saved rows for this date still gets a blank sheet row.
          employees.forEach((emp) => {
            if (!loadedRows[emp.id]) loadedRows[emp.id] = emptyRow();
          });
          setRows(loadedRows);
        } else {
          const initial = {};
          employees.forEach((emp) => {
            initial[emp.id] = emptyRow();
          });
          setRows(initial);
        }
      } catch (err) {
        console.error("Failed to fetch batch", err);
      }
    }
    if (employees.length > 0 && articles.length > 0) fetchBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workDate, employees, articles]);

  function updateEntry(empId, entryIndex, field, value) {
    if (isDateLocked) return;
    setRows((prev) => {
      const row = prev[empId] || emptyRow();
      const entries = rowEntries(row).map((entry, index) => index === entryIndex ? { ...entry, [field]: value } : entry);
      return { ...prev, [empId]: { ...row, entries } };
    });
  }

  // Changing the article on an entry always resets the chosen variant —
  // dimension/design/color options are specific to each article.
  function updateEntryArticle(empId, entryIndex, articleId) {
    if (isDateLocked) return;
    setRows((prev) => {
      const row = prev[empId] || emptyRow();
      const entries = rowEntries(row).map((entry, index) =>
        index === entryIndex ? { ...entry, articleId, sizeId: null, dimensionId: null, variantId: null } : entry
      );
      return { ...prev, [empId]: { ...row, entries } };
    });
  }

  function variantLabel(variant) {
    if (!variant) return "";
    return variant.variant_name || `Variant #${variant.variant_id}`;
  }

  function addEntry(empId) {
    if (isDateLocked) return;
    setRows((prev) => {
      const row = prev[empId] || emptyRow();
      return { ...prev, [empId]: { ...row, entries: [...rowEntries(row), emptyEntry()] } };
    });
  }

  function removeEntry(empId, entryIndex) {
    if (isDateLocked) return;
    setRows((prev) => {
      const row = prev[empId] || emptyRow();
      const entries = rowEntries(row).filter((_, index) => index !== entryIndex);
      return { ...prev, [empId]: { ...row, entries: entries.length ? entries : [emptyEntry()] } };
    });
  }

  function toggleLeave(empId) {
    if (isDateLocked) return;
    setRows((prev) => {
      const current = prev[empId] || emptyRow();
      const nextLeave = !current.isLeave;
      return {
        ...prev,
        [empId]: {
          ...current,
          isLeave: nextLeave,
          qty: nextLeave ? 0 : (current.qty || 100),
        },
      };
    });
  }

  function handleApplyBulkArticle(articleId) {
    if (isDateLocked || !articleId) return;
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        const row = next[id] || emptyRow();
        const entries = rowEntries(row);
        const updated = [{ ...entries[0], articleId, sizeId: null, dimensionId: null, variantId: null }, ...entries.slice(1)];
        next[id] = { ...row, entries: updated };
      });
      return next;
    });
    setBulkItemSelect("");
  }

  function handleResetAllQuantities() {
    if (isDateLocked) return;
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        const row = next[id] || emptyRow();
        const entries = rowEntries(row).map((entry) => ({ ...entry, qty: 0, defects: 0 }));
        next[id] = { ...row, entries };
      });
      return next;
    });
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const rowState = rows[emp.id] || { isLeave: false };
      const matchesStation = stationFilter === "All stations" || emp.station === stationFilter;
      const matchesStatus =
        statusFilter === "All status"
          ? true
          : statusFilter === "Present"
          ? !rowState.isLeave
          : rowState.isLeave;

      const matchesSearch =
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.id.toLowerCase().includes(search.toLowerCase()) ||
        emp.station.toLowerCase().includes(search.toLowerCase());

      return matchesStation && matchesStatus && matchesSearch;
    });
  }, [employees, rows, search, stationFilter, statusFilter]);

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalPayout = 0;
    let presentCount = 0;
    let leaveCount = 0;

    employees.forEach((emp) => {
      const row = rows[emp.id] || emptyRow();
      if (row.isLeave) {
        leaveCount++;
      } else {
        presentCount++;
        rowEntries(row).forEach((entry) => {
          const qtyNum = Number(entry.qty) || 0;
          totalUnits += qtyNum;
          totalPayout += Math.round(qtyNum * entryRate(entry, emp.station));
        });
      }
    });

    return { totalUnits, totalPayout, presentCount, leaveCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, articles, rows]);

  function handleRequestSave() {
    if (isDateLocked) return;
    setConfirmModalOpen(true);
  }

  async function handleConfirmAndLockSave() {
    const rowsPayload = employees.flatMap((emp) => {
      const row = rows[emp.id] || emptyRow();
      if (row.isLeave) return [{ employee_id: emp.numericId, station: emp.station, isLeave: true }];
      return rowEntries(row).map((entry) => ({
        employee_id: emp.numericId,
        article_id: entry.articleId,
        size_id: entry.sizeId || null,
        dimension_id: entry.dimensionId || null,
        variant_id: entry.variantId || null,
        allocation: entry.allocation || "SIDE_STOCK",
        order_id: entry.allocation === "FOR_ORDER" ? entry.orderId || null : null,
        station: emp.station,
        quantity: Number(entry.qty) || 0,
        defects: Number(entry.defects) || 0,
        rate: entryRate(entry, emp.station),
        isLeave: false,
      }));
    });

    try {
      setSaveError("");
      const res = await apiFetch("/api/production/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_date: workDate, rows: rowsPayload }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error || "The batch could not be saved. Please try again.");
        setConfirmModalOpen(false);
        return;
      }

      setIsLocked(true);
      setConfirmModalOpen(false);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 4000);
    } catch (err) {
      console.error(err);
      setSaveError("Could not reach the server. Please try again.");
      setConfirmModalOpen(false);
    }
  }

  function handleImportCsv() {
    if (isDateLocked || !csvText.trim()) return;
    const lines = csvText.split("\n");
    const next = { ...rows };

    lines.forEach((line) => {
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length >= 2) {
        const idOrName = parts[0];
        const isLeaveStr = parts[1].toLowerCase() === "leave" || parts[1].toLowerCase() === "absent";
        const qty = isLeaveStr ? 0 : (Number(parts[1]) || 0);
        const articleName = parts[2] || articles[0]?.name || "";

        const matchEmp = employees.find(
          (e) => e.id.toLowerCase() === idOrName.toLowerCase() || e.name.toLowerCase().includes(idOrName.toLowerCase())
        );
        const matchArticle =
          articles.find((a) => a.name.toLowerCase() === articleName.toLowerCase()) || articles[0];

        if (matchEmp && matchArticle) {
          const existingEntry = rowEntries(next[matchEmp.id])[0] || emptyEntry();
          next[matchEmp.id] = {
            entries: [{ ...existingEntry, articleId: matchArticle.id, sizeId: null, dimensionId: null, variantId: null, qty }],
            isLeave: isLeaveStr,
          };
        }
      }
    });

    setRows(next);
    setCsvModalOpen(false);
    setCsvText("");
  }

  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.bone, fontFamily: FONT }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2.5 px-4 sm:px-6 md:px-8 py-3.5 sticky top-0 z-30 backdrop-blur" style={{ background: `${COLORS.bone}F2`, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button type="button" className="md:hidden p-2 rounded-lg btn-secondary shrink-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold truncate" style={{ color: COLORS.ink }}>Bulk Daily Work Entry</h1>
              <p className="text-[12px] hidden sm:block truncate" style={{ color: COLORS.graphiteLight }}>Batch log unit output or mark leaves for floor staff</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isDateLocked}
              className="btn-secondary inline-flex items-center gap-1 text-[11.5px] sm:text-[12px] font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg disabled:opacity-50"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, background: COLORS.card }}
              onClick={() => setCsvModalOpen(true)}
            >
              <UploadIcon /> <span className="hidden xs:inline">Import</span> CSV
            </button>

            {isDateLocked ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: COLORS.boneDim, color: COLORS.graphite, border: `1px solid ${COLORS.border}` }}>
                <LockIcon /> <span>Batch Locked</span>
              </span>
            ) : (
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg shrink-0"
                style={{ background: COLORS.gold, color: COLORS.ink }}
                onClick={handleRequestSave}
              >
                {savedSuccess ? <CheckIcon /> : <PlusIcon />} <span>{savedSuccess ? "Saved ✓" : "Save & Lock Batch"}</span>
              </button>
            )}

            <div className="hidden sm:flex flex-col items-end leading-tight border-l pl-3" style={{ borderColor: COLORS.border }}>
              <span className="text-[13px] font-medium" style={{ color: COLORS.ink }}>Admin</span>
              <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>Administrator</span>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[12px] sm:text-[13px] font-semibold shrink-0" style={{ background: COLORS.ink, color: COLORS.gold, border: `2px solid ${COLORS.goldSoft}` }}>
              A
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          {/* Success Toast */}
          {savedSuccess && (
            <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3 fade-in" style={{ background: COLORS.greenSoft, border: `1px solid ${COLORS.green}`, color: COLORS.green }}>
              <div className="flex items-center gap-2.5 text-[12.5px] font-semibold">
                <CheckIcon /> Daily Batch for {workDate} Permanently Locked &amp; Saved to Payroll!
              </div>
              <span className="text-[11.5px] font-medium">{summary.presentCount} present · {summary.leaveCount} on leave</span>
            </div>
          )}

          {saveError && (
            <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center gap-2.5 fade-in" style={{ background: COLORS.rustSoft, border: `1px solid ${COLORS.rust}`, color: COLORS.rust }}>
              <AlertIcon /> <span className="text-[12.5px] font-semibold">{saveError}</span>
            </div>
          )}

          {/* Locked Date Read-Only Alert Banner */}
          {isDateLocked && (
            <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3 fade-in" style={{ background: COLORS.ink, color: COLORS.bone }}>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.inkSoft, color: COLORS.gold }}>
                  <LockIcon />
                </span>
                <div>
                  <div className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: COLORS.gold }}>
                    <LockIcon /> Historical Batch Locked — {workDate}
                  </div>
                  <div className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>
                    Data for this date has already been submitted and locked for wage calculations. Editing is disabled to protect accounting.
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: COLORS.inkSoft, color: COLORS.gold }}>
                Read-Only Record
              </span>
            </div>
          )}

          {/* Past Date Backdate Notice (if unlocked) */}
          {!isDateLocked && isPastDate && (
            <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3 fade-in" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.gold}`, color: COLORS.goldDim }}>
              <div className="flex items-center gap-2.5 text-[12.5px] font-semibold">
                <AlertIcon /> Logging Missed Historical Data for <strong>{new Date(workDate).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</strong>
              </div>
              <button
                type="button"
                className="btn-link text-[11.5px] font-semibold underline"
                style={{ color: COLORS.ink }}
                onClick={() => setWorkDate(getFormattedDate(0))}
              >
                Switch to Today ({todayStr})
              </button>
            </div>
          )}

          {/* Summary Banner */}
          <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3 fade-in" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.card, color: COLORS.goldDim }}>
                <BanknoteIcon />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
                  Batch Payout Total for {workDate}: {formatPKR(summary.totalPayout)}
                </div>
                <div className="text-[11.5px]" style={{ color: COLORS.goldDim }}>
                  {summary.totalUnits.toLocaleString()} units completed · {summary.presentCount} Present · {summary.leaveCount} On Leave
                </div>
              </div>
            </div>

            {isDateLocked ? (
              <span className="text-[12px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.boneDim, color: COLORS.graphite, border: `1px solid ${COLORS.border}` }}>
                🔒 Locked Record
              </span>
            ) : (
              <button
                type="button"
                className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-lg"
                style={{ background: COLORS.ink, color: COLORS.gold }}
                onClick={handleRequestSave}
              >
                Submit &amp; Lock Batch
              </button>
            )}
          </div>

          {/* Top Live Summary MiniStats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<UsersIcon />} label="Present Staff" value={`${summary.presentCount} staff`} sub={`of ${employees.length} total`} />
            <MiniStat index={1} icon={<CalendarIcon />} label="Staff On Leave" value={`${summary.leaveCount} leave`} sub="marked for date" />
            <MiniStat index={2} icon={<LayersIcon />} label="Total Daily Units" value={`${summary.totalUnits.toLocaleString()} pcs`} sub="floor output" />
            <MiniStat index={3} icon={<BanknoteIcon />} label="Total Daily Payroll" value={formatPKR(summary.totalPayout)} sub="computed piece-rates" />
          </div>

          {/* Date Picker & Backdating Shortcuts Bar */}
          <div className="rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase" style={{ color: COLORS.graphite }}>Log Date:</span>
                <input
                  type="date"
                  className="form-input text-[12.5px] font-semibold"
                  style={{ width: 160 }}
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                />
              </div>

              {/* Quick Date Shortcuts */}
              <div className="flex items-center gap-1.5 border-l pl-3" style={{ borderColor: COLORS.border }}>
                <span className="text-[10.5px] font-semibold uppercase mr-1" style={{ color: COLORS.graphiteLight }}>Quick Date:</span>
                <button
                  type="button"
                  className="btn-secondary text-[11px] font-semibold px-2.5 py-1 rounded-md"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    background: workDate === getFormattedDate(0) ? COLORS.goldSoft : COLORS.bone,
                    color: workDate === getFormattedDate(0) ? COLORS.goldDim : COLORS.graphite,
                  }}
                  onClick={() => setWorkDate(getFormattedDate(0))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="btn-secondary text-[11px] font-semibold px-2.5 py-1 rounded-md"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    background: workDate === getFormattedDate(1) ? COLORS.goldSoft : COLORS.bone,
                    color: workDate === getFormattedDate(1) ? COLORS.goldDim : COLORS.graphite,
                  }}
                  onClick={() => setWorkDate(getFormattedDate(1))}
                >
                  Yesterday
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isDateLocked}
                className="btn-secondary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, background: COLORS.card }}
                onClick={handleResetAllQuantities}
              >
                Reset Qty
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="search-wrap">
              <SearchIcon />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee or station" />
            </div>

            <div className="select-wrap">
              <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}>
                <option value="All stations">All stations</option>
                <option value="Cutting">Cutting</option>
                <option value="Stitching">Stitching</option>
                <option value="Checking">Checking</option>
                <option value="Packing">Packing</option>
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="select-wrap">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All status">All Attendance</option>
                <option value="Present">Present Only</option>
                <option value="On Leave">On Leave Only</option>
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="select-wrap">
              <select
                disabled={isDateLocked}
                value={bulkItemSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setBulkItemSelect(val);
                  if (val) handleApplyBulkArticle(Number(val));
                }}
              >
                <option value="">Set All Work Items</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>{filteredEmployees.length} shown</span>
          </div>

          {/* Main Table */}
          <div className="rounded-2xl overflow-hidden panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ background: COLORS.boneDim }}>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Employee</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Station</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Attendance Status</th>
                    <th className="text-left font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Work Article / Item</th>
                    <th className="text-left font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Size</th>
                    <th className="text-left font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Dimension</th>
                    <th className="text-left font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Variant</th>
                    <th className="text-left font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Assignment</th>
                    <th className="text-right font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Rate / pc</th>
                    <th className="text-right font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Completed Qty</th>
                    <th className="text-right font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>QC Defects</th>
                    <th className="text-right font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Net Daily Pay</th>
                    <th className="text-center font-semibold px-3 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const rowState = rows[emp.id] || emptyRow();
                    const isLeave = rowState.isLeave;
                    const entries = rowEntries(rowState);

                    const employeeCell = (rowSpan) => (
                      <td className="px-5 py-3.5 align-top" rowSpan={rowSpan}>
                        <span className="flex items-center gap-3">
                          <span
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 overflow-hidden"
                            style={{ background: isLeave ? COLORS.rustSoft : COLORS.goldSoft, color: isLeave ? COLORS.rust : COLORS.goldDim }}
                          >
                            {emp.image ? (
                              <img src={getImageUrl(emp.image)} alt={`${emp.name} profile`} className="w-full h-full object-cover" />
                            ) : initials(emp.name)}
                          </span>
                          <span className="flex flex-col min-w-0">
                            <span className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>{emp.name}</span>
                            <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>{emp.id}</span>
                          </span>
                        </span>
                      </td>
                    );

                    const stationCell = (rowSpan) => (
                      <td className="px-5 py-3.5 align-top" rowSpan={rowSpan}>
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap"
                          style={{ background: COLORS.boneDim, color: COLORS.graphite }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATION_COLORS[emp.station] || COLORS.gold }} />
                          {emp.station}
                        </span>
                      </td>
                    );

                    const attendanceCell = (rowSpan) => (
                      <td className="px-5 py-3.5 align-top" rowSpan={rowSpan}>
                        <button
                          type="button"
                          disabled={isDateLocked}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          style={{
                            background: isLeave ? COLORS.rustSoft : COLORS.greenSoft,
                            color: isLeave ? COLORS.rust : COLORS.green,
                            borderColor: isLeave ? COLORS.rust : COLORS.green,
                          }}
                          onClick={() => toggleLeave(emp.id)}
                          title={isDateLocked ? "Batch is locked" : "Click to toggle Present / On Leave"}
                        >
                          {isLeave ? "On Leave" : "Present ✓"}
                        </button>
                      </td>
                    );

                    if (isLeave) {
                      return (
                        <tr key={emp.id} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}`, opacity: 0.75 }}>
                          {employeeCell(1)}
                          {stationCell(1)}
                          {attendanceCell(1)}
                          <td className="px-5 py-3.5" colSpan={4}>
                            <span className="text-[11.5px] font-semibold px-3 py-1 rounded-lg inline-block" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
                              On Leave — no production logged
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right" style={{ color: COLORS.graphiteLight }}>—</td>
                          <td className="px-5 py-3.5 text-right" style={{ color: COLORS.graphiteLight }}>—</td>
                          <td className="px-5 py-3.5 text-right" style={{ color: COLORS.graphiteLight }}>—</td>
                          <td className="px-5 py-3.5 text-right font-semibold" style={{ color: COLORS.graphiteLight }}>PKR 0</td>
                          <td></td>
                        </tr>
                      );
                    }

                    return (
                      <Fragment key={emp.id}>
                        {entries.map((entry, entryIndex) => {
                          const article = articles.find((a) => a.id === entry.articleId) || articles[0] || { rates: {}, sizes: [], dimensions: [], variants: [] };
                          const rate = entryRate(entry, emp.station);
                          const qtyNum = Number(entry.qty) || 0;
                          const calculatedPay = Math.round(qtyNum * rate);
                          const isFirst = entryIndex === 0;
                          const isLast = entryIndex === entries.length - 1;

                          return (
                            <tr
                              key={`${emp.id}-${entryIndex}`}
                              className="tbl-row"
                              style={{ borderTop: isFirst ? `1px solid ${COLORS.border}` : "none", opacity: isDateLocked ? 0.75 : 1 }}
                            >
                              {isFirst && employeeCell(entries.length)}
                              {isFirst && stationCell(entries.length)}
                              {isFirst && attendanceCell(entries.length)}

                              {/* Article Item Selector */}
                              <td className="px-3 py-2">
                                <div className="select-wrap" style={{ width: 150, opacity: isDateLocked ? 0.5 : 1 }}>
                                  <select
                                    disabled={isDateLocked}
                                    className="w-full disabled:cursor-not-allowed"
                                    value={entry.articleId ?? ""}
                                    onChange={(e) => updateEntryArticle(emp.id, entryIndex, Number(e.target.value))}
                                  >
                                    {articles.map((a) => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                  </select>
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                              </td>

                              {/* Size Selector — only meaningful once the article has sizes configured */}
                              <td className="px-3 py-2">
                                {article.sizes?.length > 0 ? (
                                  <div className="select-wrap" style={{ width: 120, opacity: isDateLocked ? 0.5 : 1 }}>
                                    <select
                                      disabled={isDateLocked}
                                      className="w-full disabled:cursor-not-allowed"
                                      value={entry.sizeId ?? ""}
                                      onChange={(e) => updateEntry(emp.id, entryIndex, "sizeId", e.target.value ? Number(e.target.value) : null)}
                                    >
                                      <option value="">Default</option>
                                      {article.sizes.map((s) => (
                                        <option key={s.size_id} value={s.size_id}>{s.size_name}{s.is_default ? " ★" : ""}</option>
                                      ))}
                                    </select>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                ) : (
                                  <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>No sizes</span>
                                )}
                              </td>

                              {/* Dimension Selector — only meaningful once the article has dimensions configured */}
                              <td className="px-3 py-2">
                                {article.dimensions?.length > 0 ? (
                                  <div className="select-wrap" style={{ width: 140, opacity: isDateLocked ? 0.5 : 1 }}>
                                    <select
                                      disabled={isDateLocked}
                                      className="w-full disabled:cursor-not-allowed"
                                      value={entry.dimensionId ?? ""}
                                      onChange={(e) => updateEntry(emp.id, entryIndex, "dimensionId", e.target.value ? Number(e.target.value) : null)}
                                    >
                                      <option value="">Default</option>
                                      {article.dimensions.map((d) => (
                                        <option key={d.dimension_id} value={d.dimension_id}>{d.dimension_name}</option>
                                      ))}
                                    </select>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                ) : (
                                  <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>No dimensions</span>
                                )}
                              </td>

                              {/* Variant Selector — only meaningful once the article has variants (color/design) */}
                              <td className="px-3 py-2">
                                {article.variants?.length > 0 ? (
                                  <div className="select-wrap" style={{ width: 140, opacity: isDateLocked ? 0.5 : 1 }}>
                                    <select
                                      disabled={isDateLocked}
                                      className="w-full disabled:cursor-not-allowed"
                                      value={entry.variantId ?? ""}
                                      onChange={(e) => updateEntry(emp.id, entryIndex, "variantId", e.target.value ? Number(e.target.value) : null)}
                                    >
                                      <option value="">Default (no variant)</option>
                                      {article.variants.map((v) => (
                                        <option key={v.variant_id} value={v.variant_id}>{variantLabel(v)}</option>
                                      ))}
                                    </select>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                ) : (
                                  <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>No variants</span>
                                )}
                              </td>

                              {/* Assignment: Side Stock now, For Order reserved for once order records exist */}
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  <div className="select-wrap" style={{ width: 112, opacity: isDateLocked ? 0.5 : 1 }}>
                                    <select
                                      disabled={isDateLocked}
                                      className="w-full disabled:cursor-not-allowed"
                                      value={entry.allocation || "SIDE_STOCK"}
                                      onChange={(e) => updateEntry(emp.id, entryIndex, "allocation", e.target.value)}
                                    >
                                      <option value="SIDE_STOCK">Side Stock</option>
                                      <option value="FOR_ORDER">For Order</option>
                                    </select>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                  {entry.allocation === "FOR_ORDER" && (() => {
                                    const options = openOrderLinesFor(entry);
                                    return (
                                      <div className="select-wrap" style={{ width: 160, opacity: isDateLocked ? 0.5 : 1 }}>
                                        <select
                                          disabled={isDateLocked}
                                          className="w-full disabled:cursor-not-allowed"
                                          value={entry.orderId ?? ""}
                                          onChange={(e) => updateEntry(emp.id, entryIndex, "orderId", e.target.value ? Number(e.target.value) : null)}
                                        >
                                          <option value="">{options.length ? "Select order" : "No open orders"}</option>
                                          {options.map((o) => (
                                            <option key={o.orderId} value={o.orderId}>{o.label}</option>
                                          ))}
                                        </select>
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                                          <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>

                              {/* Piece Rate */}
                              <td className="px-3 py-2 text-right font-medium whitespace-nowrap" style={{ color: COLORS.graphite }}>
                                PKR {rate.toFixed(2)}
                              </td>

                              {/* Qty Input */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  disabled={isDateLocked}
                                  className="form-input text-right font-semibold disabled:bg-stone-100 disabled:cursor-not-allowed"
                                  style={{ width: 68 }}
                                  value={entry.qty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateEntry(emp.id, entryIndex, "qty", e.target.value)}
                                />
                              </td>

                              {/* QC Defects Input */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  disabled={isDateLocked}
                                  className="form-input text-right font-semibold text-amber-700 disabled:bg-stone-100 disabled:cursor-not-allowed"
                                  style={{ width: 56 }}
                                  value={entry.defects || 0}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateEntry(emp.id, entryIndex, "defects", e.target.value)}
                                />
                              </td>

                              {/* Calculated Pay */}
                              <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: calculatedPay > 0 ? COLORS.ink : COLORS.graphiteLight }}>
                                {formatPKR(calculatedPay)}
                              </td>

                              {/* Row actions: remove this article line / add another */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  {entries.length > 1 && !isDateLocked && (
                                    <button
                                      type="button"
                                      className="btn-secondary p-1 rounded-md"
                                      style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust }}
                                      title="Remove this article line"
                                      onClick={() => removeEntry(emp.id, entryIndex)}
                                    >
                                      <CloseIcon />
                                    </button>
                                  )}
                                  {isLast && !isDateLocked && (
                                    <button
                                      type="button"
                                      className="btn-secondary p-1 rounded-md"
                                      style={{ border: `1px solid ${COLORS.border}`, color: COLORS.goldDim }}
                                      title="Add another article for this employee"
                                      onClick={() => addEntry(emp.id)}
                                    >
                                      <PlusIcon />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Bar */}
            <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: COLORS.boneDim, borderTop: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center gap-5 text-[12.5px]">
                <div>
                  <span style={{ color: COLORS.graphite }}>Target Date: </span>
                  <strong style={{ color: COLORS.ink }}>{workDate} {isDateLocked ? "(Locked)" : "(Editable)"}</strong>
                </div>
                <div>
                  <span style={{ color: COLORS.graphite }}>Attendance: </span>
                  <strong style={{ color: COLORS.ink }}>{summary.presentCount} Present · {summary.leaveCount} On Leave</strong>
                </div>
                <div>
                  <span style={{ color: COLORS.graphite }}>Total Units: </span>
                  <strong style={{ color: COLORS.ink }}>{summary.totalUnits.toLocaleString()} pcs</strong>
                </div>
                <div>
                  <span style={{ color: COLORS.graphite }}>Total Daily Pay: </span>
                  <strong style={{ color: COLORS.ink }}>{formatPKR(summary.totalPayout)}</strong>
                </div>
              </div>

              {isDateLocked ? (
                <span className="text-[12.5px] font-semibold px-4 py-2 rounded-lg" style={{ background: COLORS.card, color: COLORS.graphite, border: `1px solid ${COLORS.border}` }}>
                  🔒 Batch Locked
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
                  style={{ background: COLORS.gold, color: COLORS.ink }}
                  onClick={handleRequestSave}
                >
                  Save &amp; Lock Batch
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation & Permanent Lock Modal */}
      {confirmModalOpen && (
        <div className="modal-overlay fixed inset-0 z-70 flex items-center justify-center p-4" onClick={() => setConfirmModalOpen(false)}>
          <div
            className="modal-pop w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: FONT }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0" style={{ background: COLORS.goldSoft, color: COLORS.goldDim, border: `1px solid ${COLORS.border}` }}>
                🔒
              </span>
              <div>
                <h3 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>Confirm &amp; Lock Daily Batch</h3>
                <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>Permanent submission for {workDate}</p>
              </div>
            </div>

            <div className="rounded-xl p-3.5 mb-4 text-[12px] leading-relaxed" style={{ background: COLORS.rustSoft, border: `1px solid ${COLORS.rust}`, color: COLORS.rust }}>
              <strong>⚠️ Warning — Cannot be changed:</strong> Once submitted, this batch for <strong>{workDate}</strong> will be permanently <strong>LOCKED</strong>. You will not be able to edit unit quantities or piece-rates later to ensure payroll integrity.
            </div>

            <div className="rounded-xl p-3.5 mb-5 space-y-2 text-[12.5px]" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between">
                <span style={{ color: COLORS.graphite }}>Log Date:</span>
                <strong style={{ color: COLORS.ink }}>{workDate}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: COLORS.graphite }}>Floor Output:</span>
                <strong style={{ color: COLORS.ink }}>{summary.totalUnits.toLocaleString()} pcs</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: COLORS.graphite }}>Attendance:</span>
                <strong style={{ color: COLORS.ink }}>{summary.presentCount} Present · {summary.leaveCount} On Leave</strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: COLORS.border }}>
                <span className="font-semibold" style={{ color: COLORS.ink }}>Total Payout:</span>
                <strong className="text-[14px]" style={{ color: COLORS.goldDim }}>{formatPKR(summary.totalPayout)}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-secondary text-[12.5px] font-semibold px-4 py-2.5 rounded-xl"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
                onClick={() => setConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-[12.5px] font-bold px-5 py-2.5 rounded-xl shadow-md"
                style={{ background: COLORS.gold, color: COLORS.ink }}
                onClick={handleConfirmAndLockSave}
              >
                Yes, Lock &amp; Save Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvModalOpen && (
        <div className="modal-overlay fixed inset-0 z-70 flex items-center justify-center p-4" onClick={() => setCsvModalOpen(false)}>
          <div
            className="modal-pop w-full max-w-lg rounded-2xl p-6"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>Import Daily Data CSV / Excel</h3>
              <button type="button" className="btn-secondary p-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}` }} onClick={() => setCsvModalOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <p className="text-[12px] mb-4" style={{ color: COLORS.graphiteLight }}>
              Paste lines from Excel or CSV formatted as: <code>Employee ID or Name, Quantity or "Leave", Article Name</code>
            </p>
            <textarea
              className="form-input h-36 font-mono text-[12px] mb-4"
              placeholder={`EMP-101, 150, Bedsheet Set — King\nEMP-105, Leave, Duvet Cover Set — Double\nEMP-103, 190, Bedsheet Set — King`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
                onClick={() => setCsvModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
                style={{ background: COLORS.gold, color: COLORS.ink }}
                onClick={handleImportCsv}
              >
                Parse &amp; Load into Sheet
              </button>
            </div>
          </div>
        </div>
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

        .btn-primary:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 8px 18px -8px rgba(184,135,61,0.5); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-secondary:hover:not(:disabled) { border-color: ${COLORS.gold} !important; color: ${COLORS.goldDim} !important; background: ${COLORS.goldSoft}55 !important; }

        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: ${COLORS.graphite}; margin-bottom: 4px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none; width: 100%;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .form-input:hover:not(:disabled), .form-input:focus:not(:disabled) { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }

        .select-wrap { position: relative; display: inline-flex; align-items: center; }
        .select-wrap select {
          appearance: none; font-family: ${FONT}; font-size: 12.5px; font-weight: 500;
          color: ${COLORS.ink}; background: ${COLORS.card}; border: 1px solid ${COLORS.border};
          border-radius: 8px; padding: 8px 28px 8px 12px; cursor: pointer; outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .select-wrap select:hover:not(:disabled), .select-wrap select:focus:not(:disabled) { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .select-caret { position: absolute; right: 10px; pointer-events: none; }

        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 240px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .search-wrap input::placeholder { color: ${COLORS.graphiteLight}; }
        .search-wrap input:hover, .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        .nav-item { transition: background .18s ease, transform .18s ease, color .18s ease; }
        .nav-item:hover:not(:disabled) { background: ${COLORS.inkSoft} !important; transform: translateX(2px); }

        @media (max-width: 640px) {
          .search-wrap, .select-wrap { width: 100%; }
          .search-wrap input { width: 100% !important; }
          .select-wrap select { width: 100% !important; }
        }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.boneBorder}; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.graphiteLight}; }
      `}</style>
    </div>
  );
}