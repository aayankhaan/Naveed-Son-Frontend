// ========================================
// Forecast.jsx
// Production Forecast & Output Estimates page.
// Tracks historical production trends over time and generates predictive
// estimates for expected unit output, workstation capacity loads, and revenue.
// ========================================

import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon } from "../components/icons/CommonIcons";

const HISTORICAL_FORECAST_DATA = [
  { day: "Jul 01", actual: 1450, forecast: null, cutting: 400, stitching: 350, checking: 400, packing: 300 },
  { day: "Jul 05", actual: 1620, forecast: null, cutting: 450, stitching: 400, checking: 420, packing: 350 },
  { day: "Jul 10", actual: 1580, forecast: null, cutting: 430, stitching: 390, checking: 410, packing: 350 },
  { day: "Jul 15", actual: 1790, forecast: null, cutting: 500, stitching: 440, checking: 450, packing: 400 },
  { day: "Jul 20", actual: 1850, forecast: null, cutting: 520, stitching: 460, checking: 470, packing: 400 },
  { day: "Jul 25", actual: 1920, forecast: null, cutting: 540, stitching: 480, checking: 490, packing: 410 },
  { day: "Jul 30", actual: 2050, forecast: 2050, cutting: 580, stitching: 500, checking: 520, packing: 450 },
  // Projected Future Forecast
  { day: "Aug 04", actual: null, forecast: 2180, cutting: 610, stitching: 530, checking: 550, packing: 490 },
  { day: "Aug 09", actual: null, forecast: 2290, cutting: 640, stitching: 560, checking: 580, packing: 510 },
  { day: "Aug 14", actual: null, forecast: 2360, cutting: 660, stitching: 580, checking: 590, packing: 530 },
  { day: "Aug 19", actual: null, forecast: 2450, cutting: 690, stitching: 600, checking: 610, packing: 550 },
  { day: "Aug 24", actual: null, forecast: 2580, cutting: 720, stitching: 630, checking: 640, packing: 590 },
  { day: "Aug 29", actual: null, forecast: 2710, cutting: 760, stitching: 660, checking: 670, packing: 620 },
];

const ITEM_FORECAST_SEED = [
  {
    id: "ART-101",
    name: "Bedsheet Set — King",
    avgDailyOutput: 420,
    targetDailyOutput: 480,
    contractRate: 850,
    bottleneckStation: "Stitching",
    capacityLoad: 92,
    status: "Peak Load",
  },
  {
    id: "ART-102",
    name: "Duvet Cover Set — Double",
    avgDailyOutput: 280,
    targetDailyOutput: 340,
    contractRate: 1250,
    bottleneckStation: "Stitching",
    capacityLoad: 88,
    status: "Optimal",
  },
  {
    id: "ART-103",
    name: "Pillow Cover Pack (Pair)",
    avgDailyOutput: 750,
    targetDailyOutput: 900,
    contractRate: 380,
    bottleneckStation: "Packing",
    capacityLoad: 74,
    status: "Optimal",
  },
  {
    id: "ART-104",
    name: "Cushion Cover 45x45",
    avgDailyOutput: 600,
    targetDailyOutput: 720,
    contractRate: 280,
    bottleneckStation: "Cutting",
    capacityLoad: 68,
    status: "Smooth",
  },
];

const WORKSTATION_CAPACITIES = [
  { name: "Cutting", currentLoad: 78, maxCapacity: "3,200 units/day", status: "Optimal", color: COLORS.graphiteLight },
  { name: "Stitching", currentLoad: 94, maxCapacity: "2,100 units/day", status: "High Demand (Bottleneck Risk)", color: COLORS.gold },
  { name: "Checking", currentLoad: 82, maxCapacity: "3,500 units/day", status: "Optimal", color: COLORS.goldDim },
  { name: "Packing", currentLoad: 71, maxCapacity: "3,800 units/day", status: "Smooth Flow", color: COLORS.green },
];

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

function TrendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 12.5l4.5-5 3.5 3 5-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 3.5h3.5V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 13.5a6.5 6.5 0 1 1 11 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 8l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5l1.8 4.7 4.7 1.8-4.7 1.8L8 14.5l-1.8-4.7L1.5 8l4.7-1.8L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function BanknoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8.25" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.3 6v.01M12.7 10.5v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ status }) {
  let bg = COLORS.greenSoft;
  let fg = COLORS.green;
  if (status.includes("Bottleneck") || status.includes("Peak")) {
    bg = COLORS.rustSoft;
    fg = COLORS.rust;
  } else if (status.includes("High")) {
    bg = COLORS.goldSoft;
    fg = COLORS.goldDim;
  }

  return (
    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg }}>
      {status}
    </span>
  );
}

export default function ForecastPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [horizonDays, setHorizonDays] = useState(15);
  const [search, setSearch] = useState("");

  const projectedTotalUnits = useMemo(() => {
    return ITEM_FORECAST_SEED.reduce((sum, item) => sum + item.targetDailyOutput * horizonDays, 0);
  }, [horizonDays]);

  const projectedRevenue = useMemo(() => {
    return ITEM_FORECAST_SEED.reduce((sum, item) => sum + (item.targetDailyOutput * horizonDays * item.contractRate), 0);
  }, [horizonDays]);

  const filteredItems = useMemo(() => {
    return ITEM_FORECAST_SEED.filter(
      (item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.bottleneckStation.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.bone, fontFamily: FONT }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 px-5 md:px-8 py-4 sticky top-0 z-30 backdrop-blur" style={{ background: `${COLORS.bone}F2`, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" className="md:hidden p-2 rounded-lg btn-secondary shrink-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4h12M2 8h12M2 12h12" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{ color: COLORS.ink }}>Production Forecast &amp; Output Estimates</h1>
              <p className="text-[12px]" style={{ color: COLORS.graphiteLight }}>Predictive output estimates based on historical station velocity</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="select-wrap">
              <select value={horizonDays} onChange={(e) => setHorizonDays(Number(e.target.value))}>
                <option value={7}>Next 7 Days</option>
                <option value={15}>Next 15 Days (Pay Cycle)</option>
                <option value={30}>Next 30 Days</option>
                <option value={90}>Next Quarter (90 Days)</option>
              </select>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="hidden sm:flex flex-col items-end leading-tight border-l pl-3" style={{ borderColor: COLORS.border }}>
              <span className="text-[13px] font-medium" style={{ color: COLORS.ink }}>Admin</span>
              <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>Administrator</span>
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: COLORS.ink, color: COLORS.gold, border: `2px solid ${COLORS.goldSoft}` }}>
              A
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat index={0} icon={<TrendingIcon />} label={`Predicted Output (${horizonDays}d)`} value={`${projectedTotalUnits.toLocaleString()} units`} sub="+14.2% projected increase" />
            <MiniStat index={1} icon={<BanknoteIcon />} label="Expected Contract Revenue" value={formatPKR(projectedRevenue)} sub="based on unit rates" />
            <MiniStat index={2} icon={<GaugeIcon />} label="Bottleneck Station" value="Stitching" sub="94% projected capacity" />
            <MiniStat index={3} icon={<SparklesIcon />} label="Model Confidence" value="96.4%" sub="high historical accuracy" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 rounded-2xl p-6 fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>Historical vs. Projected Output Trend</h3>
                  <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>Daily unit volume from past cycles and AI forecast for upcoming period</p>
                </div>
                <div className="flex items-center gap-3 text-[11.5px]">
                  <span className="flex items-center gap-1.5" style={{ color: COLORS.ink }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.gold }} /> Actual
                  </span>
                  <span className="flex items-center gap-1.5" style={{ color: COLORS.graphite }}>
                    <span className="w-2.5 h-2.5 rounded-full border border-dashed" style={{ borderColor: COLORS.goldDim, background: `${COLORS.goldSoft}` }} /> Forecasted
                  </span>
                </div>
              </div>

              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={HISTORICAL_FORECAST_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: COLORS.graphiteLight }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: COLORS.ink, border: "none", borderRadius: 10, fontSize: 12, padding: "8px 12px" }}
                      labelStyle={{ color: COLORS.bone }}
                      formatter={(value, name) => [value ? `${value.toLocaleString()} units` : "—", name === "actual" ? "Actual Output" : "Forecasted Output"]}
                    />
                    <Area type="monotone" dataKey="actual" stroke={COLORS.gold} strokeWidth={2.4} fill="url(#actualFill)" />
                    <Area type="monotone" dataKey="forecast" stroke={COLORS.green} strokeWidth={2.4} strokeDasharray="5 5" fill="url(#forecastFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl p-6 fade-in flex flex-col justify-between" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div>
                <h3 className="text-[15px] font-semibold mb-1" style={{ color: COLORS.ink }}>Work-Station Capacity Load</h3>
                <p className="text-[11.5px] mb-5" style={{ color: COLORS.graphiteLight }}>Predicted throughput load per station</p>

                <div className="flex flex-col gap-4">
                  {WORKSTATION_CAPACITIES.map((st) => (
                    <div key={st.name}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="font-semibold" style={{ color: COLORS.ink }}>{st.name} Station</span>
                        <span className="font-semibold" style={{ color: st.currentLoad > 90 ? COLORS.rust : COLORS.ink }}>
                          {st.currentLoad}% Load
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: COLORS.boneDim }}>
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${st.currentLoad}%`,
                            background: st.currentLoad > 90 ? COLORS.rust : st.currentLoad > 80 ? COLORS.gold : COLORS.green
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10.5px]" style={{ color: COLORS.graphiteLight }}>
                        <span>Cap: {st.maxCapacity}</span>
                        <StatusBadge status={st.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 p-3 rounded-xl text-[11.5px]" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}`, color: COLORS.goldDim }}>
                💡 <strong>AI Tip:</strong> Stitching is approaching 94% capacity. Consider shifting 2 temporary stitchers from Packing to prevent backlog.
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <div className="p-5 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.boneDim }}>
              <div>
                <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Item-wise Predicted Output Targets</h3>
                <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>Projected output units and revenue estimates for the next {horizonDays} days</p>
              </div>
              <div className="search-wrap">
                <SearchIcon />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or station" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ background: COLORS.boneDim }}>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Article / Product</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Hist Avg / Day</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Target / Day</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>{horizonDays}d Est Output</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Est Revenue</th>
                    <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Bottleneck Risk</th>
                    <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const horizonOutput = item.targetDailyOutput * horizonDays;
                    const horizonRevenue = horizonOutput * item.contractRate;

                    return (
                      <tr key={item.id} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-5 py-3.5">
                          <span className="flex flex-col">
                            <span className="font-semibold" style={{ color: COLORS.ink }}>{item.name}</span>
                            <span className="text-[11px]" style={{ color: COLORS.graphiteLight }}>#{item.id} · Rate: PKR {item.contractRate}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right" style={{ color: COLORS.graphite }}>{item.avgDailyOutput} pcs</td>
                        <td className="px-5 py-3.5 text-right font-semibold" style={{ color: COLORS.ink }}>{item.targetDailyOutput} pcs</td>
                        <td className="px-5 py-3.5 text-right font-semibold" style={{ color: COLORS.goldDim }}>{horizonOutput.toLocaleString()} pcs</td>
                        <td className="px-5 py-3.5 text-right font-bold" style={{ color: COLORS.ink }}>{formatPKR(horizonRevenue)}</td>
                        <td className="px-5 py-3.5" style={{ color: COLORS.graphite }}>{item.bottleneckStation} ({item.capacityLoad}%)</td>
                        <td className="px-5 py-3.5 text-right"><StatusBadge status={item.status} /></td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-[12.5px]" style={{ color: COLORS.graphiteLight }}>
                        No products match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

        .fade-in { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .panel, .btn-secondary { transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease; }
        .panel:hover { box-shadow: 0 10px 26px -18px rgba(28,25,23,0.22); }
        .tbl-row:hover { background: ${COLORS.boneDim}77; }

        button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }

        .select-wrap { position: relative; display: inline-flex; align-items: center; }
        .select-wrap select {
          appearance: none; font-family: ${FONT}; font-size: 12.5px; font-weight: 500;
          color: ${COLORS.ink}; background: ${COLORS.card}; border: 1px solid ${COLORS.border};
          border-radius: 8px; padding: 8px 28px 8px 12px; cursor: pointer; outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .select-wrap select:hover, .select-wrap select:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }
        .select-caret { position: absolute; right: 10px; pointer-events: none; }

        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 240px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .search-wrap input::placeholder { color: ${COLORS.graphiteLight}; }
        .search-wrap input:hover, .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        .nav-item { transition: background .18s ease, transform .18s ease, color .18s ease; }
        .nav-item:hover:not(:disabled) { background: ${COLORS.inkSoft} !important; transform: translateX(2px); }

        table th, table td { white-space: nowrap; }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.boneBorder}; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.graphiteLight}; }
      `}</style>
    </div>
  );
}
