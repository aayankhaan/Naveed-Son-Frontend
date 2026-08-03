// ========================================
// Costing.jsx
// Item Costing & Workstation Pricing page.
// Manage the selling price charged to clients and department piece-rate wages
// (Cutting, Stitching, Checking, Packing), calculating total workstation
// labor costs and net profit per item.
//
// Articles are structured as:
//   Product Name, Description, Workstation Prices, Selling Price
//   + Sizes       (configurable, each optionally overrides price/rates, one default)
//   + Dimensions  (configurable, each optionally overrides price/rates)
//   + Variants    (Color/Design — plain text tags, no pricing)
// Sizes, Dimensions, and Variants are managed independently of one another.
// ========================================

import { useState, useMemo, useEffect } from "react";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, CloseIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";

const OVERRIDE_FIELDS = [
  ["selling_price", "Sell"],
  ["rate_cutting", "Cutting"],
  ["rate_stitching", "Stitching"],
  ["rate_checking", "Checking"],
  ["rate_packing", "Packing"],
];

function normaliseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function emptySize() {
  return { size_name: "", is_default: false, selling_price: "", rate_cutting: "", rate_stitching: "", rate_checking: "", rate_packing: "" };
}
function emptyDimension() {
  return { dimension_name: "", selling_price: "", rate_cutting: "", rate_stitching: "", rate_checking: "", rate_packing: "" };
}

function calcItemCost(item) {
  const cutting = Number(item.cuttingRate) || 0;
  const stitching = Number(item.stitchingRate) || 0;
  const checking = Number(item.checkingRate) || 0;
  const packing = Number(item.packingRate) || 0;
  const selling = Number(item.sellingPrice) || 0;

  const totalStationCost = cutting + stitching + checking + packing;
  const profit = selling - totalStationCost;
  const profitMargin = selling > 0 ? Number(((profit / selling) * 100).toFixed(1)) : 0;

  return {
    ...item,
    cutting,
    stitching,
    checking,
    packing,
    selling,
    totalStationCost,
    profit,
    profitMargin,
  };
}

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M10.1 1.9a1.4 1.4 0 0 1 2 2L4.5 11.5 1.5 12.5l1-3L10.1 1.9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.6 8.2c0 .5.5.8 1 .8h3.8c.5 0 .9-.3 1-.8L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2h5.5L14 8.5a2 2 0 0 1 0 2.8l-3.7 3.7a2 2 0 0 1-2.8 0L1 8.5V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M9.5 2.5a3.8 3.8 0 0 0-4.6 4.6L1.5 10.5a1.4 1.4 0 0 0 2 2l3.4-3.4a3.8 3.8 0 0 0 4.6-4.6l-2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13.5l4.5-5 3.5 3 4.5-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 4.5h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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

function RulerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 10.5l3.5-3.5 8 8-3.5 3.5-8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.8 7.2l1.1 1.1M7.6 5.4l1.1 1.1M9.4 3.6l1.1 1.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function ItemCostCard({ item, index, onEdit, onDelete }) {
  const calc = useMemo(() => calcItemCost(item), [item]);
  const isProfitable = calc.profit >= 0;
  const sizes = item.sizes || [];
  const dimensions = item.dimensions || [];
  const variants = item.variants || [];

  return (
    <div
      className="panel fade-in rounded-2xl p-6 relative flex flex-col justify-between"
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: `${index * 60}ms` }}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: COLORS.ink, color: COLORS.gold }}>
                #{calc.id}
              </span>
              <h3 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>{calc.name}</h3>
            </div>
            {calc.description && (
              <p className="text-[12px] mt-1.5 line-clamp-2" style={{ color: COLORS.graphiteLight }}>
                {calc.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              className="btn-secondary p-1.5 rounded-lg shrink-0"
              title="Edit Costing"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={() => onEdit(calc)}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="btn-secondary p-1.5 rounded-lg shrink-0"
              title="Delete Item"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust, background: COLORS.rustSoft }}
              onClick={() => onDelete(calc)}
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        {(sizes.length > 0 || dimensions.length > 0 || variants.length > 0) && (
          <div className="rounded-xl p-3.5 mb-4" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
            {sizes.length > 0 && (
              <div className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: COLORS.goldDim }}>
                  <LayersIcon /> Sizes <span className="font-normal normal-case" style={{ color: COLORS.graphiteLight }}>({sizes.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sizes.slice(0, 5).map((s) => (
                    <span key={s.size_id} className="text-[10.5px] px-2 py-1 rounded-md" style={{ background: COLORS.card, color: COLORS.graphite, border: `1px solid ${COLORS.border}` }}>
                      {s.size_name}{s.is_default ? " ★" : ""}
                    </span>
                  ))}
                  {sizes.length > 5 && <span className="text-[10.5px] px-2 py-1" style={{ color: COLORS.graphiteLight }}>+{sizes.length - 5} more</span>}
                </div>
              </div>
            )}
            {dimensions.length > 0 && (
              <div className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: COLORS.goldDim }}>
                  <RulerIcon /> Dimensions <span className="font-normal normal-case" style={{ color: COLORS.graphiteLight }}>({dimensions.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dimensions.slice(0, 5).map((d) => (
                    <span key={d.dimension_id} className="text-[10.5px] px-2 py-1 rounded-md" style={{ background: COLORS.card, color: COLORS.graphite, border: `1px solid ${COLORS.border}` }}>
                      {d.dimension_name}
                    </span>
                  ))}
                  {dimensions.length > 5 && <span className="text-[10.5px] px-2 py-1" style={{ color: COLORS.graphiteLight }}>+{dimensions.length - 5} more</span>}
                </div>
              </div>
            )}
            {variants.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: COLORS.goldDim }}>
                  <TagIcon /> Variants (Color / Design) <span className="font-normal normal-case" style={{ color: COLORS.graphiteLight }}>({variants.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variants.slice(0, 5).map((v) => (
                    <span key={v.variant_id} className="text-[10.5px] px-2 py-1 rounded-md" style={{ background: COLORS.card, color: COLORS.graphite, border: `1px solid ${COLORS.border}` }}>
                      {v.variant_name}
                    </span>
                  ))}
                  {variants.length > 5 && <span className="text-[10.5px] px-2 py-1" style={{ color: COLORS.graphiteLight }}>+{variants.length - 5} more</span>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl p-3.5 mb-4" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: COLORS.graphite }}>
            Work-Station Wage Rates (Per Piece)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg p-2.5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="text-[10px] font-medium" style={{ color: COLORS.graphiteLight }}>Cutting</div>
              <div className="text-[13px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(calc.cutting)}</div>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="text-[10px] font-medium" style={{ color: COLORS.graphiteLight }}>Stitching</div>
              <div className="text-[13px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(calc.stitching)}</div>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="text-[10px] font-medium" style={{ color: COLORS.graphiteLight }}>Checking</div>
              <div className="text-[13px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(calc.checking)}</div>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="text-[10px] font-medium" style={{ color: COLORS.graphiteLight }}>Packing</div>
              <div className="text-[13px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(calc.packing)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t grid grid-cols-3 gap-3 text-center" style={{ borderColor: COLORS.border }}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>Labor Cost / Piece</div>
          <div className="text-[13.5px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(calc.totalStationCost)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>Selling Price</div>
          <div className="text-[13.5px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(calc.selling)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isProfitable ? COLORS.green : COLORS.rust }}>
            Net Profit / Piece
          </div>
          <div className="text-[13.5px] font-bold mt-0.5" style={{ color: isProfitable ? COLORS.green : COLORS.rust }}>
            {formatPKR(calc.profit)} ({calc.profitMargin}%)
          </div>
        </div>
      </div>
    </div>
  );
}

// A single override-rate mini-grid, reused for both Sizes and Dimensions rows.
function OverrideRatesGrid({ row, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {OVERRIDE_FIELDS.map(([field, label]) => (
        <div key={field}>
          <label className="form-label">{label} <span style={{ color: COLORS.graphiteLight }}>(PKR)</span></label>
          <input
            type="number"
            min="0"
            step="any"
            className="form-input"
            value={row[field] ?? ""}
            onChange={(e) => onChange(field, e.target.value)}
            placeholder="Use default"
          />
        </div>
      ))}
    </div>
  );
}

function AddEditCostingModal({ item, onClose, onSave }) {
  const isEditing = Boolean(item?.id);
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [sellingPrice, setSellingPrice] = useState(item?.sellingPrice !== undefined ? item.sellingPrice : "");
  const [cuttingRate, setCuttingRate] = useState(item?.cuttingRate !== undefined ? item.cuttingRate : "");
  const [stitchingRate, setStitchingRate] = useState(item?.stitchingRate !== undefined ? item.stitchingRate : "");
  const [checkingRate, setCheckingRate] = useState(item?.checkingRate !== undefined ? item.checkingRate : "");
  const [packingRate, setPackingRate] = useState(item?.packingRate !== undefined ? item.packingRate : "");

  const [sizes, setSizes] = useState(() => normaliseList(item?.sizes).map((s) => ({ ...emptySize(), ...s })));
  const [dimensions, setDimensions] = useState(() => normaliseList(item?.dimensions).map((d) => ({ ...emptyDimension(), ...d })));
  const [variants, setVariants] = useState(() => normaliseList(item?.variants).map((v) => v.variant_name ?? v));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const liveCalc = useMemo(() => {
    return calcItemCost({
      sellingPrice,
      cuttingRate,
      stitchingRate,
      checkingRate,
      packingRate,
    });
  }, [sellingPrice, cuttingRate, stitchingRate, checkingRate, packingRate]);

  // ---- Sizes ----
  function addSize() {
    setSizes((current) => [...current, emptySize()]);
  }
  function updateSize(index, field, value) {
    setSizes((current) => current.map((row, i) => {
      if (i !== index) return field === "is_default" && value ? { ...row, is_default: false } : row;
      return { ...row, [field]: value };
    }));
  }
  function removeSize(index) {
    setSizes((current) => current.filter((_, i) => i !== index));
  }

  // ---- Dimensions ----
  function addDimension() {
    setDimensions((current) => [...current, emptyDimension()]);
  }
  function updateDimension(index, field, value) {
    setDimensions((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  function removeDimension(index) {
    setDimensions((current) => current.filter((_, i) => i !== index));
  }

  // ---- Variants (color/design — plain text) ----
  function addVariant() {
    setVariants((current) => [...current, ""]);
  }
  function updateVariantText(index, value) {
    setVariants((current) => current.map((v, i) => (i === index ? value : v)));
  }
  function removeVariant(index) {
    setVariants((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    const payload = {
      article_name: name.trim(),
      article_description: description.trim(),
      selling_price: Number(sellingPrice) || 0,
      rate_cutting: Number(cuttingRate) || 0,
      rate_stitching: Number(stitchingRate) || 0,
      rate_checking: Number(checkingRate) || 0,
      rate_packing: Number(packingRate) || 0,
      sizes: sizes
        .filter((s) => s.size_name?.trim())
        .map((s) => ({
          size_name: s.size_name.trim(),
          is_default: Boolean(s.is_default),
          selling_price: s.selling_price === "" || s.selling_price == null ? null : Number(s.selling_price),
          rate_cutting: s.rate_cutting === "" || s.rate_cutting == null ? null : Number(s.rate_cutting),
          rate_stitching: s.rate_stitching === "" || s.rate_stitching == null ? null : Number(s.rate_stitching),
          rate_checking: s.rate_checking === "" || s.rate_checking == null ? null : Number(s.rate_checking),
          rate_packing: s.rate_packing === "" || s.rate_packing == null ? null : Number(s.rate_packing),
        })),
      dimensions: dimensions
        .filter((d) => d.dimension_name?.trim())
        .map((d) => ({
          dimension_name: d.dimension_name.trim(),
          selling_price: d.selling_price === "" || d.selling_price == null ? null : Number(d.selling_price),
          rate_cutting: d.rate_cutting === "" || d.rate_cutting == null ? null : Number(d.rate_cutting),
          rate_stitching: d.rate_stitching === "" || d.rate_stitching == null ? null : Number(d.rate_stitching),
          rate_checking: d.rate_checking === "" || d.rate_checking == null ? null : Number(d.rate_checking),
          rate_packing: d.rate_packing === "" || d.rate_packing == null ? null : Number(d.rate_packing),
        })),
      variants: variants
        .filter((v) => v?.trim())
        .map((v) => ({ variant_name: v.trim() })),
    };

    const numericId = isEditing ? item.id.replace("ART-", "") : null;
    const url = isEditing
      ? `/api/articles/${numericId}`
      : "/api/articles";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSaving(false);
        return;
      }

      onSave({
        id: `ART-${data.article_id}`,
        name: data.article_name,
        description: data.article_description || "",
        sellingPrice: Number(data.selling_price),
        cuttingRate: Number(data.rate_cutting),
        stitchingRate: Number(data.rate_stitching),
        checkingRate: Number(data.rate_checking),
        packingRate: Number(data.rate_packing),
        sizes: normaliseList(data.sizes),
        dimensions: normaliseList(data.dimensions),
        variants: normaliseList(data.variants),
      });
    } catch (err) {
      console.error(err);
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>
              {isEditing ? "Edit Item Rate & Station Costs" : "Add New Item Costing"}
            </h2>
            <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              Set the selling price and workstation rates (Cutting, Stitching, Checking, Packing)
            </p>
          </div>
          <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {isEditing && (
                <div>
                  <label className="form-label">Article / Product ID</label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value={item.id}
                    style={{ opacity: 0.6, cursor: "not-allowed" }}
                  />
                </div>
              )}
              <div className={isEditing ? "sm:col-span-2" : "sm:col-span-3"}>
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Duvet Cover Set"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="form-label">Product Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short specification or order details"
                />
              </div>
            </div>
          </div>

          <section className="rounded-2xl p-4 sm:p-5 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <h4 className="text-[11.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: COLORS.ink }}>
              Work-Station Wage Rates (Per Piece)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="form-label">Cutting (PKR)</label>
                <input type="number" min="0" step="any" className="form-input" value={cuttingRate} onChange={(e) => setCuttingRate(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Stitching (PKR)</label>
                <input type="number" min="0" step="any" className="form-input" value={stitchingRate} onChange={(e) => setStitchingRate(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Checking (PKR)</label>
                <input type="number" min="0" step="any" className="form-input" value={checkingRate} onChange={(e) => setCheckingRate(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Packing (PKR)</label>
                <input type="number" min="0" step="any" className="form-input" value={packingRate} onChange={(e) => setPackingRate(e.target.value)} placeholder="0" />
              </div>
            </div>
          </section>

          <div className="mb-5">
            <label className="form-label">Selling Price (PKR / Piece) *</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              className="form-input"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="e.g. 850"
            />
          </div>

          {/* ---------------- Sizes ---------------- */}
          <section className="rounded-2xl p-4 sm:p-5 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: COLORS.ink }}><LayersIcon /> Sizes</h4>
                <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>e.g. Single, 50 Double. Mark one as default. Empty price fields inherit the product defaults.</p>
              </div>
              <button type="button" className="btn-primary shrink-0 text-[11.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={addSize}>+ Add size</button>
            </div>
            {sizes.length === 0 ? (
              <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>No sizes yet. This product will use its default pricing only.</p>
            ) : sizes.map((size, index) => (
              <div key={index} className="rounded-xl overflow-hidden mb-4 last:mb-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: COLORS.goldSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>Size {index + 1}</span>
                  <button type="button" className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ color: COLORS.rust }} onClick={() => removeSize(index)}>Remove</button>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="sm:col-span-2">
                      <label className="form-label">Size Name</label>
                      <input className="form-input" value={size.size_name} onChange={(e) => updateSize(index, "size_name", e.target.value)} placeholder="e.g. Single" />
                    </div>
                    <div className="flex items-end pb-1.5">
                      <label className="flex items-center gap-2 text-[12px] font-medium" style={{ color: COLORS.graphite }}>
                        <input type="checkbox" checked={Boolean(size.is_default)} onChange={(e) => updateSize(index, "is_default", e.target.checked)} />
                        Default size
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 mb-2"><span className="h-px flex-1" style={{ background: COLORS.border }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>Optional price / rate overrides</span><span className="h-px flex-1" style={{ background: COLORS.border }} /></div>
                  <OverrideRatesGrid row={size} onChange={(field, value) => updateSize(index, field, value)} />
                </div>
              </div>
            ))}
          </section>

          {/* ---------------- Dimensions ---------------- */}
          <section className="rounded-2xl p-4 sm:p-5 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: COLORS.ink }}><RulerIcon /> Dimensions</h4>
                <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>e.g. "140 x 200 | 60x70". Empty price fields inherit the product defaults.</p>
              </div>
              <button type="button" className="btn-primary shrink-0 text-[11.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={addDimension}>+ Add dimension</button>
            </div>
            {dimensions.length === 0 ? (
              <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>No dimensions yet. This product will use its default pricing only.</p>
            ) : dimensions.map((dimension, index) => (
              <div key={index} className="rounded-xl overflow-hidden mb-4 last:mb-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: COLORS.goldSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>Dimension {index + 1}</span>
                  <button type="button" className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ color: COLORS.rust }} onClick={() => removeDimension(index)}>Remove</button>
                </div>
                <div className="p-4">
                  <div className="mb-4">
                    <label className="form-label">Dimension</label>
                    <input className="form-input" value={dimension.dimension_name} onChange={(e) => updateDimension(index, "dimension_name", e.target.value)} placeholder="e.g. 200 x 200 | 60x70 + 2" />
                  </div>
                  <div className="flex items-center gap-2 mt-1 mb-2"><span className="h-px flex-1" style={{ background: COLORS.border }} /><span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>Optional price / rate overrides</span><span className="h-px flex-1" style={{ background: COLORS.border }} /></div>
                  <OverrideRatesGrid row={dimension} onChange={(field, value) => updateDimension(index, field, value)} />
                </div>
              </div>
            ))}
          </section>

          {/* ---------------- Variants (Color / Design) ---------------- */}
          <section className="rounded-2xl p-4 sm:p-5 mb-6" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: COLORS.ink }}><TagIcon /> Variants (Color / Design)</h4>
                <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>Simple text values, e.g. Olive, Yellow, White Floral. No pricing — variants are descriptive only.</p>
              </div>
              <button type="button" className="btn-primary shrink-0 text-[11.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={addVariant}>+ Add variant</button>
            </div>
            {variants.length === 0 ? (
              <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>No variants yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input className="form-input" value={variant} onChange={(e) => updateVariantText(index, e.target.value)} placeholder="e.g. Olive Green" />
                    <button type="button" className="text-[11px] font-semibold px-2 py-2 rounded-md shrink-0" style={{ color: COLORS.rust }} onClick={() => removeVariant(index)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="rounded-xl p-4 mb-6" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.goldDim }}>
              Real-time Workstation Labor &amp; Profit Calculator
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[10px] font-medium" style={{ color: COLORS.graphite }}>Total Labor Cost</div>
                <div className="text-[14px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(liveCalc.totalStationCost)}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium" style={{ color: COLORS.graphite }}>Net Profit / Piece</div>
                <div className="text-[14px] font-semibold mt-0.5" style={{ color: liveCalc.profit >= 0 ? COLORS.green : COLORS.rust }}>
                  {formatPKR(liveCalc.profit)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium" style={{ color: COLORS.graphite }}>Profit Margin</div>
                <div className="text-[14px] font-bold mt-0.5" style={{ color: liveCalc.profit >= 0 ? COLORS.green : COLORS.rust }}>
                  {liveCalc.profitMargin}%
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-[12px] mb-3" style={{ color: COLORS.rust }}>
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: COLORS.border }}>
            <button
              type="button"
              className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
              style={{ background: COLORS.gold, color: COLORS.ink, opacity: name.trim() ? 1 : 0.5 }}
            >
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Product Costing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteCostingModal({ item, onClose, onConfirm }) {
  if (!item) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="modal-pop w-full max-w-md rounded-2xl p-6"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold" style={{ color: COLORS.rust }}>Delete Product Costing</h3>
          <button type="button" className="btn-secondary p-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}` }} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="text-[13px] mb-6" style={{ color: COLORS.graphite }}>
          Are you sure you want to remove costing for <strong style={{ color: COLORS.ink }}>{item.name}</strong> ({item.id})?
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: COLORS.rust, color: COLORS.card }}
            onClick={() => onConfirm(item.id)}
          >
            Delete Item
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CostingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  const [costingItems, setCostingItems] = useState([]);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await apiFetch("/api/articles");
        const data = await res.json();
        const mapped = data.map((a) => ({
          id: `ART-${a.article_id}`,
          name: a.article_name,
          description: a.article_description || "",
          sellingPrice: Number(a.selling_price),
          cuttingRate: Number(a.rate_cutting),
          stitchingRate: Number(a.rate_stitching),
          checkingRate: Number(a.rate_checking),
          packingRate: Number(a.rate_packing),
          sizes: normaliseList(a.sizes),
          dimensions: normaliseList(a.dimensions),
          variants: normaliseList(a.variants),
        }));
        setCostingItems(mapped);
      } catch (err) {
        console.error("Failed to fetch articles", err);
      }
    }
    fetchArticles();
  }, []);

  const calculatedItems = useMemo(() => costingItems.map(calcItemCost), [costingItems]);

  const filtered = useMemo(() => {
    return calculatedItems.filter(
      (item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [calculatedItems, search]);

  const totalProducts = calculatedItems.length;
  const avgStationLabor = useMemo(() => {
    if (!totalProducts) return 0;
    return calculatedItems.reduce((s, i) => s + i.totalStationCost, 0) / totalProducts;
  }, [calculatedItems, totalProducts]);

  const avgProfit = useMemo(() => {
    if (!totalProducts) return 0;
    return calculatedItems.reduce((s, i) => s + i.profit, 0) / totalProducts;
  }, [calculatedItems, totalProducts]);

  const avgMargin = useMemo(() => {
    if (!totalProducts) return 0;
    return calculatedItems.reduce((s, i) => s + i.profitMargin, 0) / totalProducts;
  }, [calculatedItems, totalProducts]);

  function handleSaveCosting(data) {
    setCostingItems((prev) => {
      const exists = prev.some((i) => i.id === data.id);
      if (exists) {
        return prev.map((i) => (i.id === data.id ? { ...i, ...data } : i));
      }
      return [data, ...prev];
    });
    setIsAddModalOpen(false);
    setEditingItem(null);
  }

  async function handleDeleteCosting(id) {
    const numericId = id.replace("ART-", "");
    try {
      const res = await apiFetch(`/api/articles/${numericId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        console.error(data.error || "Failed to delete article");
        return;
      }
      setCostingItems((prev) => prev.filter((i) => i.id !== id));
      setDeletingItem(null);
    } catch (err) {
      console.error(err);
    }
  }

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
              <h1 className="text-xl font-semibold truncate" style={{ color: COLORS.ink }}>Item Costing &amp; Workstation Pricing</h1>
              <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>Set selling price and workstation piece-rates (Cutting, Stitching, Checking, Packing)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-lg shrink-0"
              style={{ background: COLORS.gold, color: COLORS.ink }}
              onClick={() => setIsAddModalOpen(true)}
            >
              <PlusIcon /> Add item costing
            </button>
            <div className="hidden sm:flex flex-col items-end leading-tight border-l pl-3" style={{ borderColor: COLORS.border }}>
              <span className="text-[13px] font-medium" style={{ color: COLORS.ink }}>Admin</span>
              <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>Administrator</span>
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: COLORS.ink, color: COLORS.gold, border: `2px solid ${COLORS.goldSoft}` }}>
              A
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<TagIcon />} label="Total Costed Items" value={totalProducts} sub="Active products" />
            <MiniStat index={1} icon={<WrenchIcon />} label="Avg Station Labor" value={formatPKR(avgStationLabor)} sub="across 4 stations" />
            <MiniStat index={2} icon={<ProfitIcon />} label="Avg Profit / Item" value={formatPKR(avgProfit)} sub="net profit margin" />
            <MiniStat index={3} icon={<LayersIcon />} label="Avg Margin" value={`${avgMargin.toFixed(1)}%`} sub="overall average" />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="search-wrap">
              <SearchIcon />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name or Article ID" />
            </div>
            <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>{filtered.length} products found</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filtered.map((item, i) => (
              <ItemCostCard
                key={item.id}
                item={item}
                index={i}
                onEdit={(it) => setEditingItem(it)}
                onDelete={(it) => setDeletingItem(it)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="lg:col-span-2 rounded-2xl p-12 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>No products match your search query.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {(isAddModalOpen || editingItem) && (
        <AddEditCostingModal
          item={editingItem}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSaveCosting}
        />
      )}

      {deletingItem && (
        <DeleteCostingModal
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onConfirm={handleDeleteCosting}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

        .fade-in { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .modal-overlay { background: rgba(28,25,23,0.5); backdrop-filter: blur(2px); animation: overlayIn 0.18s ease both; }
        .modal-pop { animation: modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .panel, .btn-primary, .btn-secondary {
          transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, color .18s ease;
        }
        .panel:hover { box-shadow: 0 10px 26px -18px rgba(28,25,23,0.22); border-color: ${COLORS.gold} !important; }

        .btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 8px 18px -8px rgba(184,135,61,0.5); }
        .btn-primary:active { transform: translateY(0); }
        .btn-secondary:hover { border-color: ${COLORS.gold} !important; color: ${COLORS.goldDim} !important; background: ${COLORS.goldSoft}55 !important; }

        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: ${COLORS.graphite}; margin-bottom: 4px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none; width: 100%;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .form-input:hover, .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }

        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 280px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .search-wrap input::placeholder { color: ${COLORS.graphiteLight}; }
        .search-wrap input:hover, .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        .nav-item { transition: background .18s ease, transform .18s ease, color .18s ease; }
        .nav-item:hover:not(:disabled) { background: ${COLORS.inkSoft} !important; transform: translateX(2px); }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.boneBorder}; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.graphiteLight}; }
      `}</style>
    </div>
  );
}