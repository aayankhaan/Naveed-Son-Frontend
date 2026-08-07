// Pricing resolution — article base rates + addons (size does not change wages)

import { buildPartVariantsFromSetOrder } from "./orderDesignColor";

function sumAddonDeltas(addons) {
  const delta = { sellingPrice: 0, cuttingRate: 0, stitchingRate: 0, checkingRate: 0, packingRate: 0 };
  (addons || []).forEach((addon) => {
    // Selling always stacks. Station rate deltas only when no separate addon pay rate
    // (avoids double-paying Button on Stitching + as addon work).
    if (addon.sellingPrice != null && addon.sellingPrice !== "") {
      delta.sellingPrice += Number(addon.sellingPrice) || 0;
    }
    const hasAddonPay = addon.addonRate != null && addon.addonRate !== "";
    if (hasAddonPay) return;
    ["cuttingRate", "stitchingRate", "checkingRate", "packingRate"].forEach((f) => {
      if (addon[f] != null && addon[f] !== "") delta[f] += Number(addon[f]) || 0;
    });
  });
  return delta;
}

function sumAddonLabor(addons) {
  return (addons || []).reduce((sum, a) => sum + (Number(a.addonRate) || 0), 0);
}

const STATION_LIST = ["Cutting", "Stitching", "Checking", "Packing"];

function normalizeRequiresStations(value) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((s) => s.trim())
      : null;
  const cleaned = (list || []).filter((s) => STATION_LIST.includes(s));
  return cleaned.length ? cleaned : ["Cutting", "Stitching"];
}

/** Article base rates only — measurementId is ignored (kept for call-site compat). */
export function resolveRates(article, _opts = {}) {
  return {
    sellingPrice: Number(article.sellingPrice) || 0,
    cuttingRate: Number(article.cuttingRate) || 0,
    stitchingRate: Number(article.stitchingRate) || 0,
    checkingRate: Number(article.checkingRate) || 0,
    packingRate: Number(article.packingRate) || 0,
  };
}

const DEFAULT_DEPTS = { cutting: true, stitching: true, checking: true, packing: true };

/** Labor from department rates. Pass departments to count only enabled stations. */
export function calcLaborCost(rates, departments = null) {
  const d = departments ? { ...DEFAULT_DEPTS, ...departments } : DEFAULT_DEPTS;
  return (
    (d.cutting ? Number(rates.cuttingRate) || 0 : 0) +
    (d.stitching ? Number(rates.stitchingRate) || 0 : 0) +
    (d.checking ? Number(rates.checkingRate) || 0 : 0) +
    (d.packing ? Number(rates.packingRate) || 0 : 0)
  );
}

/**
 * Keep the same margin % when labor changes (e.g. a department is skipped).
 * Example: sell 100, labor 90 → 10% margin. Skip 10 labor → suggest 80/0.9 ≈ 89.
 */
export function suggestPriceKeepingMargin(baseSelling, fullLabor, activeLabor) {
  const selling = Number(baseSelling) || 0;
  const full = Number(fullLabor) || 0;
  const active = Number(activeLabor) || 0;
  if (Math.abs(active - full) < 0.0001) return selling;
  if (selling <= 0) return active;
  const marginRatio = (selling - full) / selling;
  if (marginRatio > 0 && marginRatio < 1) {
    return active / (1 - marginRatio);
  }
  // Zero/negative margin: keep the same absolute profit (or loss)
  return Math.max(0, active + (selling - full));
}

export function calcArticleProfit(rates, departments = null) {
  const selling = Number(rates.sellingPrice) || 0;
  const labor = calcLaborCost(rates, departments);
  const profit = selling - labor;
  const margin = selling > 0 ? Number(((profit / selling) * 100).toFixed(1)) : 0;
  return { selling, labor, profit, margin };
}

export function resolvePartPricing(article, part) {
  const rates = resolveRates(article);

  const selectedAddons = (article.addons || []).filter((a) =>
    (part.addonIds || []).includes(a.id)
  );

  const addonDelta = sumAddonDeltas(selectedAddons);
  const merged = {
    sellingPrice: rates.sellingPrice + addonDelta.sellingPrice,
    cuttingRate: rates.cuttingRate + addonDelta.cuttingRate,
    stitchingRate: rates.stitchingRate + addonDelta.stitchingRate,
    checkingRate: rates.checkingRate + addonDelta.checkingRate,
    packingRate: rates.packingRate + addonDelta.packingRate,
  };
  const addonLabor = sumAddonLabor(selectedAddons);
  const laborCost = calcLaborCost(merged) + addonLabor;

  return { rates: merged, sellingPrice: merged.sellingPrice, laborCost, profit: merged.sellingPrice - laborCost, selectedAddons, addonDelta, addonLabor };
}

/** Selling-price add-on extras per set */
export function calcAddonSellingExtraPerSet(set, orderParts) {
  let extra = 0;
  for (const part of orderParts || []) {
    const article = getSetArticle(set, part.setArticleId);
    if (!article) continue;
    const qtyPerSet = Number(part.quantityPerSet) || 0;
    const baseSelling = resolveRates(article).sellingPrice;
    const withAddons = resolvePartPricing(article, part).sellingPrice;
    extra += (withAddons - baseSelling) * qtyPerSet;
  }
  return extra;
}

/** Resolve child article from set's embedded articles */
export function getSetArticle(set, setArticleId) {
  return (set?.articles || []).find((a) => a.id === setArticleId) || null;
}

/** Prefill order parts from a set's article list (qty editable on the order). */
export function setArticlesToOrderParts(setArticles) {
  return (setArticles || [])
    .filter((a) => a?.id && a?.name?.trim())
    .map((a) => ({
      setArticleId: a.id,
      quantityPerSet: 1,
      addonIds: [],
      sizeNote: "",
    }));
}

/** Sum of part selling prices × qty-per-set for the current composition */
export function calcPartsSellingPerSet(set, orderParts) {
  return (orderParts || []).reduce((sum, part) => {
    const article = getSetArticle(set, part.setArticleId);
    if (!article) return sum;
    const pricing = resolvePartPricing(article, part);
    return sum + pricing.sellingPrice * (Number(part.quantityPerSet) || 0);
  }, 0);
}

export function calcSetOrderBreakdown(set, configuration, orderParts, orderQuantity, options = {}) {
  const qty = Number(orderQuantity) || 0;
  const { orderPriceOverride, departments } = options;
  const dept = departments ? { ...DEFAULT_DEPTS, ...departments } : null;

  const lines = (orderParts || []).map((part) => {
    const article = getSetArticle(set, part.setArticleId);
    if (!article) return null;

    const pricing = resolvePartPricing(article, part);
    const qtyPerSet = Number(part.quantityPerSet) || 0;
    const requiredQty = qty * qtyPerSet;
    const sizeLabel = part.sizeNote || options.sizeText || "";
    const unitLaborFull = pricing.laborCost;
    const unitLaborActive = calcLaborCost(pricing.rates, dept);

    return {
      setArticleId: part.setArticleId,
      articleName: article.name,
      measurementId: null,
      measurementName: sizeLabel,
      sizeNote: part.sizeNote || "",
      quantityPerSet: qtyPerSet,
      requiredQty,
      addonIds: part.addonIds || [],
      unitSelling: pricing.sellingPrice,
      unitLabor: unitLaborActive,
      unitLaborFull,
      lineSelling: pricing.sellingPrice * qtyPerSet,
      lineLabor: unitLaborActive * qtyPerSet,
      lineLaborFull: unitLaborFull * qtyPerSet,
      totalSelling: pricing.sellingPrice * requiredQty,
      totalLabor: unitLaborActive * requiredQty,
    };
  }).filter(Boolean);

  const calculatedSellingPerUnit = lines.reduce((s, l) => s + l.lineSelling, 0);
  const setLaborFullPerUnit = lines.reduce((s, l) => s + l.lineLaborFull, 0);
  const setLaborPerUnit = lines.reduce((s, l) => s + l.lineLabor, 0);
  const addonExtraPerSet = calcAddonSellingExtraPerSet(set, orderParts);

  // Legacy config fixed price (if any) — otherwise sum of parts
  const configSetPrice = configuration?.setSellingPrice;
  const configBasePrice =
    configSetPrice != null && configSetPrice !== "" ? Number(configSetPrice) || 0 : null;

  let baseSuggestedPerUnit = calculatedSellingPerUnit;
  if (configBasePrice != null && configuration?.parts?.length) {
    const defaultParts = configPartsToOrderParts(configuration.parts);
    const defaultCalculated = calcPartsSellingPerSet(set, defaultParts);
    baseSuggestedPerUnit = configBasePrice + (calculatedSellingPerUnit - defaultCalculated);
  }

  const suggestedSellingPerUnit = suggestPriceKeepingMargin(
    baseSuggestedPerUnit,
    setLaborFullPerUnit,
    setLaborPerUnit
  );
  const targetMarginPercent =
    baseSuggestedPerUnit > 0
      ? Number((((baseSuggestedPerUnit - setLaborFullPerUnit) / baseSuggestedPerUnit) * 100).toFixed(1))
      : 0;

  const override =
    orderPriceOverride != null && orderPriceOverride !== ""
      ? Number(orderPriceOverride) || 0
      : null;
  const setSellingPerUnit = override ?? suggestedSellingPerUnit;
  const setProfitPerUnit = setSellingPerUnit - setLaborPerUnit;
  const realizedMarginPercent =
    setSellingPerUnit > 0
      ? Number(((setProfitPerUnit / setSellingPerUnit) * 100).toFixed(1))
      : 0;

  return {
    setName: set?.name,
    configurationName: configuration?.name || options.sizeText || "",
    configurationSetPrice: configBasePrice,
    orderQuantity: qty,
    lines,
    calculatedSellingPerUnit,
    addonExtraPerSet,
    baseSuggestedPerUnit,
    suggestedSellingPerUnit,
    targetMarginPercent,
    realizedMarginPercent,
    orderPriceOverride: override,
    setSellingPerUnit,
    setLaborPerUnit,
    setLaborFullPerUnit,
    setProfitPerUnit,
    totalSelling: setSellingPerUnit * qty,
    totalLabor: setLaborPerUnit * qty,
    netProfit: setProfitPerUnit * qty,
  };
}

/** Suggested PPP for a catalog article line when departments are toggled */
export function calcArticleOrderSuggestion(legacyArticle, _dimensionId, departments, options = {}) {
  if (!legacyArticle) return null;

  const rates = {
    sellingPrice: Number(legacyArticle.selling_price ?? legacyArticle.sellingPrice) || 0,
    cuttingRate: Number(legacyArticle.rate_cutting ?? legacyArticle.cuttingRate) || 0,
    stitchingRate: Number(legacyArticle.rate_stitching ?? legacyArticle.stitchingRate) || 0,
    checkingRate: Number(legacyArticle.rate_checking ?? legacyArticle.checkingRate) || 0,
    packingRate: Number(legacyArticle.rate_packing ?? legacyArticle.packingRate) || 0,
  };

  const addonIds = options.addonIds || [];
  const selectedAddons = (legacyArticle.addons || []).filter((a) =>
    addonIds.includes(a.addon_id || a.id)
  );
  let addonSell = 0;
  let addonLabor = 0;
  selectedAddons.forEach((a) => {
    const sell = a.extra_selling_price ?? a.sellingPrice;
    if (sell != null && sell !== "") addonSell += Number(sell) || 0;
    const ar = a.addon_rate ?? a.addonRate;
    if (ar != null && ar !== "") addonLabor += Number(ar) || 0;
  });

  const baseSelling = rates.sellingPrice + addonSell;
  const fullLabor = calcLaborCost(rates) + addonLabor;
  const activeLabor = calcLaborCost(rates, departments) + addonLabor;
  const suggestedPpp = suggestPriceKeepingMargin(baseSelling, fullLabor, activeLabor);
  const targetMarginPercent =
    baseSelling > 0 ? Number((((baseSelling - fullLabor) / baseSelling) * 100).toFixed(1)) : 0;

  const override =
    options.orderPriceOverride != null && options.orderPriceOverride !== ""
      ? Number(options.orderPriceOverride) || 0
      : null;
  const ppp = override ?? suggestedPpp;
  const profit = ppp - activeLabor;
  const realizedMarginPercent =
    ppp > 0 ? Number(((profit / ppp) * 100).toFixed(1)) : 0;

  return {
    baseSelling,
    fullLabor,
    activeLabor,
    suggestedPpp,
    orderPriceOverride: override,
    ppp,
    targetMarginPercent,
    realizedMarginPercent,
    profit,
  };
}

/** Flatten a set order into standard order lines for the pipeline */
export function flattenSetOrderToLines(set, setOrder, packPerCtn = 6) {
  const config = setOrder.configurationId
    ? set.configurations?.find((c) => c.id === setOrder.configurationId)
    : null;
  const sizeText = setOrder.sizeText || setOrder.size || "";
  const breakdown = calcSetOrderBreakdown(set, config, setOrder.parts, setOrder.orderQuantity, {
    orderPriceOverride: setOrder.orderPriceOverride,
    departments: setOrder.departments,
    sizeText,
  });
  const groupId = setOrder.groupId || genId("SETGRP");
  const orderQuantity = Number(setOrder.orderQuantity) || 0;

  return breakdown.lines.map((line) => {
    const article = getSetArticle(set, line.setArticleId);
    const part = (setOrder.parts || []).find((p) => p.setArticleId === line.setArticleId) || {};
    const pricing = article ? resolvePartPricing(article, part) : null;
    const rates = pricing?.rates || {
      cuttingRate: Number(article?.cuttingRate) || 0,
      stitchingRate: Number(article?.stitchingRate) || 0,
      checkingRate: Number(article?.checkingRate) || 0,
      packingRate: Number(article?.packingRate) || 0,
    };
    const sizeLabel = part.sizeNote || sizeText || "—";
    const variants = buildPartVariantsFromSetOrder(setOrder, line.quantityPerSet);
    const totalQty = variants.length
      ? variants.reduce((s, v) => s + v.quantity, 0)
      : line.requiredQty;

    return {
      article_id: `${set.id}:${line.setArticleId}`,
      article_name: `${set.name} · ${line.articleName}`,
      part_name: line.articleName,
      size_id: null,
      size_name: null,
      dimension_id: null,
      dimension_name: sizeLabel,
      pack_per_ctn: packPerCtn,
      quantity: totalQty,
      net_weight: null,
      gross_weight: null,
      carton_size: null,
      cbm: null,
      cutting_rate: rates.cuttingRate,
      stitching_rate: rates.stitchingRate,
      checking_rate: rates.checkingRate,
      packing_rate: rates.packingRate,
      set_order_meta: {
        groupId,
        setId: set.id,
        setName: set.name,
        configurationId: setOrder.configurationId || null,
        configurationName: sizeText || config?.name || "",
        sizeText,
        orderQuantity,
        designColors: setOrder.designColors || [],
        splitMode: setOrder.splitMode || "equal",
        quantityPerSet: line.quantityPerSet,
        setArticleId: line.setArticleId,
        partName: line.articleName,
        sizeNote: part.sizeNote || "",
        addonIds: part.addonIds || [],
        addons: (pricing?.selectedAddons || []).map((a) => {
          const n = normalizeAddon(a);
          return {
            id: n.id,
            name: n.name,
            addonRate: Number(n.addonRate) || 0,
            requiresStations: n.requiresStations,
            afterStation: n.afterStation,
          };
        }),
        departments: setOrder.departments || {
          cutting: true,
          stitching: true,
          checking: true,
          packing: true,
        },
        setSellingPerUnit: breakdown.setSellingPerUnit,
        suggestedSellingPerUnit: breakdown.suggestedSellingPerUnit,
        orderPriceOverride: breakdown.orderPriceOverride,
        addonExtraPerSet: breakdown.addonExtraPerSet,
        rates: {
          cuttingRate: rates.cuttingRate,
          stitchingRate: rates.stitchingRate,
          checkingRate: rates.checkingRate,
          packingRate: rates.packingRate,
        },
      },
      variants,
    };
  });
}

export function configPartsToOrderParts(configParts) {
  return (configParts || []).map((p) => ({
    setArticleId: p.setArticleId,
    measurementId: p.measurementId,
    quantityPerSet: p.quantityPerSet,
    addonIds: [...(p.defaultAddonIds || [])],
    sizeNote: "",
  }));
}

export function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

export function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptySetArticle() {
  return {
    id: genId("SET-ART"),
    name: "",
    description: "",
    sellingPrice: "",
    cuttingRate: "",
    stitchingRate: "",
    checkingRate: "",
    packingRate: "",
    measurements: [],
    addons: [],
  };
}

export function emptyMeasurement() {
  return { id: genId("MEASURE"), name: "", sellingPrice: null, cuttingRate: null, stitchingRate: null, checkingRate: null, packingRate: null };
}

export function emptyAddon() {
  return {
    id: genId("ADDON"),
    name: "",
    sellingPrice: null,
    cuttingRate: null,
    stitchingRate: null,
    checkingRate: null,
    packingRate: null,
    addonRate: null,
    requiresStations: ["Cutting", "Stitching"],
    afterStation: "Checking",
  };
}

export function normalizeAddon(addon) {
  const after = addon.afterStation || addon.after_station || "Checking";
  return {
    id: addon.id || genId("ADDON"),
    name: addon.name || "",
    sellingPrice: addon.sellingPrice ?? addon.extraSellingPrice ?? null,
    cuttingRate: addon.cuttingRate ?? null,
    stitchingRate: addon.stitchingRate ?? addon.extraStitchingCost ?? null,
    checkingRate: addon.checkingRate ?? null,
    packingRate: addon.packingRate ?? null,
    addonRate: addon.addonRate ?? addon.addon_rate ?? null,
    requiresStations: normalizeRequiresStations(addon.requiresStations ?? addon.requires_stations),
    afterStation: STATION_LIST.includes(after) ? after : "Checking",
  };
}

export function articleToLegacy(article) {
  return {
    article_id: article.id,
    article_name: article.name,
    article_description: article.description || "",
    selling_price: article.sellingPrice,
    rate_cutting: article.cuttingRate,
    rate_stitching: article.stitchingRate,
    rate_checking: article.checkingRate,
    rate_packing: article.packingRate,
    sizes: [],
    dimensions: [],
    variants: [],
    addons: (article.addons || []).map((a) => {
      const n = normalizeAddon(a);
      return {
        addon_id: n.id,
        addon_name: n.name,
        extra_selling_price: n.sellingPrice,
        extra_stitching_cost: n.stitchingRate,
        addon_rate: n.addonRate,
        requires_stations: n.requiresStations,
        after_station: n.afterStation,
        id: n.id,
        name: n.name,
        sellingPrice: n.sellingPrice,
        addonRate: n.addonRate,
        requiresStations: n.requiresStations,
        afterStation: n.afterStation,
      };
    }),
  };
}
