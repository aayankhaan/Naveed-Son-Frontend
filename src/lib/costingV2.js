// Pricing helpers for Item Costing v2 (type × material × size + parts labour + packing options + addons)

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

export function emptyPackingOption() {
  return {
    id: genId("PACK"),
    name: "",
    labourRate: "",
    companyRate: "",
  };
}

/** Cut + Stitch + Check only (packing is set-level options) */
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

export function resolvePackingOption(type, packingOptionId) {
  const list = type?.packingOptions || [];
  if (!list.length) {
    // Legacy fallback from type.labour.packingRate
    const rate = Number(type?.labour?.packingRate) || 0;
    if (!rate) return null;
    return { id: null, name: "Simple packing", labourRate: rate, companyRate: 0 };
  }
  if (packingOptionId) {
    const found = list.find((p) => p.id === packingOptionId);
    if (found) return found;
  }
  return list[0];
}

function packingLabourOf(type, packingOptionId) {
  const opt = resolvePackingOption(type, packingOptionId);
  return Number(opt?.labourRate) || 0;
}

function packingCompanyOf(type, packingOptionId) {
  const opt = resolvePackingOption(type, packingOptionId);
  return Number(opt?.companyRate) || 0;
}

/**
 * Labour for one complete set/unit at a size:
 * - no parts → Cut/Stitch/Check on type + packing option labour
 * - with parts → (Cut+Stitch+Check)×qty per part + packing option labour 1×
 */
export function calcTypeLabourAtSize(type, sizeId, packingOptionId = null) {
  const same = type.labourSameForAllSizes !== false;
  const parts = type.parts || [];
  let total = 0;

  if (!parts.length) {
    const L = same
      ? type.labour
      : (type.labourBySize && type.labourBySize[sizeId]) || type.labour;
    total += partLabourTotal(L);
  } else {
    for (const part of parts) {
      const qty = Number(part.qtyBySize?.[sizeId] ?? 1) || 0;
      const L = same
        ? part.labour
        : (part.labourBySize && part.labourBySize[sizeId]) || part.labour;
      total += partLabourTotal(L) * qty;
    }
  }

  total += packingLabourOf(type, packingOptionId);

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

export function calcTypeSummary(type, materialId, sizeId, packingOptionId = null) {
  const company =
    companyRateAt(type, materialId, sizeId) +
    packingCompanyOf(type, packingOptionId) +
    (type.addons || []).reduce((s, a) => s + (Number(a.companyRate) || 0), 0);
  const labor = calcTypeLabourAtSize(type, sizeId, packingOptionId);
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
    packingOptions: [
      { id: genId("PACK"), name: "Simple packing", labourRate: "", companyRate: "" },
    ],
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
