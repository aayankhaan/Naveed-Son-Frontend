import { useState, useMemo, useEffect, useRef } from "react";
import { COLORS } from "../../constants/theme";
import {
  calcSetOrderBreakdown,
  setArticlesToOrderParts,
  formatPKR,
  getSetArticle,
  normalizeAddon,
  genId,
} from "../../lib/manufacturingPricing";
import {
  emptyDesignColor,
  equalSplit,
  designColorSplitError,
} from "../../lib/orderDesignColor";

export const DEFAULT_DEPARTMENTS = {
  cutting: true,
  stitching: true,
  checking: true,
  packing: true,
};

export const DEPARTMENT_OPTIONS = [
  { key: "cutting", label: "Cutting" },
  { key: "stitching", label: "Stitching" },
  { key: "checking", label: "Checking" },
  { key: "packing", label: "Packing" },
];

export function DepartmentToggles({ value, onChange }) {
  const dept = { ...DEFAULT_DEPARTMENTS, ...(value || {}) };
  return (
    <div className="rounded-xl p-3" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
      <div className="form-label mb-2">Departments for this order</div>
      <p className="text-[11px] mb-2.5" style={{ color: COLORS.graphiteLight }}>
        Checked = work on this order. Uncheck any station you want to skip.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {DEPARTMENT_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-[12.5px] font-medium cursor-pointer" style={{ color: COLORS.ink }}>
            <input
              type="checkbox"
              checked={Boolean(dept[opt.key])}
              onChange={(e) => onChange({ ...dept, [opt.key]: e.target.checked })}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function buildSetPayloads(blocks, sets) {
  return blocks.map((block) => {
    const set = sets.find((s) => s.id === block.setId);
    return {
      set,
      setOrder: {
        groupId: block.key,
        setId: block.setId,
        configurationId: null,
        sizeText: (block.sizeText || "").trim(),
        designColors: (block.designColors || []).filter((dc) => dc.name?.trim()),
        splitMode: block.splitMode,
        orderQuantity: block.orderQuantity,
        parts: (block.parts || []).map((p) => ({
          setArticleId: p.setArticleId,
          quantityPerSet: p.quantityPerSet,
          addonIds: p.addonIds || [],
          sizeNote: p.sizeNote || "",
        })),
        packPerCtn: block.packPerCtn,
        orderPriceOverride: block.orderPriceOverride === "" ? null : Number(block.orderPriceOverride) || 0,
        departments: { ...DEFAULT_DEPARTMENTS, ...(block.departments || {}) },
      },
    };
  });
}

function emptySetBlock(sets) {
  const set = sets[0] || null;
  return {
    key: genId("SET-BLOCK"),
    setId: set?.id || "",
    sizeText: "",
    orderQuantity: 1,
    packPerCtn: 6,
    orderPriceOverride: "",
    splitMode: "equal",
    designColors: [],
    departments: { ...DEFAULT_DEPARTMENTS },
    parts: set ? setArticlesToOrderParts(set.articles) : [],
    expanded: true,
  };
}

function SetBlockCard({
  block,
  index,
  sets,
  canRemove,
  onChange,
  onRemove,
  onToggle,
}) {
  const selectedSet = sets.find((s) => s.id === block.setId);
  const namedDesignColors = (block.designColors || []).filter((dc) => dc.name?.trim());
  const designSplitError = designColorSplitError(block.designColors, block.splitMode, block.orderQuantity);
  const equalSetPreview =
    block.splitMode === "equal" && namedDesignColors.length > 1
      ? equalSplit(block.orderQuantity, namedDesignColors.map((dc) => dc.id))
      : null;
  const customSetSum = namedDesignColors.reduce((s, dc) => s + (Number(dc.quantity) || 0), 0);

  const breakdown = useMemo(() => {
    if (!selectedSet || !block.parts.length) return null;
    return calcSetOrderBreakdown(selectedSet, null, block.parts, block.orderQuantity, {
      orderPriceOverride: block.orderPriceOverride === "" ? null : block.orderPriceOverride,
      departments: block.departments,
      sizeText: block.sizeText,
    });
  }, [selectedSet, block.parts, block.orderQuantity, block.orderPriceOverride, block.departments, block.sizeText]);

  function patch(partial) {
    onChange({ ...block, ...partial });
  }

  function loadFromSet(setId) {
    const set = sets.find((s) => s.id === setId);
    patch({
      setId,
      sizeText: "",
      orderPriceOverride: "",
      designColors: [],
      splitMode: "equal",
      parts: set ? setArticlesToOrderParts(set.articles) : [],
    });
  }

  function updatePart(partIndex, partPatch) {
    patch({
      parts: block.parts.map((p, i) => (i === partIndex ? { ...p, ...partPatch } : p)),
    });
  }

  function addDesignColor() {
    patch({ designColors: [...(block.designColors || []), emptyDesignColor()] });
  }

  function updateDesignColor(dcId, field, value) {
    patch({
      designColors: (block.designColors || []).map((dc) => (dc.id === dcId ? { ...dc, [field]: value } : dc)),
    });
  }

  function removeDesignColor(dcId) {
    patch({ designColors: (block.designColors || []).filter((dc) => dc.id !== dcId) });
  }

  const title = selectedSet?.name?.trim() || `Set ${index + 1}`;
  const sizeLabel = (block.sizeText || "").trim() || "No size";
  const summary = `${sizeLabel} · ${Number(block.orderQuantity || 0).toLocaleString()} sets`;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${block.expanded ? COLORS.gold : COLORS.border}`, background: COLORS.boneDim }}>
      <button type="button" className="w-full flex items-center gap-3 px-4 py-3.5 text-left" onClick={onToggle}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: COLORS.ink, color: COLORS.gold }}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold truncate" style={{ color: COLORS.ink }}>{title}</div>
          <div className="text-[11px] mt-0.5 truncate" style={{ color: COLORS.graphiteLight }}>{summary}</div>
        </div>
        {designSplitError && <span className="text-[10px] font-semibold shrink-0" style={{ color: COLORS.rust }}>Fix split</span>}
        {breakdown && !designSplitError && (
          <span className="text-[11px] font-semibold shrink-0 px-2 py-1 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
            {formatPKR(breakdown.totalSelling)}
          </span>
        )}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0" style={{ transform: block.expanded ? "rotate(180deg)" : "none" }}>
          <path d="M3.5 5.5L7 9l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {block.expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <div>
              <label className="form-label">Set *</label>
              <select className="form-input" value={block.setId} onChange={(e) => loadFromSet(e.target.value)}>
                {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Size</label>
              <input
                className="form-input"
                value={block.sizeText}
                onChange={(e) => patch({ sizeText: e.target.value })}
                placeholder="e.g. 140x200"
              />
            </div>
            <div>
              <label className="form-label">Quantity (sets) *</label>
              <input type="number" min="1" className="form-input" value={block.orderQuantity} onChange={(e) => patch({ orderQuantity: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="form-label">Pack / CTN</label>
              <input type="number" min="1" className="form-input" value={block.packPerCtn} onChange={(e) => patch({ packPerCtn: Number(e.target.value) || 6 })} />
            </div>
          </div>

          <DepartmentToggles
            value={block.departments}
            onChange={(departments) => patch({ departments })}
          />

          <section className="rounded-xl p-3" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="form-label mb-0">Design / Color</label>
              <div className="flex items-center gap-2">
                {namedDesignColors.length > 1 && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold">
                    <button type="button" style={{ padding: "3px 9px", borderRadius: 6, background: block.splitMode === "equal" ? COLORS.gold : COLORS.card, color: COLORS.ink, border: `1px solid ${COLORS.border}` }} onClick={() => patch({ splitMode: "equal" })}>Equal</button>
                    <button type="button" style={{ padding: "3px 9px", borderRadius: 6, background: block.splitMode === "custom" ? COLORS.gold : COLORS.card, color: COLORS.ink, border: `1px solid ${COLORS.border}` }} onClick={() => patch({ splitMode: "custom" })}>Custom</button>
                  </div>
                )}
                <button type="button" className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }} onClick={addDesignColor}>+ Add</button>
              </div>
            </div>
            {(block.designColors || []).length === 0 ? (
              <p className="text-[11px]" style={{ color: COLORS.graphiteLight }}>Optional — e.g. Olive green, Sunflower yellow</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {(block.designColors || []).map((dc) => (
                  <div key={dc.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <input className="form-input flex-1 min-w-[120px]" value={dc.name} onChange={(e) => updateDesignColor(dc.id, "name", e.target.value)} placeholder="e.g. Olive green" />
                    <input className="form-input" style={{ width: 110 }} value={dc.barcode} onChange={(e) => updateDesignColor(dc.id, "barcode", e.target.value)} placeholder="barcode" />
                    {namedDesignColors.length > 1 ? (
                      block.splitMode === "custom" ? (
                        <input type="number" className="form-input text-right" style={{ width: 72 }} value={dc.quantity} onChange={(e) => updateDesignColor(dc.id, "quantity", e.target.value)} placeholder="sets" />
                      ) : (
                        <span className="text-[12px] font-semibold shrink-0 w-[72px] text-right" style={{ color: COLORS.graphite }}>
                          {dc.name.trim() ? (equalSetPreview?.[dc.id] ?? 0).toLocaleString() : "—"}
                        </span>
                      )
                    ) : (
                      <span className="text-[12px] font-semibold shrink-0 w-[72px] text-right" style={{ color: COLORS.graphite }}>
                        {dc.name.trim() ? Number(block.orderQuantity).toLocaleString() : "—"}
                      </span>
                    )}
                    <button type="button" className="text-[11px] font-semibold" style={{ color: COLORS.rust }} onClick={() => removeDesignColor(dc.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            {namedDesignColors.length > 1 && (
              <p className="text-[11px] mt-2" style={{ color: designSplitError ? COLORS.rust : COLORS.graphiteLight }}>
                {block.splitMode === "custom"
                  ? `Split: ${customSetSum.toLocaleString()} / ${Number(block.orderQuantity).toLocaleString()} sets`
                  : "Sets split evenly across designs"}
              </p>
            )}
          </section>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphiteLight }}>Parts in this set</div>
            {block.parts.map((part, partIndex) => {
              const article = getSetArticle(selectedSet, part.setArticleId);
              const requiredQty = Number(block.orderQuantity) * (Number(part.quantityPerSet) || 0);
              return (
                <div key={partIndex} className="rounded-xl p-3" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>{article?.name || "Part"}</span>
                    <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>{requiredQty.toLocaleString()} pcs total</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Qty / set</label>
                      <input type="number" min="1" className="form-input" value={part.quantityPerSet} onChange={(e) => updatePart(partIndex, { quantityPerSet: Number(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <label className="form-label">Part size note</label>
                      <input className="form-input" value={part.sizeNote || ""} onChange={(e) => updatePart(partIndex, { sizeNote: e.target.value })} placeholder="optional" />
                    </div>
                  </div>
                  {(article?.addons || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {article.addons.map((addon) => {
                        const n = normalizeAddon(addon);
                        const bits = [];
                        if (n.sellingPrice != null) bits.push(`+${formatPKR(n.sellingPrice)}`);
                        if (n.addonRate != null) bits.push(`pay ${formatPKR(n.addonRate)}`);
                        const req = (n.requiresStations || []).map((s) => s.slice(0, 3)).join("+");
                        if (req) bits.push(`after ${req}`);
                        return (
                          <label key={addon.id} className="flex items-center gap-2 text-[12px]">
                            <input
                              type="checkbox"
                              checked={(part.addonIds || []).includes(addon.id)}
                              onChange={(e) => {
                                const ids = part.addonIds || [];
                                updatePart(partIndex, {
                                  addonIds: e.target.checked ? [...ids, addon.id] : ids.filter((id) => id !== addon.id),
                                });
                              }}
                            />
                            {addon.name}{bits.length ? ` (${bits.join(" · ")})` : ""}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {breakdown && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.goldDim }}>
                Price per set (PPP)
              </div>
              <div className="flex justify-between text-[12px]" style={{ color: COLORS.graphite }}>
                <span>Labor (selected depts)</span>
                <span>
                  {formatPKR(breakdown.setLaborPerUnit)}
                  {breakdown.setLaborPerUnit !== breakdown.setLaborFullPerUnit && (
                    <span className="ml-1 line-through opacity-60">{formatPKR(breakdown.setLaborFullPerUnit)}</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-[12px]" style={{ color: COLORS.graphite }}>
                <span>Target margin</span>
                <span>{breakdown.targetMarginPercent}%</span>
              </div>
              <div className="flex justify-between text-[13px] font-semibold" style={{ color: COLORS.ink }}>
                <span>Suggested PPP / set</span>
                <span style={block.orderPriceOverride !== "" ? { textDecoration: "line-through" } : undefined}>
                  {formatPKR(breakdown.suggestedSellingPerUnit)}
                </span>
              </div>
              <div>
                <label className="form-label">Your price / set (optional)</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={block.orderPriceOverride}
                  onChange={(e) => patch({ orderPriceOverride: e.target.value })}
                  placeholder="Leave empty for suggested"
                />
              </div>
              <div className="flex justify-between text-[12px]" style={{ color: COLORS.graphite }}>
                <span>Profit / set · margin</span>
                <span style={{ color: COLORS.green }}>
                  {formatPKR(breakdown.setProfitPerUnit)} · {breakdown.realizedMarginPercent}%
                </span>
              </div>
              <div className="flex justify-between font-semibold text-[13px] pt-1" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <span>This set total</span>
                <span style={{ color: COLORS.green }}>{formatPKR(breakdown.totalSelling)}</span>
              </div>
            </div>
          )}

          {canRemove && (
            <button type="button" className="text-[12px] font-semibold" style={{ color: COLORS.rust }} onClick={onRemove}>
              Remove this set from order
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SetOrderBuilder({ sets, onDraftChange, initialBlocks }) {
  const [blocks, setBlocks] = useState(() => {
    if (Array.isArray(initialBlocks)) {
      return initialBlocks.length ? JSON.parse(JSON.stringify(initialBlocks)) : [];
    }
    return sets.length ? [emptySetBlock(sets)] : [];
  });

  const validations = useMemo(() => {
    return blocks.map((block) => {
      const set = sets.find((s) => s.id === block.setId);
      const splitErr = designColorSplitError(block.designColors, block.splitMode, block.orderQuantity);
      if (!set || !block.parts.length) return "Pick a set with at least one article";
      if (splitErr) return splitErr;
      if (!(Number(block.orderQuantity) > 0)) return "Quantity must be at least 1";
      const dept = { ...DEFAULT_DEPARTMENTS, ...(block.departments || {}) };
      if (!DEPARTMENT_OPTIONS.some((o) => dept[o.key])) return "Select at least one department";
      return null;
    });
  }, [blocks, sets]);

  const canApply = blocks.length > 0 && validations.every((v) => !v);

  const grandTotal = useMemo(() => {
    return blocks.reduce((sum, block) => {
      const set = sets.find((s) => s.id === block.setId);
      if (!set || !block.parts.length) return sum;
      const b = calcSetOrderBreakdown(set, null, block.parts, block.orderQuantity, {
        orderPriceOverride: block.orderPriceOverride === "" ? null : block.orderPriceOverride,
        departments: block.departments,
        sizeText: block.sizeText,
      });
      return sum + (b.totalSelling || 0);
    }, 0);
  }, [blocks, sets]);

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    onDraftChangeRef.current?.({
      canApply,
      payloads: canApply ? buildSetPayloads(blocks, sets) : [],
      grandTotal,
      error: validations.find(Boolean) || null,
    });
  }, [blocks, sets, canApply, grandTotal, validations]);

  function updateBlock(key, next) {
    setBlocks((current) => current.map((b) => (b.key === key ? next : b)));
  }

  if (!sets.length) {
    return (
      <div className="rounded-xl p-6 text-center text-[13px]" style={{ background: COLORS.boneDim, color: COLORS.graphiteLight }}>
        No sets defined yet. Create sets in Costing first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}>
        Configure one or more sets here. Set size and part quantities on the order — then use <span className="font-semibold" style={{ color: COLORS.ink }}>Add order</span> below to save.
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-2xl px-4 py-8 text-center" style={{ border: `1.5px dashed ${COLORS.boneBorder}`, background: COLORS.card }}>
          <p className="text-[13px] mb-3" style={{ color: COLORS.graphite }}>No sets on this order yet.</p>
          <button
            type="button"
            className="text-[13px] font-semibold px-4 py-2.5 rounded-xl"
            style={{ background: COLORS.gold, color: COLORS.ink }}
            onClick={() => setBlocks([emptySetBlock(sets)])}
          >
            + Add a set
          </button>
        </div>
      ) : (
        blocks.map((block, index) => (
          <SetBlockCard
            key={block.key}
            block={block}
            index={index}
            sets={sets}
            canRemove
            onChange={(next) => updateBlock(block.key, next)}
            onRemove={() => setBlocks((current) => current.filter((b) => b.key !== block.key))}
            onToggle={() => updateBlock(block.key, { ...block, expanded: !block.expanded })}
          />
        ))
      )}

      {blocks.length > 0 && (
        <button
          type="button"
          className="w-full py-3.5 rounded-2xl text-[13px] font-semibold border-2 border-dashed"
          style={{ borderColor: COLORS.boneBorder, color: COLORS.goldDim, background: COLORS.card }}
          onClick={() => setBlocks((current) => {
            const next = emptySetBlock(sets);
            return [...current.map((b) => ({ ...b, expanded: false })), next];
          })}
        >
          + Add another set
        </button>
      )}

      {validations.some(Boolean) && (
        <p className="text-[12px] text-center" style={{ color: COLORS.rust }}>
          {validations.find(Boolean)}
        </p>
      )}

      <div className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
        <div className="text-[13px]" style={{ color: COLORS.graphite }}>
          <span className="font-semibold" style={{ color: COLORS.ink }}>{blocks.length}</span> set{blocks.length === 1 ? "" : "s"} · Est. total{" "}
          <span className="font-semibold" style={{ color: COLORS.green }}>{formatPKR(grandTotal)}</span>
        </div>
        <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
          Saves with Add order below
        </span>
      </div>
    </div>
  );
}
