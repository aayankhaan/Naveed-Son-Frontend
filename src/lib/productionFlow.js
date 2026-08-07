/** Client-side helpers mirroring backend production sequence + addon gates */

export const STATION_ORDER = ["Cutting", "Stitching", "Checking", "Packing"];

export function skipMap(line) {
  if (!line) {
    return { Cutting: false, Stitching: false, Checking: false, Packing: false };
  }
  return {
    Cutting: Boolean(line.skip_cutting),
    Stitching: Boolean(line.skip_stitching),
    Checking: Boolean(line.skip_checking),
    Packing: Boolean(line.skip_packing),
  };
}

export function enabledStations(line) {
  const skips = skipMap(line);
  return STATION_ORDER.filter((s) => !skips[s]);
}

export function previousStation(line, station) {
  const enabled = enabledStations(line);
  const idx = enabled.indexOf(station);
  if (idx <= 0) return null;
  return enabled[idx - 1];
}

export function emptyStationTotals() {
  return { Cutting: 0, Stitching: 0, Checking: 0, Packing: 0 };
}

/** Selected addon snapshots from order line meta (only if chosen on the order). */
export function lineSelectedAddons(line) {
  const meta = line?.set_order_meta || line?.set_meta || {};
  const selectedIds = Array.isArray(meta.addonIds)
    ? meta.addonIds.map(String)
    : Array.isArray(meta.addon_ids)
      ? meta.addon_ids.map(String)
      : null;

  if (selectedIds && selectedIds.length === 0) return [];

  if (Array.isArray(meta.addons) && meta.addons.length) {
    let list = meta.addons.map((a) => ({
      id: a.id,
      name: a.name || a.id,
      addonRate: Number(a.addonRate ?? a.addon_rate) || 0,
      requiresStations: Array.isArray(a.requiresStations || a.requires_stations)
        ? a.requiresStations || a.requires_stations
        : ["Cutting", "Stitching"],
      afterStation: a.afterStation || a.after_station || "Checking",
    }));
    if (selectedIds) {
      const idSet = new Set(selectedIds);
      list = list.filter((a) => idSet.has(String(a.id)));
    }
    return list;
  }
  return [];
}

/**
 * Station that logs this add-on (last prerequisite in pipeline order).
 * e.g. Button needs Cut+Stitch → Stitching department does Button.
 */
export function addonWorkStation(addon) {
  const requires = Array.isArray(addon?.requiresStations) && addon.requiresStations.length
    ? addon.requiresStations
    : ["Cutting", "Stitching"];
  let last = null;
  let lastIdx = -1;
  for (const s of requires) {
    const idx = STATION_ORDER.indexOf(s);
    if (idx > lastIdx) {
      lastIdx = idx;
      last = s;
    }
  }
  return last || "Stitching";
}

/** Add-ons this employee station can pick in Work type. */
export function addonsForStation(line, station) {
  if (!station) return [];
  return lineSelectedAddons(line).filter((a) => addonWorkStation(a) === station);
}

export function findLineAddon(line, addonId) {
  if (!addonId) return null;
  return lineSelectedAddons(line).find((a) => a.id === addonId) || null;
}

/** Merge historical totals + today's form entries (same work date). */
export function liveStationTotals(histTotals, formEntriesByVariant) {
  const out = { ...emptyStationTotals(), ...(histTotals || {}) };
  const form = formEntriesByVariant || {};
  STATION_ORDER.forEach((s) => {
    out[s] = (Number(out[s]) || 0) + (Number(form[s]) || 0);
  });
  return out;
}

export function liveAddonTotals(histAddonTotals, formAddonByVariant) {
  const out = { ...(histAddonTotals || {}) };
  const form = formAddonByVariant || {};
  Object.keys(form).forEach((addonId) => {
    out[addonId] = (Number(out[addonId]) || 0) + (Number(form[addonId]) || 0);
  });
  return out;
}

/**
 * How many more pieces this station can take given upstream + addon gates.
 * null = unlimited (first enabled station, no addon gate) — over-order qty is allowed.
 *
 * setPackCtx (Packing on set parts): gate by complete sets across sibling parts.
 *   { siblings: [{ variantId, qtyPerSet, partName }], totalsByVariantId }
 */
export function availableForStation(line, station, liveTotals, addonTotals = {}, setPackCtx = null) {
  if (!line) return null;
  const skips = skipMap(line);
  if (skips[station]) return 0;
  const prev = previousStation(line, station);
  const here = Number(liveTotals?.[station]) || 0;
  let avail = prev == null ? null : Math.max(0, (Number(liveTotals?.[prev]) || 0) - here);

  for (const ad of lineSelectedAddons(line)) {
    const after = ad.afterStation || "Checking";
    if (after !== station) continue;
    const addonDone = Number(addonTotals?.[ad.id]) || 0;
    const gated = Math.max(0, addonDone - here);
    avail = avail == null ? gated : Math.min(avail, gated);
  }

  if (station === "Packing" && setPackCtx?.siblings?.length) {
    const setAvail = availableSetPackPieces(line, liveTotals, setPackCtx);
    if (setAvail != null) {
      avail = avail == null ? setAvail : Math.min(avail, setAvail);
    }
  }
  return avail;
}

export function lineSetMeta(line) {
  return line?.set_order_meta || line?.set_meta || line?.setOrderMeta || line?.setMeta || null;
}

export function setGroupKey(line) {
  const meta = lineSetMeta(line);
  if (!meta?.setId && !meta?.set_id) return null;
  if (meta.groupId || meta.group_id) return String(meta.groupId || meta.group_id);
  const setId = meta.setId || meta.set_id;
  const qps = Number(meta.quantityPerSet || meta.quantity_per_set) || 0;
  const orderQty =
    meta.orderQuantity != null && meta.orderQuantity !== ""
      ? Number(meta.orderQuantity)
      : qps > 0
        ? Math.round((Number(line.quantity) || 0) / qps)
        : Number(line.quantity) || 0;
  const designs = (meta.designColors || meta.design_colors || [])
    .map((d) => d?.name || d || "")
    .join("|");
  return `${setId}::${meta.configurationId || meta.configuration_id || ""}::${line.pack_per_ctn || line.packPerCtn || ""}::${orderQty}::${designs}`;
}

export function qtyPerSetOf(line) {
  const meta = lineSetMeta(line);
  return Math.max(1, Number(meta?.quantityPerSet || meta?.quantity_per_set) || 1);
}

export function partNameOf(line) {
  const meta = lineSetMeta(line);
  if (meta?.partName || meta?.part_name) return meta.partName || meta.part_name;
  return line?.article_name || line?.article || "Part";
}

/**
 * Sibling set parts matched to the same design/variant name on this order.
 * Returns null if not a multi-part set line.
 */
export function buildSetPackContext(orderLines, line, variantId, totalsByVariantId) {
  const key = setGroupKey(line);
  if (!key) return null;
  const variants = line?.variants || [];
  const thisVar = variants.find((v) => v.variant_id === variantId) || variants[0];
  if (!thisVar) return null;
  const designName = String(thisVar.variant_name || "Default").trim() || "Default";

  const siblings = [];
  for (const other of orderLines || []) {
    if (setGroupKey(other) !== key) continue;
    const oVars = other.variants || [];
    const match =
      oVars.find((v) => String(v.variant_name || "Default").trim() === designName) ||
      oVars[0];
    if (!match) continue;
    siblings.push({
      line: other,
      variantId: match.variant_id,
      qtyPerSet: qtyPerSetOf(other),
      partName: partNameOf(other),
    });
  }
  if (siblings.length < 2) return null;
  return { siblings, designName, totalsByVariantId: totalsByVariantId || {} };
}

/** How many complete sets are ready upstream of Packing (usually Checking). */
export function completeSetsReadyForPack(setPackCtx, packPrevStation) {
  if (!setPackCtx?.siblings?.length) return null;
  const prev = packPrevStation || "Checking";
  let sets = Infinity;
  const bottlenecks = [];
  for (const sib of setPackCtx.siblings) {
    const t = setPackCtx.totalsByVariantId?.[sib.variantId] || {};
    const upstream = Number(t[prev]) || 0;
    const partSets = Math.floor(upstream / sib.qtyPerSet);
    sets = Math.min(sets, partSets);
    bottlenecks.push({
      partName: sib.partName,
      qtyPerSet: sib.qtyPerSet,
      upstream,
      partSets,
      needPieces: Math.max(0, (partSets + 1) * sib.qtyPerSet - upstream),
    });
  }
  if (!Number.isFinite(sets)) return null;
  return { sets, bottlenecks, prev };
}

/** Piece headroom for Packing this part so packed sets stay complete. */
export function availableSetPackPieces(line, liveTotals, setPackCtx) {
  const prev = previousStation(line, "Packing");
  if (!prev) return null;
  const info = completeSetsReadyForPack(setPackCtx, prev);
  if (!info) return null;
  const qps = qtyPerSetOf(line);
  const here = Number(liveTotals?.Packing) || 0;
  return Math.max(0, info.sets * qps - here);
}

/** How many more complete sets can be packed (Checking ready − already packed). */
export function availableSetPackSets(setPackCtx, packPrevStation = "Checking") {
  if (!setPackCtx?.siblings?.length) return null;
  const info = completeSetsReadyForPack(setPackCtx, packPrevStation);
  if (!info) return null;
  let packed = Infinity;
  for (const sib of setPackCtx.siblings) {
    const t = setPackCtx.totalsByVariantId?.[sib.variantId] || {};
    packed = Math.min(packed, Math.floor((Number(t.Packing) || 0) / sib.qtyPerSet));
  }
  if (!Number.isFinite(packed)) packed = 0;
  return Math.max(0, info.sets - packed);
}

/**
 * Catch-up packing for a set: packing N sets brings every part up to
 * (currentCompleteSets + N) × qtyPerSet. Leaders that already ahead get 0.
 * packingTotalsByVariantId should be historical Packing only (not this entry).
 */
export function setPackCatchUpNeeds(siblings, addSets, packingTotalsByVariantId = {}) {
  const list = siblings || [];
  if (!list.length) return [];
  const n = Math.max(0, Math.round(Number(addSets) || 0));
  if (n <= 0) return list.map((sib) => ({ ...sib, packed: 0, need: 0 }));

  let currentComplete = Infinity;
  const rows = list.map((sib) => {
    const packed = Math.max(
      0,
      Math.round(Number(packingTotalsByVariantId?.[sib.variantId]?.Packing) || 0)
    );
    const qps = Math.max(1, Number(sib.qtyPerSet) || 1);
    currentComplete = Math.min(currentComplete, Math.floor(packed / qps));
    return { ...sib, packed, qtyPerSet: qps };
  });
  if (!Number.isFinite(currentComplete)) currentComplete = 0;
  const target = currentComplete + n;
  return rows.map((r) => ({
    ...r,
    need: Math.max(0, target * r.qtyPerSet - r.packed),
  }));
}

/** Cap for addon work: min(prereq stations) − already done */
export function availableForAddon(line, addon, stationTotals, addonDoneQty) {
  if (!line || !addon) return 0;
  const requires = Array.isArray(addon.requiresStations) && addon.requiresStations.length
    ? addon.requiresStations
    : ["Cutting", "Stitching"];
  let cap = Infinity;
  for (const s of requires) {
    if (!STATION_ORDER.includes(s)) continue;
    if (skipMap(line)[s]) continue;
    cap = Math.min(cap, Number(stationTotals?.[s]) || 0);
  }
  if (!Number.isFinite(cap)) cap = 0;
  return Math.max(0, cap - (Number(addonDoneQty) || 0));
}

/**
 * Stock sitting at each station (not cumulative done).
 * Sti remaining = stitched − checked; once packed through, Sti/Che show 0.
 * Last station shows total completed there (e.g. packed).
 */
export function stationWipTotals(line, cumulativeTotals) {
  const enabled = enabledStations(line);
  const t = cumulativeTotals || emptyStationTotals();
  const wip = emptyStationTotals();
  for (let i = 0; i < enabled.length; i++) {
    const s = enabled[i];
    const here = Number(t[s]) || 0;
    const next = enabled[i + 1];
    if (!next) {
      wip[s] = here;
    } else {
      wip[s] = Math.max(0, here - (Number(t[next]) || 0));
    }
  }
  return wip;
}

/**
 * Add-on pieces still sitting before the unlock station.
 * e.g. Button done 25, Checking 25 → Button WIP 0 (already moved on).
 */
export function addonWipQty(addon, stationTotals, addonDoneQty) {
  const after = addon?.afterStation || "Checking";
  const done = Number(addonDoneQty) || 0;
  const movedOn = Number(stationTotals?.[after]) || 0;
  return Math.max(0, done - movedOn);
}

/** Human status from remaining stock: "300 at stitching · need check & pack" */
export function describePipelineStatus(line, totals, addonTotals = {}) {
  const enabled = enabledStations(line);
  if (!enabled.length) return "No departments on this part";
  const t = totals || emptyStationTotals();
  const wip = stationWipTotals(line, t);
  const last = enabled[enabled.length - 1];
  const finished = Number(t[last]) || 0;
  const addons = lineSelectedAddons(line);

  const stockBits = [];
  for (let i = 0; i < enabled.length - 1; i++) {
    const s = enabled[i];
    const q = Number(wip[s]) || 0;
    if (q > 0) stockBits.push(`${q.toLocaleString()} at ${s.toLowerCase()}`);
  }
  for (const ad of addons) {
    const done = Number(addonTotals?.[ad.id]) || 0;
    const req = ad.requiresStations || ["Cutting", "Stitching"];
    let cap = Infinity;
    for (const s of req) {
      if (skipMap(line)[s]) continue;
      cap = Math.min(cap, Number(t[s]) || 0);
    }
    if (!Number.isFinite(cap)) cap = 0;
    const waiting = Math.max(0, cap - done);
    const sitting = addonWipQty(ad, t, done);
    if (waiting > 0) stockBits.push(`${waiting.toLocaleString()} need ${ad.name}`);
    else if (sitting > 0) stockBits.push(`${sitting.toLocaleString()} ${ad.name}`);
  }

  if (!stockBits.length && finished === 0) return "Not started";
  if (!stockBits.length) {
    return `${finished.toLocaleString()} ${last.toLowerCase()} · through last step`;
  }

  const firstStock = enabled.findIndex((s) => (Number(wip[s]) || 0) > 0);
  const need = firstStock >= 0 ? enabled.slice(firstStock + 1) : [];
  const needText = need.length ? ` · need ${need.map((n) => n.toLowerCase()).join(" & ")}` : "";
  const finishedText = finished > 0 ? ` · ${finished.toLocaleString()} ${last.toLowerCase()}` : "";
  return `${stockBits.join(" · ")}${needText}${finishedText}`;
}
