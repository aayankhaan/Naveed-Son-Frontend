// ========================================
// Costing.jsx
// Manufacturing Catalog & Set Builder.
// Articles own pricing; Sets bundle child Articles; Orders configure Article or Set purchases.
// ========================================

import { useState, useMemo, useEffect } from "react";
import { FONT, COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import MiniStat from "../components/ui/MiniStat";
import ModalLayer from "../components/ui/ModalLayer";
import { SearchIcon, CloseIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";
import { formatPKR, genId, emptyAddon, normalizeAddon } from "../lib/manufacturingPricing";
import SetBuilderSection from "../components/costing/SetBuilderSection";
import SetEditorPage from "../components/costing/SetEditorPage";
import AddonConfigFields from "../components/costing/AddonConfigFields";

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

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

function normalizeRateField(value) {
  return value === "" || value == null ? null : Number(value);
}

function addonSellLabel(addon) {
  const n = normalizeAddon(addon);
  const bits = [];
  if (n.sellingPrice != null) bits.push(`sell +${formatPKR(n.sellingPrice)}`);
  if (n.addonRate != null) bits.push(`pay ${formatPKR(n.addonRate)}`);
  return bits.length ? bits.join(" · ") : "—";
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

function ItemCostCard({ item, index, onEdit, onDelete }) {
  const calc = useMemo(() => calcItemCost(item), [item]);
  const isProfitable = calc.profit >= 0;
  const addons = item.addons || [];

  return (
    <div
      className="panel fade-in rounded-2xl p-6 relative flex flex-col justify-between"
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: `${index * 60}ms` }}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: COLORS.inkSurface, color: COLORS.gold }}>
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

        {addons.length > 0 && (
          <div className="rounded-xl p-3.5 mb-4" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
            <div className="mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: COLORS.goldDim }}>
                <WrenchIcon /> Add-ons <span className="font-normal normal-case" style={{ color: COLORS.graphiteLight }}>({addons.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {addons.slice(0, 5).map((addon) => <span key={addon.id} className="text-[10.5px] px-2 py-1 rounded-md" style={{ background: COLORS.card, color: COLORS.graphite, border: `1px solid ${COLORS.border}` }}>{addon.name} (+{addonSellLabel(addon)})</span>)}
              </div>
            </div>
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

function AddEditCostingModal({ item, onClose, onSave }) {
  const isEditing = Boolean(item?.id);
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [sellingPrice, setSellingPrice] = useState(item?.sellingPrice !== undefined ? item.sellingPrice : "");
  const [cuttingRate, setCuttingRate] = useState(item?.cuttingRate !== undefined ? item.cuttingRate : "");
  const [stitchingRate, setStitchingRate] = useState(item?.stitchingRate !== undefined ? item.stitchingRate : "");
  const [checkingRate, setCheckingRate] = useState(item?.checkingRate !== undefined ? item.checkingRate : "");
  const [packingRate, setPackingRate] = useState(item?.packingRate !== undefined ? item.packingRate : "");

  const [addons, setAddons] = useState(() => normaliseList(item?.addons).map((addon) => ({ ...emptyAddon(), ...normalizeAddon(addon), id: addon.id || genId("ADDON") })));

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

  function addAddon() { setAddons((current) => [...current, emptyAddon()]); }
  function updateAddon(index, field, value) { setAddons((current) => current.map((addon, addonIndex) => addonIndex === index ? { ...addon, [field]: value } : addon)); }
  function removeAddon(index) { setAddons((current) => current.filter((_, addonIndex) => addonIndex !== index)); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    const payload = {
      ...(isEditing ? { id: item.id } : {}),
      name: name.trim(),
      description: description.trim(),
      sellingPrice: Number(sellingPrice) || 0,
      cuttingRate: Number(cuttingRate) || 0,
      stitchingRate: Number(stitchingRate) || 0,
      checkingRate: Number(checkingRate) || 0,
      packingRate: Number(packingRate) || 0,
      measurements: [],
      addons: addons.filter((addon) => addon.name?.trim()).map((addon) => {
        const n = normalizeAddon(addon);
        return {
          ...n,
          name: n.name.trim(),
          sellingPrice: normalizeRateField(n.sellingPrice),
          cuttingRate: normalizeRateField(n.cuttingRate),
          stitchingRate: normalizeRateField(n.stitchingRate),
          checkingRate: normalizeRateField(n.checkingRate),
          packingRate: normalizeRateField(n.packingRate),
          addonRate: normalizeRateField(n.addonRate),
          requiresStations: n.requiresStations,
          afterStation: n.afterStation,
        };
      }),
    };

    try {
      const res = await apiFetch(isEditing ? `/api/articles/${item.id}` : "/api/articles", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await readApiError(res, "Could not save article"));
        return;
      }
      const saved = await res.json();
      onSave(saved);
    } catch (err) {
      console.error(err);
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]">
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
            <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
              Catalog hint — customer price can be overridden on the order. Size is set on the order.
            </p>
          </div>

          <section className="rounded-2xl p-4 sm:p-5 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: COLORS.ink }}><WrenchIcon /> Add-ons</h4>
                <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>Extras like Button — paid separately in daily entry after required stations.</p>
              </div>
              <button type="button" className="btn-primary shrink-0 text-[11.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.inkSurface }} onClick={addAddon}>+ Add add-on</button>
            </div>
            {addons.length === 0 ? (
              <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>No add-ons yet.</p>
            ) : addons.map((addon, index) => (
              <div key={addon.id || index} className="rounded-xl overflow-hidden mb-4 last:mb-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: COLORS.goldSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>Add-on {index + 1}</span>
                  <button type="button" className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ color: COLORS.rust }} onClick={() => removeAddon(index)}>Remove</button>
                </div>
                <div className="p-4">
                  <div className="mb-4">
                    <label className="form-label">Add-on name</label>
                    <input className="form-input" value={addon.name || ""} onChange={(e) => updateAddon(index, "name", e.target.value)} placeholder="e.g. Button" />
                  </div>
                  <AddonConfigFields addon={addon} onChange={(field, value) => updateAddon(index, field, value)} />
                </div>
              </div>
            ))}
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
              style={{ background: COLORS.gold, color: COLORS.inkSurface, opacity: name.trim() ? 1 : 0.5 }}
            >
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Product Costing"}
            </button>
          </div>
        </form>
      </div>
    </ModalLayer>
  );
}

function DeleteCostingModal({ item, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  if (!item) return null;

  async function handleConfirm() {
    setDeleting(true);
    setError("");
    try {
      await onConfirm(item.id);
    } catch (err) {
      setError(err?.message || "Could not delete");
      setDeleting(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-center justify-center p-4">
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
        {error && <p className="text-[12px] mb-3" style={{ color: COLORS.rust }}>{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: COLORS.rust, color: COLORS.card, opacity: deleting ? 0.7 : 1 }}
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete Item"}
          </button>
        </div>
      </div>
    </ModalLayer>
  );
}

export default function CostingPage() {
  const [catalogTab, setCatalogTab] = useState("articles");
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  const [costingItems, setCostingItems] = useState([]);
  const [sets, setSets] = useState([]);
  const [setEditor, setSetEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setLoading(true);
      setLoadError("");
      try {
        const [articlesRes, setsRes] = await Promise.all([
          apiFetch("/api/articles"),
          apiFetch("/api/sets"),
        ]);
        if (!articlesRes.ok) throw new Error(await readApiError(articlesRes, "Failed to load articles"));
        if (!setsRes.ok) throw new Error(await readApiError(setsRes, "Failed to load sets"));
        const [articles, setsData] = await Promise.all([articlesRes.json(), setsRes.json()]);
        if (cancelled) return;
        setCostingItems(Array.isArray(articles) ? articles : []);
        setSets(Array.isArray(setsData) ? setsData : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(err.message || "Could not load catalog from server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCatalog();
    return () => { cancelled = true; };
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
      if (exists) return prev.map((i) => (i.id === data.id ? data : i));
      return [data, ...prev];
    });
    setIsAddModalOpen(false);
    setEditingItem(null);
  }

  async function handleDeleteCosting(id) {
    const res = await apiFetch(`/api/articles/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readApiError(res, "Failed to delete article"));
    setCostingItems((prev) => prev.filter((item) => item.id !== id));
    setDeletingItem(null);
  }

  async function handleSaveSet(data) {
    const isEdit = Boolean(data.id && sets.some((s) => s.id === data.id));
    const res = await apiFetch(isEdit ? `/api/sets/${data.id}` : "/api/sets", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Failed to save set"));
    const saved = await res.json();
    setSets((prev) => {
      const exists = prev.some((s) => s.id === saved.id);
      if (exists) return prev.map((s) => (s.id === saved.id ? saved : s));
      return [saved, ...prev];
    });
    setSetEditor(null);
  }

  async function handleDeleteSet(id) {
    const res = await apiFetch(`/api/sets/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readApiError(res, "Failed to delete set"));
    setSets((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <AppShell
      title={setEditor ? (setEditor.id ? "Edit set" : "New set") : "Item Costing"}
      subtitle={setEditor ? "Step-by-step set builder" : "Articles and sets with workstation pricing"}
      maxWidth="80rem"
      actions={
        !setEditor && catalogTab === "articles" ? (
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-xl shrink-0"
            style={{ background: COLORS.gold, color: COLORS.inkSurface }}
            onClick={() => setIsAddModalOpen(true)}
          >
            <PlusIcon /> Add Article
          </button>
        ) : null
      }
    >
        {setEditor ? (
          <SetEditorPage
            initialSet={setEditor}
            onSave={handleSaveSet}
            onCancel={() => setSetEditor(null)}
          />
        ) : (
        <>
          {loading ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>Loading catalog…</p>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <p className="text-[14px] font-semibold mb-2" style={{ color: COLORS.rust }}>Could not load catalog</p>
              <p className="text-[13px] mb-4" style={{ color: COLORS.graphite }}>{loadError}</p>
              <button
                type="button"
                className="text-[12.5px] font-semibold px-4 py-2 rounded-lg"
                style={{ background: COLORS.gold, color: COLORS.inkSurface }}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          ) : (
          <>
          <div className="segmented mb-6">
            {[
              ["articles", "Articles"],
              ["sets", "Sets"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCatalogTab(id)}
                style={{
                  background: catalogTab === id ? COLORS.inkSurface : "transparent",
                  color: catalogTab === id ? COLORS.onDark : COLORS.graphite,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {catalogTab === "articles" && (
          <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<TagIcon />} label="Total Articles" value={totalProducts} sub="Active products" />
            <MiniStat index={1} icon={<WrenchIcon />} label="Avg Station Labor" value={formatPKR(avgStationLabor)} sub="across 4 stations" />
            <MiniStat index={2} icon={<ProfitIcon />} label="Avg Profit / Item" value={formatPKR(avgProfit)} sub="net profit margin" />
            <MiniStat index={3} icon={<LayersIcon />} label="Avg Margin" value={`${avgMargin.toFixed(1)}%`} sub="overall average" />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="search-wrap">
              <SearchIcon />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name or Article ID" />
            </div>
            <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>{filtered.length} articles found</span>
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
                <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>
                  {search.trim() ? "No articles match your search query." : "No articles yet — click Add Article to create one."}
                </p>
              </div>
            )}
          </div>
          </>
          )}

          {catalogTab === "sets" && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="search-wrap">
                  <SearchIcon />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search set name or ID" />
                </div>
                <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>{sets.length} sets</span>
              </div>
              <SetBuilderSection
                sets={sets}
                search={search}
                onCreate={() => setSetEditor({})}
                onEdit={(s) => setSetEditor(s)}
                onDelete={handleDeleteSet}
              />
            </>
          )}
          </>
          )}
        </>
        )}

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
    </AppShell>
  );
}