// Pricing helpers for Item Costing v2 (type × material × size + parts labour + addons)

export function formatPKR(n) {
  const v = Number(n) || 0;
  return `PKR ${v.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

export function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyLabour() {
  return { cuttingRate: "", stitchingRate: "", checkingRate: "", packingRate: "" };
}

/** Cut + Stitch + Check only (packing is set-level) */
export function partLabourTotal(labour) {
  if (!labour) return 0;
  return (
    (Number(labour.cuttingRate) || 0) +
    (Number(labour.stitchingRate) || 0) +
    (Number(labour.checkingRate) || 0)
  );
}

export function labourTotal(labour) {
  if (!labour) return 0;
  return partLabourTotal(labour) + (Number(labour.packingRate) || 0);
}

function packingAtSize(type, sizeId) {
  const same = type.labourSameForAllSizes !== false;
  const L = same
    ? type.labour
    : (type.labourBySize && type.labourBySize[sizeId]) || type.labour;
  return Number(L?.packingRate) || 0;
}

/**
 * Labour for one complete set/unit at a size:
 * - no parts → all 4 stations on type
 * - with parts → (Cut+Stitch+Check)×qty per part + Packing 1× on type
 */
export function calcTypeLabourAtSize(type, sizeId) {
  const same = type.labourSameForAllSizes !== false;
  const parts = type.parts || [];
  let total = 0;

  if (!parts.length) {
    const L = same
      ? type.labour
      : (type.labourBySize && type.labourBySize[sizeId]) || type.labour;
    total += labourTotal(L);
  } else {
    for (const part of parts) {
      const qty = Number(part.qtyBySize?.[sizeId] ?? 1) || 0;
      const L = same
        ? part.labour
        : (part.labourBySize && part.labourBySize[sizeId]) || part.labour;
      total += partLabourTotal(L) * qty;
    }
    total += packingAtSize(type, sizeId);
  }

  for (const a of type.addons || []) {
    total += Number(a.addonRate) || 0;
  }
  return total;
}

export function companyRateAt(type, materialId, sizeId) {
  const row = (type.companyRates || []).find(
    (r) => r.materialId === materialId && r.sizeId === sizeId
  );
  return Number(row?.companyRate) || 0;
}

export function calcTypeSummary(type, materialId, sizeId) {
  const company =
    companyRateAt(type, materialId, sizeId) +
    (type.addons || []).reduce((s, a) => s + (Number(a.companyRate) || 0), 0);
  const labor = calcTypeLabourAtSize(type, sizeId);
  const profit = company - labor;
  const margin = company > 0 ? Number(((profit / company) * 100).toFixed(1)) : 0;
  return { company, labor, profit, margin };
}

export function emptyTypeDraft() {
  return {
    name: "",
    description: "",
    labourSameForAllSizes: true,
    materials: [],
    sizes: [],
    companyRates: [],
    parts: [],
    labour: emptyLabour(),
    labourBySize: {},
    addons: [],
  };
}

export function emptyAddonDraft() {
  return {
    id: genId("ADDON"),
    name: "",
    companyRate: "",
    addonRate: "",
    scope: "whole",
    partId: null,
    department: "Packing",
    requiresStations: ["Checking"],
    afterStation: "Packing",
  };
}
