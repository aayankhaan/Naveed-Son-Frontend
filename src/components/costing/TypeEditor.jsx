import { useMemo, useState } from "react";
import { COLORS, FONT } from "../../constants/theme";
import { STATION_ORDER } from "../../lib/productionFlow";
import {
  calcTypeSummary,
  emptyAddonDraft,
  emptyLabour,
  emptyPackingOption,
  formatPKR,
  genId,
  partLabourTotal,
} from "../../lib/costingV2";

function Block({ title, children, action, last }) {
  return (
    <div
      className="py-6"
      style={{ borderBottom: last ? "none" : `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-[13px] font-semibold tracking-tight" style={{ color: COLORS.ink }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChipInput({ values, onChange, placeholder }) {
  const [draft, setDraft] = useState("");

  function add() {
    const name = draft.trim();
    if (!name) return;
    if (values.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, { id: genId(placeholder === "Size" ? "SIZE" : "MAT"), name }]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[28px]">
        {values.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 text-[12px] font-medium pl-2.5 pr-1.5 py-1 rounded-lg"
            style={{ background: COLORS.boneDim, color: COLORS.ink }}
          >
            {v.name}
            <button
              type="button"
              className="w-5 h-5 rounded flex items-center justify-center text-[13px] leading-none"
              style={{ color: COLORS.graphiteLight }}
              onClick={() => onChange(values.filter((x) => x.id !== v.id))}
              aria-label={`Remove ${v.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="form-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`${placeholder}…`}
        />
        <button type="button" className="ghost-btn shrink-0" onClick={add}>Add</button>
      </div>
    </div>
  );
}

function LabourFields({ labour, onChange, stations = STATION_ORDER }) {
  const cols = Math.min(stations.length, 4);
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {stations.map((station) => {
        const key = `${station.toLowerCase()}Rate`;
        const short =
          station === "Stitching"
            ? "Stitch"
            : station === "Checking"
              ? "Check"
              : station === "Packing"
                ? "Pack"
                : "Cut";
        return (
          <div key={station}>
            <label className="form-label text-center">{short}</label>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold"
                style={{ color: COLORS.graphiteLight }}
              >
                ₨
              </span>
              <input
                type="number"
                min="0"
                step="any"
                className="form-input text-right pl-6"
                value={labour?.[key] ?? ""}
                onChange={(e) => onChange({ ...labour, [key]: e.target.value })}
                placeholder="0"
                aria-label={station}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PART_STATIONS = ["Cutting", "Stitching", "Checking"];

function QtyBySizeRow({ sizes, qtyBySize, onChange }) {
  if (!sizes.length) return null;
  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-x-2 gap-y-1.5 min-w-full items-center"
        style={{
          gridTemplateColumns: `minmax(3.5rem, auto) repeat(${sizes.length}, minmax(3.75rem, 1fr))`,
        }}
      >
        <div
          className="text-[10.5px] font-semibold uppercase tracking-wide"
          style={{ color: COLORS.graphite }}
        >
          Qty
        </div>
        {sizes.map((s) => (
          <div
            key={`h-${s.id}`}
            className="text-center text-[10.5px] font-semibold uppercase tracking-wide"
            style={{ color: COLORS.graphite }}
          >
            {s.name}
          </div>
        ))}
        <div />
        {sizes.map((s) => (
          <input
            key={s.id}
            type="number"
            min="0"
            className="form-input text-center"
            value={qtyBySize?.[s.id] ?? 1}
            onChange={(e) => onChange(s.id, e.target.value)}
            aria-label={`Qty for ${s.name}`}
          />
        ))}
      </div>
    </div>
  );
}

function syncCompanyRates(type, materials, sizes) {
  const map = new Map(
    (type.companyRates || []).map((r) => [`${r.materialId}::${r.sizeId}`, r.companyRate])
  );
  const companyRates = [];
  for (const m of materials) {
    for (const s of sizes) {
      companyRates.push({
        id: genId("CRATE"),
        materialId: m.id,
        sizeId: s.id,
        companyRate: map.get(`${m.id}::${s.id}`) ?? "",
      });
    }
  }
  return companyRates;
}

function syncPartQtys(parts, sizes) {
  return parts.map((p) => {
    const qtyBySize = { ...(p.qtyBySize || {}) };
    for (const s of sizes) {
      if (qtyBySize[s.id] == null) qtyBySize[s.id] = 1;
    }
    for (const key of Object.keys(qtyBySize)) {
      if (!sizes.some((s) => s.id === key)) delete qtyBySize[key];
    }
    const labourBySize = { ...(p.labourBySize || {}) };
    for (const s of sizes) {
      if (!labourBySize[s.id]) labourBySize[s.id] = emptyLabour();
    }
    return { ...p, qtyBySize, labourBySize };
  });
}

function LinkBtn({ children, onClick }) {
  return (
    <button
      type="button"
      className="text-[12px] font-semibold"
      style={{ color: COLORS.goldDim }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function TypeEditor({ initialType, articleName, onSave, onCancel }) {
  const [type, setType] = useState(() => ({
    ...initialType,
    labour: initialType.labour || emptyLabour(),
    labourBySize: initialType.labourBySize || {},
    materials: initialType.materials || [],
    sizes: initialType.sizes || [],
    companyRates: initialType.companyRates || [],
    parts: initialType.parts || [],
    packingOptions: initialType.packingOptions?.length
      ? initialType.packingOptions
      : [emptyPackingOption()],
    addons: initialType.addons || [],
    labourSameForAllSizes: initialType.labourSameForAllSizes !== false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewMaterialId, setPreviewMaterialId] = useState(
    () => initialType.materials?.[0]?.id || ""
  );
  const [previewSizeId, setPreviewSizeId] = useState(() => initialType.sizes?.[0]?.id || "");
  const [previewPackingId, setPreviewPackingId] = useState(
    () => initialType.packingOptions?.[0]?.id || ""
  );

  const materials = type.materials;
  const sizes = type.sizes;

  const summary = useMemo(() => {
    const mid = previewMaterialId || materials[0]?.id;
    const sid = previewSizeId || sizes[0]?.id;
    if (!mid || !sid) return null;
    const pid = previewPackingId || type.packingOptions?.[0]?.id || null;
    return calcTypeSummary(type, mid, sid, pid);
  }, [type, previewMaterialId, previewSizeId, previewPackingId, materials, sizes]);

  function patch(partial) {
    setType((prev) => ({ ...prev, ...partial }));
  }

  function setMaterials(next) {
    patch({ materials: next, companyRates: syncCompanyRates(type, next, sizes) });
    if (!next.some((m) => m.id === previewMaterialId)) setPreviewMaterialId(next[0]?.id || "");
  }

  function setSizes(next) {
    const labourBySize = { ...(type.labourBySize || {}) };
    for (const s of next) {
      if (!labourBySize[s.id]) labourBySize[s.id] = emptyLabour();
    }
    patch({
      sizes: next,
      companyRates: syncCompanyRates(type, materials, next),
      parts: syncPartQtys(type.parts, next),
      labourBySize,
    });
    if (!next.some((s) => s.id === previewSizeId)) setPreviewSizeId(next[0]?.id || "");
  }

  function setRate(materialId, sizeId, value) {
    const companyRates = (type.companyRates || []).map((r) =>
      r.materialId === materialId && r.sizeId === sizeId ? { ...r, companyRate: value } : r
    );
    if (!companyRates.some((r) => r.materialId === materialId && r.sizeId === sizeId)) {
      companyRates.push({ id: genId("CRATE"), materialId, sizeId, companyRate: value });
    }
    patch({ companyRates });
  }

  function addPart() {
    patch({
      parts: [
        ...type.parts,
        {
          id: genId("PART"),
          name: "",
          qtyBySize: Object.fromEntries(sizes.map((s) => [s.id, 1])),
          labour: emptyLabour(),
          labourBySize: Object.fromEntries(sizes.map((s) => [s.id, emptyLabour()])),
        },
      ],
    });
  }

  function updatePart(partId, partial) {
    patch({ parts: type.parts.map((p) => (p.id === partId ? { ...p, ...partial } : p)) });
  }

  function removePart(partId) {
    patch({
      parts: type.parts.filter((p) => p.id !== partId),
      addons: type.addons.map((a) =>
        a.partId === partId ? { ...a, partId: null, scope: "whole" } : a
      ),
    });
  }

  function updateAddon(id, partial) {
    patch({ addons: type.addons.map((a) => (a.id === id ? { ...a, ...partial } : a)) });
  }

  function updatePacking(id, partial) {
    patch({
      packingOptions: (type.packingOptions || []).map((p) =>
        p.id === id ? { ...p, ...partial } : p
      ),
    });
  }

  function removePacking(id) {
    const next = (type.packingOptions || []).filter((p) => p.id !== id);
    patch({ packingOptions: next.length ? next : [emptyPackingOption()] });
    if (previewPackingId === id) setPreviewPackingId(next[0]?.id || "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!type.name.trim()) {
      setError("Type name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...type,
        name: type.name.trim(),
        description: (type.description || "").trim(),
        companyRates: syncCompanyRates(type, materials, sizes),
        parts: syncPartQtys(type.parts, sizes).filter((p) => p.name.trim()),
        packingOptions: (type.packingOptions || []).filter((p) => String(p.name || "").trim()),
      });
    } catch (err) {
      setError(err?.message || "Could not save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <button
        type="button"
        className="text-[12.5px] font-semibold mb-4"
        style={{ color: COLORS.goldDim }}
        onClick={onCancel}
      >
        ← {articleName || "Back"}
      </button>

      {error && (
        <p className="text-[12.5px] mb-3" style={{ color: COLORS.rust }}>{error}</p>
      )}

      <div
        className="rounded-2xl px-5 sm:px-6"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
      >
        <Block title="Name">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Type</label>
              <input
                className="form-input"
                value={type.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="KAJ Button"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">Note</label>
              <input
                className="form-input"
                value={type.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
        </Block>

        <Block title="Fabric & size">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <div className="form-label">Materials</div>
              <ChipInput values={materials} onChange={setMaterials} placeholder="Cotton" />
            </div>
            <div>
              <div className="form-label">Sizes</div>
              <ChipInput values={sizes} onChange={setSizes} placeholder="Single" />
            </div>
          </div>
        </Block>

        <Block title="Company rate">
          {!materials.length || !sizes.length ? (
            <p className="text-[12.5px]" style={{ color: COLORS.graphiteLight }}>
              Add materials and sizes first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div
                className="rate-grid inline-grid gap-x-2 gap-y-2 min-w-full"
                style={{
                  gridTemplateColumns: `minmax(6.5rem, auto) repeat(${sizes.length}, minmax(5.5rem, 1fr))`,
                }}
              >
                <div />
                {sizes.map((s) => (
                  <div
                    key={s.id}
                    className="text-center text-[10.5px] font-semibold uppercase tracking-wide px-1"
                    style={{ color: COLORS.graphite }}
                  >
                    {s.name}
                  </div>
                ))}

                {materials.map((m) => (
                  <div key={m.id} className="contents">
                    <div
                      className="flex items-center text-[13px] font-medium pr-2 whitespace-nowrap"
                      style={{ color: COLORS.ink }}
                    >
                      {m.name}
                    </div>
                    {sizes.map((s) => {
                      const cell = (type.companyRates || []).find(
                        (r) => r.materialId === m.id && r.sizeId === s.id
                      );
                      return (
                        <div key={s.id} className="relative">
                          <span
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold"
                            style={{ color: COLORS.graphiteLight }}
                          >
                            ₨
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="form-input text-right pl-7"
                            value={cell?.companyRate ?? ""}
                            onChange={(e) => setRate(m.id, s.id, e.target.value)}
                            placeholder="0"
                            aria-label={`${m.name} ${s.name} company rate`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Block>

        <Block
          title="Labour"
          action={<LinkBtn onClick={addPart}>+ Part</LinkBtn>}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <label className="flex items-center gap-2 text-[12.5px]" style={{ color: COLORS.ink }}>
              <input
                type="checkbox"
                checked={type.labourSameForAllSizes}
                onChange={(e) => patch({ labourSameForAllSizes: e.target.checked })}
              />
              Same wages for every size
            </label>
          </div>

          {!type.parts.length ? (
            <div
              className="rounded-xl p-4"
              style={{ background: COLORS.boneDim }}
            >
              <p className="text-[12px] mb-3" style={{ color: COLORS.graphite }}>
                Single piece — add parts if this type has Bedsheet + Pillow, etc.
              </p>
              {type.labourSameForAllSizes ? (
                <>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>
                      Cut / Stitch / Check / pc
                    </span>
                    <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                      {formatPKR(partLabourTotal(type.labour))}
                    </span>
                  </div>
                  <LabourFields
                    stations={PART_STATIONS}
                    labour={type.labour}
                    onChange={(labour) =>
                      patch({ labour: { ...labour, packingRate: 0 } })
                    }
                  />
                </>
              ) : sizes.length ? (
                <div className="space-y-4">
                  {sizes.map((s) => (
                    <div key={s.id}>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[12px] font-medium" style={{ color: COLORS.ink }}>{s.name}</span>
                        <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                          {formatPKR(partLabourTotal(type.labourBySize?.[s.id]))}
                        </span>
                      </div>
                      <LabourFields
                        stations={PART_STATIONS}
                        labour={type.labourBySize?.[s.id] || emptyLabour()}
                        onChange={(labour) =>
                          patch({
                            labourBySize: {
                              ...type.labourBySize,
                              [s.id]: { ...labour, packingRate: 0 },
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>Add sizes first.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {type.parts.map((part, idx) => (
                <div
                  key={part.id}
                  className="rounded-xl p-4"
                  style={{ background: COLORS.boneDim }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
                    >
                      {idx + 1}
                    </span>
                    <input
                      className="form-input flex-1 min-w-0"
                      value={part.name}
                      onChange={(e) => updatePart(part.id, { name: e.target.value })}
                      placeholder="Bedsheet / Pillow"
                    />
                    <button
                      type="button"
                      className="text-[12px] font-medium shrink-0 px-1"
                      style={{ color: COLORS.rust }}
                      onClick={() => removePart(part.id)}
                    >
                      Remove
                    </button>
                  </div>

                  {sizes.length > 0 && (
                    <div className="mb-3 pb-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <QtyBySizeRow
                        sizes={sizes}
                        qtyBySize={part.qtyBySize}
                        onChange={(sizeId, value) =>
                          updatePart(part.id, {
                            qtyBySize: { ...part.qtyBySize, [sizeId]: value },
                          })
                        }
                      />
                    </div>
                  )}

                  {type.labourSameForAllSizes ? (
                    <>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.graphite }}>
                          Cut / Stitch / Check
                        </span>
                        <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                          {formatPKR(partLabourTotal(part.labour))}
                        </span>
                      </div>
                      <LabourFields
                        stations={PART_STATIONS}
                        labour={part.labour}
                        onChange={(labour) =>
                          updatePart(part.id, { labour: { ...labour, packingRate: 0 } })
                        }
                      />
                    </>
                  ) : (
                    <div className="space-y-4">
                      {sizes.map((s) => (
                        <div key={s.id}>
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="text-[12px] font-medium" style={{ color: COLORS.ink }}>
                              Cut / Stitch / Check — {s.name}
                            </span>
                            <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>
                              {formatPKR(partLabourTotal(part.labourBySize?.[s.id]))}
                            </span>
                          </div>
                          <LabourFields
                            stations={PART_STATIONS}
                            labour={part.labourBySize?.[s.id] || emptyLabour()}
                            onChange={(labour) =>
                              updatePart(part.id, {
                                labourBySize: {
                                  ...part.labourBySize,
                                  [s.id]: { ...labour, packingRate: 0 },
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block
          title="Packing types"
          action={
            <LinkBtn
              onClick={() =>
                patch({
                  packingOptions: [...(type.packingOptions || []), emptyPackingOption()],
                })
              }
            >
              + Packing type
            </LinkBtn>
          }
        >
          <p className="text-[12px] mb-3" style={{ color: COLORS.graphiteLight }}>
            Each packing style has labour (worker pay, 1× set) and company sell for that packing.
            Old packing rates migrate to “Simple packing” — nothing is deleted.
          </p>
          <div className="space-y-3">
            {(type.packingOptions || []).map((opt, idx) => (
              <div
                key={opt.id}
                className="rounded-xl p-4"
                style={{ background: COLORS.boneDim }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
                  >
                    {idx + 1}
                  </span>
                  <input
                    className="form-input flex-1 min-w-0"
                    value={opt.name}
                    onChange={(e) => updatePacking(opt.id, { name: e.target.value })}
                    placeholder="Simple packing / Gift box / …"
                  />
                  <button
                    type="button"
                    className="text-[12px] font-medium shrink-0 px-1"
                    style={{ color: COLORS.rust }}
                    onClick={() => removePacking(opt.id)}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Labour (worker)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={opt.labourRate ?? ""}
                      onChange={(e) => updatePacking(opt.id, { labourRate: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="form-label">Company sell</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={opt.companyRate ?? ""}
                      onChange={(e) => updatePacking(opt.id, { companyRate: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block
          title="Add-ons"
          action={
            <LinkBtn onClick={() => patch({ addons: [...type.addons, emptyAddonDraft()] })}>
              + Add-on
            </LinkBtn>
          }
          last
        >
          {!type.addons.length ? (
            <p className="text-[12.5px]" style={{ color: COLORS.graphiteLight }}>None</p>
          ) : (
            <div className="space-y-5">
              {type.addons.map((addon, idx) => (
                <div key={addon.id}>
                  {idx > 0 && (
                    <div className="mb-4" style={{ borderTop: `1px dashed ${COLORS.border}` }} />
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <input
                      className="form-input max-w-[200px]"
                      value={addon.name}
                      onChange={(e) => updateAddon(addon.id, { name: e.target.value })}
                      placeholder="Button"
                    />
                    <button
                      type="button"
                      className="text-[12px] font-medium ml-auto"
                      style={{ color: COLORS.rust }}
                      onClick={() =>
                        patch({ addons: type.addons.filter((a) => a.id !== addon.id) })
                      }
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div>
                      <label className="form-label">Company +</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-input"
                        value={addon.companyRate ?? ""}
                        onChange={(e) => updateAddon(addon.id, { companyRate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Labour</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-input"
                        value={addon.addonRate ?? ""}
                        onChange={(e) => updateAddon(addon.id, { addonRate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Dept</label>
                      <select
                        className="form-input"
                        value={addon.department || "Packing"}
                        onChange={(e) => updateAddon(addon.id, { department: e.target.value })}
                      >
                        {STATION_ORDER.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Scope</label>
                      <select
                        className="form-input"
                        value={addon.scope || "whole"}
                        onChange={(e) =>
                          updateAddon(addon.id, {
                            scope: e.target.value,
                            partId: e.target.value === "part" ? addon.partId : null,
                          })
                        }
                      >
                        <option value="whole">Whole</option>
                        <option value="part">One part</option>
                      </select>
                    </div>
                  </div>

                  {addon.scope === "part" && (
                    <div className="mb-3 max-w-[220px]">
                      <label className="form-label">Part</label>
                      <select
                        className="form-input"
                        value={addon.partId || ""}
                        onChange={(e) => updateAddon(addon.id, { partId: e.target.value || null })}
                      >
                        <option value="">Select…</option>
                        {type.parts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name || "Unnamed"}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <div className="form-label mb-1.5">Needs first</div>
                      <div className="flex flex-wrap gap-2.5">
                        {STATION_ORDER.map((s) => {
                          const requires = Array.isArray(addon.requiresStations)
                            ? addon.requiresStations
                            : ["Checking"];
                          return (
                            <label key={s} className="flex items-center gap-1 text-[12px]">
                              <input
                                type="checkbox"
                                checked={requires.includes(s)}
                                onChange={() => {
                                  const next = requires.includes(s)
                                    ? requires.filter((x) => x !== s)
                                    : [...requires, s];
                                  updateAddon(addon.id, {
                                    requiresStations: next.length ? next : ["Checking"],
                                  });
                                }}
                              />
                              {s.slice(0, 3)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="w-36">
                      <label className="form-label">Unlocks</label>
                      <select
                        className="form-input"
                        value={addon.afterStation || "Packing"}
                        onChange={(e) => updateAddon(addon.id, { afterStation: e.target.value })}
                      >
                        {STATION_ORDER.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Block>
      </div>

      <div
        className="sticky bottom-3 z-10 mt-4 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 border backdrop-blur-md"
        style={{
          background: `color-mix(in srgb, ${COLORS.card} 92%, transparent)`,
          borderColor: COLORS.border,
          boxShadow: "0 8px 28px -16px rgba(28,25,23,0.35)",
        }}
      >
        {summary ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] min-w-0 flex-1">
            <select
              className="form-input w-auto py-1.5 text-[12px]"
              value={previewMaterialId || materials[0]?.id}
              onChange={(e) => setPreviewMaterialId(e.target.value)}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              className="form-input w-auto py-1.5 text-[12px]"
              value={previewSizeId || sizes[0]?.id}
              onChange={(e) => setPreviewSizeId(e.target.value)}
            >
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {(type.packingOptions || []).length > 0 && (
              <select
                className="form-input w-auto py-1.5 text-[12px]"
                value={previewPackingId || type.packingOptions[0]?.id}
                onChange={(e) => setPreviewPackingId(e.target.value)}
              >
                {type.packingOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || "Packing"}</option>
                ))}
              </select>
            )}
            <span style={{ color: COLORS.graphite }}>
              Co <strong style={{ color: COLORS.ink }}>{formatPKR(summary.company)}</strong>
            </span>
            <span style={{ color: COLORS.graphite }}>
              Lab <strong style={{ color: COLORS.ink }}>{formatPKR(summary.labor)}</strong>
            </span>
            <span style={{ color: summary.profit >= 0 ? COLORS.green : COLORS.rust }}>
              {summary.margin}%
            </span>
          </div>
        ) : (
          <div className="flex-1 text-[12px]" style={{ color: COLORS.graphiteLight }}>
            Add fabric & size to see profit
          </div>
        )}
        <div className="flex gap-2 shrink-0">
          <button type="button" className="ghost-btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={saving || !type.name.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <style>{`
        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: ${COLORS.graphite}; margin-bottom: 5px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 13px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 10px; padding: 8px 11px; outline: none; width: 100%;
        }
        .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}55; }
        .primary-btn {
          font-family: ${FONT}; font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 10px;
          background: ${COLORS.gold}; color: ${COLORS.inkSurface}; border: none; cursor: pointer;
        }
        .primary-btn:disabled { opacity: 0.45; cursor: default; }
        .ghost-btn {
          font-family: ${FONT}; font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 10px;
          background: transparent; color: ${COLORS.graphite}; border: 1px solid ${COLORS.border}; cursor: pointer;
        }
        .ghost-btn:hover { border-color: ${COLORS.gold}; color: ${COLORS.goldDim}; }
      `}</style>
    </form>
  );
}
