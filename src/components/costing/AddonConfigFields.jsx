import { COLORS } from "../../constants/theme";
import { STATION_ORDER } from "../../lib/productionFlow";

/**
 * Pay rate + prerequisite / unlock stations for an add-on (Button, Lace, …).
 */
export default function AddonConfigFields({ addon, onChange }) {
  const requires = Array.isArray(addon.requiresStations) && addon.requiresStations.length
    ? addon.requiresStations
    : ["Cutting", "Stitching"];
  const after = addon.afterStation || "Checking";

  function toggleRequire(station) {
    const next = requires.includes(station)
      ? requires.filter((s) => s !== station)
      : [...requires, station];
    onChange("requiresStations", next.length ? next : ["Cutting", "Stitching"]);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Sell addition <span style={{ color: COLORS.graphiteLight }}>(PKR)</span></label>
          <input
            type="number"
            min="0"
            step="any"
            className="form-input"
            value={addon.sellingPrice ?? ""}
            onChange={(e) => onChange("sellingPrice", e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="form-label">Addon pay rate <span style={{ color: COLORS.graphiteLight }}>(PKR / pc)</span></label>
          <input
            type="number"
            min="0"
            step="any"
            className="form-input"
            value={addon.addonRate ?? ""}
            onChange={(e) => onChange("addonRate", e.target.value)}
            placeholder="e.g. 5"
          />
        </div>
      </div>

      <div>
        <div className="form-label mb-2">Must finish before this add-on</div>
        <div className="flex flex-wrap gap-3">
          {STATION_ORDER.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.ink }}>
              <input
                type="checkbox"
                checked={requires.includes(s)}
                onChange={() => toggleRequire(s)}
              />
              {s}
            </label>
          ))}
        </div>
        <p className="text-[10.5px] mt-1.5" style={{ color: COLORS.graphiteLight }}>
          Example: Button needs Cutting + Stitching done first — then the last of those (Stitching) logs Button.
        </p>
      </div>

      <div>
        <label className="form-label">Then unlocks</label>
        <select
          className="form-input"
          value={after}
          onChange={(e) => onChange("afterStation", e.target.value)}
        >
          {STATION_ORDER.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <p className="text-[10.5px] mt-1.5" style={{ color: COLORS.graphiteLight }}>
          That station waits until this add-on is logged (usually Checking).
        </p>
      </div>
    </div>
  );
}
