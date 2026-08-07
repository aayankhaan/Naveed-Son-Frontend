import { useMemo } from "react";
import { COLORS } from "../../constants/theme";
import { formatPKR, genId, emptyAddon, normalizeAddon } from "../../lib/manufacturingPricing";
import AddonConfigFields from "./AddonConfigFields";

export { emptyAddon };

function normalizeRateField(value) {
  return value === "" || value == null ? null : Number(value);
}

function calcLiveProfit(article) {
  const cutting = Number(article.cuttingRate) || 0;
  const stitching = Number(article.stitchingRate) || 0;
  const checking = Number(article.checkingRate) || 0;
  const packing = Number(article.packingRate) || 0;
  const selling = Number(article.sellingPrice) || 0;
  const totalStationCost = cutting + stitching + checking + packing;
  const profit = selling - totalStationCost;
  const profitMargin = selling > 0 ? Number(((profit / selling) * 100).toFixed(1)) : 0;
  return { totalStationCost, profit, profitMargin };
}

function WrenchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M9.5 2.5a3.8 3.8 0 0 0-4.6 4.6L1.5 10.5a1.4 1.4 0 0 0 2 2l3.4-3.4a3.8 3.8 0 0 0 4.6-4.6l-2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Article costing fields — wages, sell price, add-ons.
 * Size / measurement lives on the order, not here.
 */
export default function ArticleCostingForm({ article, onChange, onRemove, index = 0, showProfitCalc = true, embedded = false }) {
  const addons = article.addons || [];
  const liveCalc = useMemo(() => calcLiveProfit(article), [article]);

  function patch(fields) {
    onChange({ ...article, ...fields });
  }

  function updateAddon(i, field, value) {
    patch({ addons: addons.map((a, j) => (j === i ? { ...a, [field]: value } : a)) });
  }

  return (
    <div
      className={`${embedded ? "rounded-xl mb-0" : "rounded-2xl mb-5 last:mb-0"} overflow-hidden`}
      style={{ background: embedded ? "transparent" : COLORS.card, border: embedded ? "none" : `1px solid ${COLORS.border}` }}
    >
      {!embedded && (
      <div className="flex items-center justify-between px-4 py-3" style={{ background: COLORS.goldSoft, borderBottom: `1px solid ${COLORS.border}` }}>
        <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: COLORS.goldDim }}>
          Set Article {index + 1}{article.name ? ` — ${article.name}` : ""}
        </span>
        {onRemove && (
          <button type="button" className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ color: COLORS.rust }} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      )}

      <div className={embedded ? "pt-1" : "p-4 sm:p-5"}>
        {embedded && onRemove && (
          <div className="flex justify-end mb-3">
            <button type="button" className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ color: COLORS.rust, background: COLORS.rustSoft }} onClick={onRemove}>Remove article</button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              required
              className="form-input"
              value={article.name || ""}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Duvet Cover"
            />
          </div>
          <div>
            <label className="form-label">Product Description</label>
            <input
              className="form-input"
              value={article.description || ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Short specification"
            />
          </div>
        </div>

        <section className="rounded-2xl p-4 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
          <h4 className="text-[11.5px] font-semibold uppercase tracking-wide mb-3" style={{ color: COLORS.ink }}>
            Work-Station Wage Rates (Per Piece)
          </h4>
          <p className="text-[11px] mb-3" style={{ color: COLORS.graphiteLight }}>
            Same rates for every size — size is set on the order.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["cuttingRate", "Cutting"],
              ["stitchingRate", "Stitching"],
              ["checkingRate", "Checking"],
              ["packingRate", "Packing"],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="form-label">{label} (PKR)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="form-input"
                  value={article[field] ?? ""}
                  onChange={(e) => patch({ [field]: e.target.value })}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="mb-5">
          <label className="form-label">Selling Price (PKR / Piece) *</label>
          <input
            type="number"
            min="0"
            step="any"
            className="form-input"
            value={article.sellingPrice ?? ""}
            onChange={(e) => patch({ sellingPrice: e.target.value })}
            placeholder="e.g. 850"
          />
          <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
            Catalog hint — customer price can be overridden on the order.
          </p>
        </div>

        <section className="rounded-2xl p-4 mb-5" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: COLORS.ink }}>
                <WrenchIcon /> Add-ons
              </h4>
              <p className="text-[11px] mt-1" style={{ color: COLORS.graphiteLight }}>Extras like Button — paid separately in daily entry after required stations.</p>
            </div>
            <button type="button" className="btn-primary shrink-0 text-[11.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: COLORS.gold, color: COLORS.inkSurface }} onClick={() => patch({ addons: [...addons, emptyAddon()] })}>+ Add add-on</button>
          </div>
          {addons.length === 0 ? (
            <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>No add-ons yet.</p>
          ) : addons.map((addon, aIndex) => (
            <div key={addon.id || aIndex} className="rounded-xl overflow-hidden mb-4 last:mb-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: COLORS.goldSoft, borderBottom: `1px solid ${COLORS.border}` }}>
                <span className="text-[11px] font-semibold uppercase" style={{ color: COLORS.goldDim }}>Add-on {aIndex + 1}</span>
                <button type="button" className="text-[11px] font-semibold" style={{ color: COLORS.rust }} onClick={() => patch({ addons: addons.filter((_, j) => j !== aIndex) })}>Remove</button>
              </div>
              <div className="p-4">
                <div className="mb-4">
                  <label className="form-label">Add-on name</label>
                  <input className="form-input" value={addon.name || ""} onChange={(e) => updateAddon(aIndex, "name", e.target.value)} placeholder="e.g. Button" />
                </div>
                <AddonConfigFields addon={addon} onChange={(field, value) => updateAddon(aIndex, field, value)} />
              </div>
            </div>
          ))}
        </section>

        {showProfitCalc && (
          <div className="rounded-xl p-4" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.goldDim }}>
              Labor &amp; Profit Calculator
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[10px] font-medium" style={{ color: COLORS.graphite }}>Total Labor Cost</div>
                <div className="text-[14px] font-semibold mt-0.5" style={{ color: COLORS.ink }}>{formatPKR(liveCalc.totalStationCost)}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium" style={{ color: liveCalc.profit >= 0 ? COLORS.green : COLORS.rust }}>Net Profit / Piece</div>
                <div className="text-[14px] font-semibold mt-0.5" style={{ color: liveCalc.profit >= 0 ? COLORS.green : COLORS.rust }}>{formatPKR(liveCalc.profit)}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium" style={{ color: COLORS.graphite }}>Profit Margin</div>
                <div className="text-[14px] font-bold mt-0.5" style={{ color: liveCalc.profit >= 0 ? COLORS.green : COLORS.rust }}>{liveCalc.profitMargin}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Normalize article fields when saving inside a set */
export function normalizeSetArticle(article) {
  return {
    ...article,
    id: article.id || genId("SET-ART"),
    name: article.name?.trim() || "",
    description: article.description?.trim() || "",
    sellingPrice: Number(article.sellingPrice) || 0,
    cuttingRate: Number(article.cuttingRate) || 0,
    stitchingRate: Number(article.stitchingRate) || 0,
    checkingRate: Number(article.checkingRate) || 0,
    packingRate: Number(article.packingRate) || 0,
    measurements: [],
    addons: (article.addons || []).filter((a) => a.name?.trim()).map((a) => {
      const n = normalizeAddon(a);
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
}
