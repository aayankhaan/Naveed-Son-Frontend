export function emptyDesignColor() {
  return { id: `DC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", barcode: "", quantity: "" };
}

export function equalSplit(quantity, ids) {
  const n = ids.length;
  if (!n) return {};
  const base = Math.floor(quantity / n);
  const remainder = quantity - base * n;
  const out = {};
  ids.forEach((id, i) => { out[id] = base + (i < remainder ? 1 : 0); });
  return out;
}

export function designColorSplitError(designColors, splitMode, totalQty) {
  const entries = (designColors || []).filter((dc) => dc.name?.trim());
  if (entries.length <= 1) return null;
  if (splitMode !== "custom") return null;
  const qty = Number(totalQty) || 0;
  const sum = entries.reduce((s, dc) => s + (Number(dc.quantity) || 0), 0);
  if (sum !== qty) return `Split adds up to ${sum.toLocaleString()}, needs to equal ${qty.toLocaleString()}`;
  return null;
}

export function buildVariantsFromDesignColors(designColors, splitMode, totalQty) {
  const qty = Number(totalQty) || 0;
  const entries = (designColors || []).filter((dc) => dc.name?.trim());
  if (!entries.length) return [];
  const ids = entries.map((dc) => dc.id);
  const split = splitMode === "equal" && entries.length > 1 ? equalSplit(qty, ids) : null;
  return entries.map((dc) => ({
    variant_id: dc.id,
    variant_name: dc.name.trim(),
    quantity: splitMode === "equal" && entries.length > 1 ? split[dc.id] : Number(dc.quantity) || qty,
    barcode: dc.barcode?.trim() || null,
  }));
}

export function designColorsFromVariants(variants) {
  const named = (variants || []).filter((v) => v.variant_id != null);
  return {
    splitMode: named.length > 1 ? "custom" : "equal",
    designColors: named.map((v) => ({
      id: v.variant_id,
      name: v.variant_name || "",
      barcode: v.barcode || "",
      quantity: String(v.quantity ?? ""),
    })),
  };
}

/** Split set count across designs, then multiply by pieces-per-set for a part line */
export function buildPartVariantsFromSetOrder(setOrder, quantityPerSet) {
  const setQty = Number(setOrder.orderQuantity) || 0;
  const entries = (setOrder.designColors || []).filter((dc) => dc.name?.trim());
  if (!entries.length) return [];

  const ids = entries.map((dc) => dc.id);
  const setSplit = setOrder.splitMode === "equal" && entries.length > 1 ? equalSplit(setQty, ids) : null;

  return entries.map((dc) => {
    const setsForDesign =
      entries.length > 1
        ? (setOrder.splitMode === "equal" ? setSplit[dc.id] : Number(dc.quantity) || 0)
        : setQty;
    return {
      variant_id: dc.id,
      variant_name: dc.name.trim(),
      quantity: setsForDesign * (Number(quantityPerSet) || 0),
      barcode: dc.barcode?.trim() || null,
      ready_quantity: 0,
    };
  });
}
