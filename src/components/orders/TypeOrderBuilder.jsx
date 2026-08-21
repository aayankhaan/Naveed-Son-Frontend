import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "../../constants/theme";
import {
  emptyTypeBlock,
  flattenTypeOrderToLines,
  formatPKR,
  suggestSizeIdFromMeasurement,
  typeCompanyTotal,
  typeLabourPreview,
} from "../../lib/orderFromType";
import { genId } from "../../lib/costingV2";
import {
  emptyDesignColor,
  equalSplit,
  designColorSplitError,
} from "../../lib/orderDesignColor";
import { DepartmentToggles, DEFAULT_DEPARTMENTS } from "./SetOrderBuilder";

function findArticle(articles, id) {
  return (articles || []).find((a) => a.id === id) || null;
}

function findType(article, typeId) {
  return (article?.types || []).find((t) => t.id === typeId) || null;
}

function TypeBlockCard({ block, articles, onChange, onRemove, canRemove }) {
  const article = findArticle(articles, block.articleId);
  const type = findType(article, block.typeId);
  const materials = type?.materials || [];
  const sizes = type?.sizes || [];
  const parts = type?.parts || [];
  const addons = type?.addons || [];
  const packingOptions = type?.packingOptions || [];

  const company = type && block.materialId && block.sizeId
    ? typeCompanyTotal(type, block.materialId, block.sizeId, block.addonIds, block.packingOptionId)
    : 0;
  const labor = type && block.sizeId
    ? typeLabourPreview(type, block.sizeId, block.addonIds, block.packingOptionId)
    : 0;
  const override =
    block.orderPriceOverride === "" || block.orderPriceOverride == null
      ? null
      : Number(block.orderPriceOverride);
  const sell = override != null && Number.isFinite(override) ? override : company;
  const qty = Math.max(1, Number(block.orderQuantity) || 1);
  const splitError = designColorSplitError(
    block.designColors,
    block.splitMode,
    qty
  );

  function patch(partial) {
    onChange({ ...block, ...partial });
  }

  function setArticle(articleId) {
    const a = findArticle(articles, articleId);
    const t = a?.types?.[0] || null;
    patch({
      articleId,
      typeId: t?.id || "",
      materialId: t?.materials?.[0]?.id || "",
      sizeId: t?.sizes?.[0]?.id || "",
      packingOptionId: t?.packingOptions?.[0]?.id || "",
      addonIds: [],
      measurement: "",
    });
  }

  function setType(typeId) {
    const t = findType(article, typeId);
    patch({
      typeId,
      materialId: t?.materials?.[0]?.id || "",
      sizeId: t?.sizes?.[0]?.id || "",
      packingOptionId: t?.packingOptions?.[0]?.id || "",
      addonIds: [],
    });
  }

  function onMeasurement(value) {
    const next = { measurement: value };
    if (sizes.length) {
      const suggested = suggestSizeIdFromMeasurement(value, sizes);
      if (suggested) next.sizeId = suggested;
    }
    patch(next);
  }

  function toggleAddon(id) {
    const set = new Set(block.addonIds || []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch({ addonIds: [...set] });
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: COLORS.bone, border: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-[13px] font-semibold text-left"
          style={{ color: COLORS.ink }}
          onClick={() => patch({ expanded: !block.expanded })}
        >
          {block.expanded ? "▾" : "▸"}{" "}
          {article?.name || "Select article"}
          {type ? ` · ${type.name}` : ""}
        </button>
        {canRemove && (
          <button
            type="button"
            className="text-[12px] font-medium"
            style={{ color: COLORS.rust }}
            onClick={onRemove}
          >
            Remove
          </button>
        )}
      </div>

      {block.expanded !== false && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Article</label>
              <select
                className="form-input"
                value={block.articleId}
                onChange={(e) => setArticle(e.target.value)}
              >
                <option value="">Select…</option>
                {(articles || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Type</label>
              <select
                className="form-input"
                value={block.typeId}
                onChange={(e) => setType(e.target.value)}
                disabled={!article}
              >
                <option value="">Select…</option>
                {(article?.types || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {type?.description ? (
            <p
              className="text-[12px] rounded-lg px-3 py-2"
              style={{ background: COLORS.card, color: COLORS.graphite }}
            >
              {type.description}
            </p>
          ) : null}

          {type && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Material</label>
                  <select
                    className="form-input"
                    value={block.materialId}
                    onChange={(e) => patch({ materialId: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Measurement</label>
                  <input
                    className="form-input"
                    value={block.measurement}
                    onChange={(e) => onMeasurement(e.target.value)}
                    placeholder="e.g. 220x240"
                  />
                  <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                    Larger side ≥ 200 → Double (you can still change size)
                  </p>
                </div>
              </div>

              <div>
                <label className="form-label">Catalog size (rates)</label>
                <select
                  className="form-input max-w-xs"
                  value={block.sizeId}
                  onChange={(e) => patch({ sizeId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {sizes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {packingOptions.length > 0 && (
                <div>
                  <label className="form-label">Packing type</label>
                  <select
                    className="form-input max-w-md"
                    value={block.packingOptionId || packingOptions[0]?.id || ""}
                    onChange={(e) => patch({ packingOptionId: e.target.value })}
                  >
                    {packingOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || "Packing"} — labour {formatPKR(p.labourRate)} · company {formatPKR(p.companyRate)}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                    Labour paid 1× per set; company sell added to price
                  </p>
                </div>
              )}

              {parts.length > 0 && (
                <div className="text-[12px]" style={{ color: COLORS.graphite }}>
                  <span className="font-semibold" style={{ color: COLORS.ink }}>Parts / set: </span>
                  {parts.map((p) => {
                    const q = Number(p.qtyBySize?.[block.sizeId] ?? 1) || 1;
                    return `${q}× ${p.name}`;
                  }).join(" + ")}
                  <span style={{ color: COLORS.graphiteLight }}> · packing 1×</span>
                </div>
              )}

              {addons.length > 0 && (
                <div>
                  <div className="form-label mb-1.5">Add-ons</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {addons.map((a) => (
                      <label key={a.id} className="flex items-center gap-1.5 text-[12.5px]">
                        <input
                          type="checkbox"
                          checked={(block.addonIds || []).includes(a.id)}
                          onChange={() => toggleAddon(a.id)}
                        />
                        {a.name}
                        <span style={{ color: COLORS.graphiteLight }}>
                          (+{formatPKR(a.companyRate)} / pay {formatPKR(a.addonRate)})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">
                    {parts.length ? "Sets" : "Qty"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={block.orderQuantity}
                    onChange={(e) => patch({ orderQuantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Pack / CTN</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={block.packPerCtn}
                    onChange={(e) => patch({ packPerCtn: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Company</label>
                  <div className="form-input" style={{ background: COLORS.card }}>
                    {formatPKR(company)}
                  </div>
                </div>
                <div>
                  <label className="form-label">Custom sell</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="form-input"
                    value={block.orderPriceOverride}
                    onChange={(e) => patch({ orderPriceOverride: e.target.value })}
                    placeholder={String(company || 0)}
                  />
                </div>
              </div>

              <div
                className="rounded-xl px-3 py-2 text-[12px] flex flex-wrap gap-x-4 gap-y-1"
                style={{ background: COLORS.card }}
              >
                <span style={{ color: COLORS.graphite }}>
                  Labour {formatPKR(labor)}
                </span>
                <span style={{ color: COLORS.graphite }}>
                  Sell {formatPKR(sell)}
                  {override != null ? " (custom)" : ""}
                </span>
                <span style={{ color: sell - labor >= 0 ? COLORS.green : COLORS.rust }}>
                  Profit {formatPKR(sell - labor)} / {parts.length ? "set" : "pc"}
                </span>
                <span style={{ color: COLORS.graphiteLight }}>
                  Line total {formatPKR(sell * qty)}
                </span>
              </div>

              <DepartmentToggles
                value={block.departments}
                onChange={(departments) => patch({ departments })}
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="form-label mb-0">Designs / colors</div>
                  <button
                    type="button"
                    className="text-[12px] font-semibold"
                    style={{ color: COLORS.goldDim }}
                    onClick={() =>
                      patch({ designColors: [...(block.designColors || []), emptyDesignColor()] })
                    }
                  >
                    + Design
                  </button>
                </div>
                {(block.designColors || []).length === 0 ? (
                  <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>
                    Optional — leave empty for Default
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-3 text-[12px]">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={block.splitMode !== "custom"}
                          onChange={() => patch({ splitMode: "equal" })}
                        />
                        Equal split
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={block.splitMode === "custom"}
                          onChange={() => patch({ splitMode: "custom" })}
                        />
                        Custom qty
                      </label>
                    </div>
                    {(block.designColors || []).map((dc) => (
                      <div key={dc.id} className="flex flex-wrap gap-2 items-center">
                        <input
                          className="form-input flex-1 min-w-[8rem]"
                          value={dc.name}
                          onChange={(e) =>
                            patch({
                              designColors: block.designColors.map((x) =>
                                x.id === dc.id ? { ...x, name: e.target.value } : x
                              ),
                            })
                          }
                          placeholder="Design name"
                        />
                        {block.splitMode === "custom" && (
                          <input
                            type="number"
                            min="0"
                            className="form-input w-24"
                            value={dc.quantity}
                            onChange={(e) =>
                              patch({
                                designColors: block.designColors.map((x) =>
                                  x.id === dc.id ? { ...x, quantity: e.target.value } : x
                                ),
                              })
                            }
                            placeholder="Qty"
                          />
                        )}
                        <button
                          type="button"
                          className="text-[12px]"
                          style={{ color: COLORS.rust }}
                          onClick={() =>
                            patch({
                              designColors: block.designColors.filter((x) => x.id !== dc.id),
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {block.splitMode !== "custom" && (block.designColors || []).filter((d) => d.name?.trim()).length > 1 && (
                      <p className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                        Equal:{" "}
                        {Object.values(
                          equalSplit(
                            qty,
                            block.designColors.filter((d) => d.name?.trim()).map((d) => d.id)
                          )
                        ).join(" / ")}
                      </p>
                    )}
                    {splitError && (
                      <p className="text-[12px]" style={{ color: COLORS.rust }}>{splitError}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Builds type-based order lines. Calls onDraftChange({ canApply, lines, error, grandTotal }).
 */
export default function TypeOrderBuilder({ articles, onDraftChange, initialBlocks }) {
  const [blocks, setBlocks] = useState(() =>
    initialBlocks?.length ? initialBlocks : [emptyTypeBlock(articles)]
  );
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    if (!articles?.length) {
      onDraftChangeRef.current?.({
        canApply: false,
        lines: [],
        error: "No articles in catalog",
        grandTotal: 0,
      });
      return;
    }

    const lines = [];
    let error = null;
    let grand = 0;

    for (const block of blocks) {
      const article = findArticle(articles, block.articleId);
      const type = findType(article, block.typeId);
      if (!article || !type) {
        error = error || "Select article and type on each block";
        continue;
      }
      if (!block.materialId || !block.sizeId) {
        error = error || "Select material and size";
        continue;
      }
      const dept = { ...DEFAULT_DEPARTMENTS, ...(block.departments || {}) };
      if (!dept.cutting && !dept.stitching && !dept.checking && !dept.packing) {
        error = error || "Enable at least one department";
        continue;
      }
      const qty = Number(block.orderQuantity) || 0;
      if (qty <= 0) {
        error = error || "Quantity must be > 0";
        continue;
      }
      const splitErr = designColorSplitError(block.designColors, block.splitMode, qty);
      if (splitErr) {
        error = error || splitErr;
        continue;
      }

      const company = typeCompanyTotal(type, block.materialId, block.sizeId, block.addonIds);
      const override =
        block.orderPriceOverride === "" || block.orderPriceOverride == null
          ? null
          : Number(block.orderPriceOverride);
      const sell = override != null && Number.isFinite(override) ? override : company;
      grand += sell * qty;

      const flat = flattenTypeOrderToLines(article, type, {
        ...block,
        groupId: block.key,
        departments: dept,
      });
      lines.push(...flat);
    }

    onDraftChangeRef.current?.({
      canApply: lines.length > 0 && !error,
      lines,
      error,
      grandTotal: grand,
    });
  }, [blocks, articles]);

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <TypeBlockCard
          key={block.key}
          block={block}
          articles={articles}
          canRemove={blocks.length > 1}
          onChange={(next) =>
            setBlocks((prev) => prev.map((b) => (b.key === next.key ? next : b)))
          }
          onRemove={() => setBlocks((prev) => prev.filter((b) => b.key !== block.key))}
        />
      ))}
      <button
        type="button"
        className="text-[12.5px] font-semibold px-3 py-2 rounded-lg"
        style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
        onClick={() => setBlocks((prev) => [...prev, emptyTypeBlock(articles)])}
      >
        + Add item
      </button>
      {!articles?.length && (
        <p className="text-[12.5px]" style={{ color: COLORS.rust }}>
          No articles yet — add them in Item Costing first.
        </p>
      )}
    </div>
  );
}

/** Rebuild blocks from a saved order (type-based meta). */
export function typeBlocksFromOrder(order, articles) {
  const lines = order?.lines || [];
  const groups = new Map();
  for (const line of lines) {
    const meta = line.set_order_meta || line.set_meta || {};
    const key = meta.groupId || meta.setId || line.article_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }

  const blocks = [];
  for (const [key, group] of groups) {
    const first = group[0];
    const meta = first.set_order_meta || first.set_meta || {};
    const typeId = meta.typeId || meta.setId || String(first.article_id).split(":")[0];
    let articleId = meta.articleId || "";
    if (!articleId) {
      const art = (articles || []).find((a) => (a.types || []).some((t) => t.id === typeId));
      articleId = art?.id || "";
    }
    blocks.push({
      key: key || genId("TYPE-BLOCK"),
      articleId,
      typeId,
      materialId: meta.materialId || "",
      sizeId: meta.sizeId || "",
      packingOptionId: meta.packingOptionId || "",
      measurement: meta.measurement || meta.sizeText || first.dimension_name || "",
      orderQuantity: meta.orderQuantity || Math.max(1, Number(first.quantity) || 1),
      packPerCtn: first.pack_per_ctn || 6,
      orderPriceOverride:
        meta.orderPriceOverride != null ? String(meta.orderPriceOverride) : "",
      addonIds: meta.addonIds || [],
      departments: meta.departments || { ...DEFAULT_DEPARTMENTS },
      designColors: meta.designColors?.length
        ? meta.designColors
        : [],
      splitMode: meta.splitMode || "equal",
      expanded: true,
    });
  }
  return blocks.length ? blocks : [emptyTypeBlock(articles)];
}
