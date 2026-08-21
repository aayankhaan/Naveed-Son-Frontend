// Build order lines from Item Costing v2 (article → type → material × size)

import {
  genId,
  partLabourTotal,
  companyRateAt,
  calcTypeLabourAtSize,
  resolvePackingOption,
} from "./costingV2";
import {
  buildVariantsFromDesignColors,
  buildPartVariantsFromSetOrder,
} from "./orderDesignColor";

export function formatPKR(n) {
  return `PKR ${Math.round(Number(n) || 0).toLocaleString()}`;
}

/** Larger of parsed dimensions ≥ 200 → prefer Double, else Single. */
export function suggestSizeIdFromMeasurement(measurement, sizes) {
  const list = Array.isArray(sizes) ? sizes : [];
  if (!list.length) return "";
  const nums = String(measurement || "")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((n) => Number.isFinite(n)) || [];
  const larger = nums.length ? Math.max(...nums) : 0;
  const want = larger >= 200 ? "double" : "single";
  const match = list.find((s) => String(s.name || "").toLowerCase().includes(want));
  return match?.id || list[0].id;
}

function labourForPart(type, part, sizeId) {
  const same = type.labourSameForAllSizes !== false;
  if (same) return part?.labour || {};
  return (part?.labourBySize && part.labourBySize[sizeId]) || part?.labour || {};
}

function packingSnapshot(type, packingOptionId) {
  const opt = resolvePackingOption(type, packingOptionId);
  return {
    packingOptionId: opt?.id || packingOptionId || null,
    packingOptionName: opt?.name || "Simple packing",
    labourRate: Number(opt?.labourRate) || 0,
    companyRate: Number(opt?.companyRate) || 0,
  };
}

function snapshotAddons(type, addonIds) {
  const idSet = new Set((addonIds || []).map(String));
  return (type.addons || [])
    .filter((a) => idSet.has(String(a.id)))
    .map((a) => ({
      id: a.id,
      name: a.name,
      addonRate: Number(a.addonRate) || 0,
      companyRate: Number(a.companyRate) || 0,
      requiresStations: a.requiresStations || ["Checking"],
      afterStation: a.afterStation || "Packing",
      department: a.department || "Packing",
      scope: a.scope || "whole",
      partId: a.partId || null,
    }));
}

export function typeCompanyTotal(type, materialId, sizeId, addonIds, packingOptionId = null) {
  const base = companyRateAt(type, materialId, sizeId);
  const pack = packingSnapshot(type, packingOptionId);
  const extras = snapshotAddons(type, addonIds).reduce(
    (s, a) => s + (Number(a.companyRate) || 0),
    0
  );
  return base + pack.companyRate + extras;
}

export function typeLabourPreview(type, sizeId, addonIds, packingOptionId = null) {
  const labor = calcTypeLabourAtSize(type, sizeId, packingOptionId);
  const allAddon = (type.addons || []).reduce((s, a) => s + (Number(a.addonRate) || 0), 0);
  const selected = snapshotAddons(type, addonIds).reduce(
    (s, a) => s + (Number(a.addonRate) || 0),
    0
  );
  return labor - allAddon + selected;
}

/**
 * Flatten one type order block into API order lines.
 * Multi-part → one line per part (setId = typeId for Daily Entry grouping).
 * Packing labour from selected packing type; setPackingRate in meta.
 */
export function flattenTypeOrderToLines(article, type, order) {
  const materialId = order.materialId;
  const sizeId = order.sizeId;
  const size = (type.sizes || []).find((s) => s.id === sizeId);
  const material = (type.materials || []).find((m) => m.id === materialId);
  const measurement = String(order.measurement || "").trim();
  const sizeText = measurement || size?.name || "";
  const orderQty = Math.max(1, Number(order.orderQuantity) || 1);
  const packPerCtn = Math.max(1, Number(order.packPerCtn) || 6);
  const departments = order.departments || {
    cutting: true,
    stitching: true,
    checking: true,
    packing: true,
  };
  const addonIds = order.addonIds || [];
  const addons = snapshotAddons(type, addonIds);
  const packingOptionId = order.packingOptionId || type.packingOptions?.[0]?.id || null;
  const pack = packingSnapshot(type, packingOptionId);
  const companyPerSet = typeCompanyTotal(type, materialId, sizeId, addonIds, packingOptionId);
  const override =
    order.orderPriceOverride === "" || order.orderPriceOverride == null
      ? null
      : Number(order.orderPriceOverride);
  const sellPerSet = override != null && Number.isFinite(override) ? override : companyPerSet;
  const setPacking = pack.labourRate;
  const groupId = order.groupId || genId("GRP");
  const setName = `${article.name} · ${type.name}`;
  const designColors = order.designColors || [];
  const splitMode = order.splitMode || "equal";
  const parts = type.parts || [];
  const isMultiPart = parts.length > 0;

  const sharedMeta = {
    groupId,
    ...(isMultiPart ? { setId: type.id, setName } : {}),
    typeId: type.id,
    typeName: type.name,
    articleId: article.id,
    articleName: article.name,
    materialId,
    materialName: material?.name || "",
    sizeId,
    sizeName: size?.name || "",
    sizeText,
    measurement: sizeText,
    orderQuantity: orderQty,
    designColors,
    splitMode,
    addonIds,
    addons,
    departments,
    packingOptionId: pack.packingOptionId,
    packingOptionName: pack.packingOptionName,
    packingCompanyRate: pack.companyRate,
    setPackingRate: setPacking,
    setSellingPerUnit: sellPerSet,
    suggestedSellingPerUnit: companyPerSet,
    ...(override != null && Number.isFinite(override) ? { orderPriceOverride: override } : {}),
    typeNote: type.description || "",
  };

  if (!isMultiPart) {
    const same = type.labourSameForAllSizes !== false;
    const L = same
      ? type.labour
      : (type.labourBySize && type.labourBySize[sizeId]) || type.labour || {};
    const pieceQty = orderQty;
    const variants = variantsForQty(designColors, splitMode, pieceQty);

    return [
      {
        article_id: type.id,
        article_name: setName,
        dimension_name: sizeText || null,
        quantity: pieceQty,
        pack_per_ctn: packPerCtn,
        cutting_rate: Number(L.cuttingRate) || 0,
        stitching_rate: Number(L.stitchingRate) || 0,
        checking_rate: Number(L.checkingRate) || 0,
        packing_rate: setPacking,
        skip_cutting: !departments.cutting,
        skip_stitching: !departments.stitching,
        skip_checking: !departments.checking,
        skip_packing: !departments.packing,
        variants,
        set_order_meta: {
          ...sharedMeta,
          quantityPerSet: 1,
          setArticleId: type.id,
          partName: type.name,
          rates: {
            cuttingRate: Number(L.cuttingRate) || 0,
            stitchingRate: Number(L.stitchingRate) || 0,
            checkingRate: Number(L.checkingRate) || 0,
            packingRate: setPacking,
          },
        },
      },
    ];
  }

  const setOrderLike = {
    orderQuantity: orderQty,
    designColors,
    splitMode,
  };

  return parts.map((part, idx) => {
    const qps = Math.max(0, Number(part.qtyBySize?.[sizeId] ?? 1) || 0) || 1;
    const pieceQty = orderQty * qps;
    const L = labourForPart(type, part, sizeId);
    // Store packing so pieces × rate = set packing (1×), whatever qty/set is
    const packingRate = idx === 0 ? setPacking / qps : 0;
    const rates = {
      cuttingRate: Number(L.cuttingRate) || 0,
      stitchingRate: Number(L.stitchingRate) || 0,
      checkingRate: Number(L.checkingRate) || 0,
      packingRate,
    };
    let variants = buildPartVariantsFromSetOrder(setOrderLike, qps);
    if (!variants.length) {
      variants = variantsForQty(designColors, splitMode, pieceQty);
    }

    return {
      article_id: `${type.id}:${part.id}`,
      article_name: `${setName} · ${part.name}`,
      dimension_name: sizeText || null,
      quantity: pieceQty,
      pack_per_ctn: packPerCtn,
      cutting_rate: rates.cuttingRate,
      stitching_rate: rates.stitchingRate,
      checking_rate: rates.checkingRate,
      packing_rate: packingRate,
      skip_cutting: !departments.cutting,
      skip_stitching: !departments.stitching,
      skip_checking: !departments.checking,
      skip_packing: !departments.packing,
      variants,
      set_order_meta: {
        ...sharedMeta,
        quantityPerSet: qps,
        setArticleId: part.id,
        partId: part.id,
        partName: part.name,
        rates,
        partLabour: partLabourTotal(L),
      },
    };
  });
}

function variantsForQty(designColors, splitMode, totalQty) {
  const built = buildVariantsFromDesignColors(designColors, splitMode, totalQty);
  if (built.length) {
    return built.map((v) => ({
      variant_name: v.variant_name,
      quantity: v.quantity,
      barcode: v.barcode || null,
    }));
  }
  return [{ variant_name: "Default", quantity: totalQty }];
}

export function emptyTypeBlock(articles) {
  const article = articles?.[0] || null;
  const type = article?.types?.[0] || null;
  return {
    key: genId("TYPE-BLOCK"),
    articleId: article?.id || "",
    typeId: type?.id || "",
    materialId: type?.materials?.[0]?.id || "",
    sizeId: type?.sizes?.[0]?.id || "",
    packingOptionId: type?.packingOptions?.[0]?.id || "",
    measurement: "",
    orderQuantity: 1,
    packPerCtn: 6,
    orderPriceOverride: "",
    addonIds: [],
    departments: { cutting: true, stitching: true, checking: true, packing: true },
    designColors: [],
    splitMode: "equal",
    expanded: true,
  };
}
