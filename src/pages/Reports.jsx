// ========================================
// Reports.jsx
// Management Reports & Export Data Hub.
// Supports dynamic date range filtering (This Week, This Month, Last 30 Days, Custom Range)
// with custom Start & End date pickers that dynamically adjust data figures.
// 100% Clean SVG icons used throughout (no raw text emojis).
// ========================================

import { useState, useMemo } from "react";
import { FONT, COLORS } from "../constants/theme";
import Sidebar from "../components/layout/Sidebar";
import { SearchIcon } from "../components/icons/CommonIcons";

const DUMMY_PAYROLL_BASE = [
  { empId: "EMP-101", name: "Fahad Iqbal", station: "Stitching", totalUnits: 1450, grossPay: 7250, advanceDeduction: 1000 },
  { empId: "EMP-102", name: "Bilal Hussain", station: "Cutting", totalUnits: 2300, grossPay: 5750, advanceDeduction: 0 },
  { empId: "EMP-103", name: "Sana Tariq", station: "Checking", totalUnits: 2100, grossPay: 3150, advanceDeduction: 500 },
  { empId: "EMP-104", name: "Imran Sheikh", station: "Packing", totalUnits: 1950, grossPay: 1950, advanceDeduction: 0 },
  { empId: "EMP-105", name: "Ayesha Noor", station: "Stitching", totalUnits: 1100, grossPay: 7700, advanceDeduction: 1500 },
  { empId: "EMP-106", name: "Usman Ali", station: "Cutting", totalUnits: 1800, grossPay: 6300, advanceDeduction: 0 },
];

const DUMMY_QC_BASE = [
  { empId: "EMP-101", name: "Fahad Iqbal", station: "Stitching", inspected: 1450, defects: 25 },
  { empId: "EMP-102", name: "Bilal Hussain", station: "Cutting", inspected: 2300, defects: 15 },
  { empId: "EMP-103", name: "Sana Tariq", station: "Checking", inspected: 2100, defects: 10 },
  { empId: "EMP-105", name: "Ayesha Noor", station: "Stitching", inspected: 1100, defects: 60 },
];

const DUMMY_FABRIC_BASE = [
  { clientId: "CLI-401", clientName: "Nishat Linen", fabricArticle: "Cotton Satin 220 GSM", metersReceived: 5000, expectedYield: 2000, actualDispatched: 1960 },
  { clientId: "CLI-402", clientName: "Gul Ahmed", fabricArticle: "Perch Twill 180 GSM", metersReceived: 3500, expectedYield: 1400, actualDispatched: 1390 },
  { clientId: "CLI-403", clientName: "Khaadi CMT", fabricArticle: "Jersey Knit Soft", metersReceived: 2000, expectedYield: 1000, actualDispatched: 940 },
];

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

function getFormattedDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split("T")[0];
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 13.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 5V2h8v3M4 11H2.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H12" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 9h8v5H4V9z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function BanknoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8.25" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.3 6v.01M12.7 10.5v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.8l6.2 11.2H1.8L8 1.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v3.5M8 11.8v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 5.5L14 14M5.5 10.5L14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function ReportsPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("payroll");
  const [dateRange, setDateRange] = useState("This Month");
  const [startDate, setStartDate] = useState(getFormattedDate(30));
  const [endDate, setEndDate] = useState(getFormattedDate(0));
  const [search, setSearch] = useState("");

  // Calculate scaling multiplier based on date range selection
  const rangeMultiplier = useMemo(() => {
    if (dateRange === "This Week") return 0.25;
    if (dateRange === "This Month") return 1.0;
    if (dateRange === "Last 30 Days") return 1.0;
    if (dateRange === "Custom Range") {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      return diffDays / 30;
    }
    return 1.0;
  }, [dateRange, startDate, endDate]);

  // Scaled Payroll Data
  const payrollData = useMemo(() => {
    return DUMMY_PAYROLL_BASE.map((emp) => {
      const totalUnits = Math.round(emp.totalUnits * rangeMultiplier);
      const grossPay = Math.round(emp.grossPay * rangeMultiplier);
      const advanceDeduction = rangeMultiplier < 0.5 ? Math.round(emp.advanceDeduction * 0.5) : emp.advanceDeduction;
      const netPay = Math.max(0, grossPay - advanceDeduction);
      return {
        ...emp,
        totalUnits,
        grossPay,
        advanceDeduction,
        netPay,
      };
    });
  }, [rangeMultiplier]);

  // Scaled QC Data
  const qcData = useMemo(() => {
    return DUMMY_QC_BASE.map((emp) => {
      const inspected = Math.round(emp.inspected * rangeMultiplier);
      const defects = Math.max(1, Math.round(emp.defects * rangeMultiplier));
      const passed = Math.max(0, inspected - defects);
      const passRate = inspected > 0 ? Number(((passed / inspected) * 100).toFixed(1)) : 100;
      const status = passRate >= 98 ? "Excellent" : passRate >= 95 ? "Good" : "High Defect Alert";
      return {
        ...emp,
        inspected,
        passed,
        defects,
        passRate,
        status,
      };
    });
  }, [rangeMultiplier]);

  // Scaled Fabric Data
  const fabricData = useMemo(() => {
    return DUMMY_FABRIC_BASE.map((fab) => {
      const metersReceived = Math.round(fab.metersReceived * rangeMultiplier);
      const expectedYield = Math.round(fab.expectedYield * rangeMultiplier);
      const actualDispatched = Math.round(fab.actualDispatched * rangeMultiplier);
      const wastePct = expectedYield > 0 ? Number((((expectedYield - actualDispatched) / expectedYield) * 100).toFixed(1)) : 0;
      const status = wastePct > 3 ? "High Waste Alert" : wastePct > 1 ? "Normal" : "Optimal";
      return {
        ...fab,
        metersReceived,
        expectedYield,
        actualDispatched,
        wastePct,
        status,
      };
    });
  }, [rangeMultiplier]);

  // Filtered Results by Search
  const filteredPayroll = useMemo(() => {
    return payrollData.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.empId.toLowerCase().includes(search.toLowerCase()) ||
      item.station.toLowerCase().includes(search.toLowerCase())
    );
  }, [payrollData, search]);

  const filteredQC = useMemo(() => {
    return qcData.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.empId.toLowerCase().includes(search.toLowerCase())
    );
  }, [qcData, search]);

  const filteredFabric = useMemo(() => {
    return fabricData.filter((item) =>
      item.clientName.toLowerCase().includes(search.toLowerCase()) ||
      item.fabricArticle.toLowerCase().includes(search.toLowerCase())
    );
  }, [fabricData, search]);

  function handleExportCsv() {
    let csvContent = "";
    let fileName = "";

    if (activeTab === "payroll") {
      fileName = `Payroll_Wages_${dateRange.replace(/\s+/g, "_")}.csv`;
      csvContent = "Employee ID,Full Name,Station,Total Units,Gross Earnings (PKR),Advance Deduction (PKR),Net Cash Payable (PKR)\n";
      filteredPayroll.forEach((row) => {
        csvContent += `${row.empId},"${row.name}",${row.station},${row.totalUnits},${row.grossPay},${row.advanceDeduction},${row.netPay}\n`;
      });
    } else if (activeTab === "qc") {
      fileName = `QC_Defects_${dateRange.replace(/\s+/g, "_")}.csv`;
      csvContent = "Employee ID,Full Name,Station,Inspected Units,Passed Units,Defects / Rework,Pass Rate %,Quality Status\n";
      filteredQC.forEach((row) => {
        csvContent += `${row.empId},"${row.name}",${row.station},${row.inspected},${row.passed},${row.defects},${row.passRate}%,"${row.status}"\n`;
      });
    } else {
      fileName = `Fabric_Yield_${dateRange.replace(/\s+/g, "_")}.csv`;
      csvContent = "Client ID,Client Name,Fabric Specification,Meters Received,Expected Yield,Actual Dispatched,Wastage %,Status\n";
      filteredFabric.forEach((row) => {
        csvContent += `${row.clientId},"${row.clientName}","${row.fabricArticle}",${row.metersReceived},${row.expectedYield},${row.actualDispatched},${row.wastePct}%,"${row.status}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.bone, fontFamily: FONT }}>
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2.5 px-4 sm:px-6 md:px-8 py-3.5 sticky top-0 z-30 backdrop-blur" style={{ background: `${COLORS.bone}F2`, borderBottom: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button type="button" className="md:hidden p-2 rounded-lg btn-secondary shrink-0" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke={COLORS.ink} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold truncate" style={{ color: COLORS.ink }}>Reports &amp; Data Exports</h1>
              <p className="text-[12px] hidden sm:block truncate" style={{ color: COLORS.graphiteLight }}>Export payroll wages, quality control defects, and fabric yields</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite, background: COLORS.card }}
              onClick={handlePrint}
            >
              <PrintIcon /> Print Report
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-lg shrink-0"
              style={{ background: COLORS.gold, color: COLORS.ink }}
              onClick={handleExportCsv}
            >
              <DownloadIcon /> Export CSV
            </button>
          </div>
        </div>

        <div className="p-5 md:p-8 max-w-7xl mx-auto">
          {/* Top Category Tabs */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {[
              { id: "payroll", label: "Wages & Payroll Payout", icon: <BanknoteIcon /> },
              { id: "qc", label: "Quality Control & Defects", icon: <AlertIcon /> },
              { id: "fabric", label: "Fabric Yield & Wastage", icon: <ScissorsIcon /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="btn-secondary inline-flex items-center gap-2 text-[12.5px] font-semibold px-4 py-2.5 rounded-xl whitespace-nowrap border transition-all"
                style={{
                  background: activeTab === tab.id ? COLORS.ink : COLORS.card,
                  color: activeTab === tab.id ? COLORS.gold : COLORS.graphite,
                  borderColor: activeTab === tab.id ? COLORS.ink : COLORS.border,
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Filter & Range Bar */}
          <div className="rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="search-wrap">
                <SearchIcon />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dataset record..." />
              </div>

              <div className="select-wrap">
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                  <option value="This Week">This Week (7 Days)</option>
                  <option value="This Month">This Month (30 Days)</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Custom Range">Custom Date Range</option>
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Custom Date Pickers when Custom Range is active */}
              {dateRange === "Custom Range" && (
                <div className="flex items-center gap-2 flex-wrap border-l pl-3" style={{ borderColor: COLORS.border }}>
                  <div>
                    <span className="text-[10px] font-semibold uppercase block" style={{ color: COLORS.graphite }}>From Date</span>
                    <input
                      type="date"
                      className="form-input text-[12px] font-medium"
                      style={{ width: 140 }}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase block" style={{ color: COLORS.graphite }}>To Date</span>
                    <input
                      type="date"
                      className="form-input text-[12px] font-medium"
                      style={{ width: 140 }}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <span className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: COLORS.goldSoft, color: COLORS.goldDim, border: `1px solid ${COLORS.border}` }}>
              Filter: {dateRange} {dateRange === "Custom Range" ? `(${startDate} → ${endDate})` : ""}
            </span>
          </div>

          {/* TAB 1: PAYROLL & WAGES REPORT */}
          {activeTab === "payroll" && (
            <div className="rounded-2xl overflow-hidden panel fade-in shadow-sm" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: COLORS.border, background: COLORS.boneDim }}>
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Payroll Wages Summary ({dateRange})</h3>
                  <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>Gross piece-rate earnings minus cash advance deductions for active window</p>
                </div>
                <button type="button" className="btn-primary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={handleExportCsv}>
                  <DownloadIcon /> Download CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ background: COLORS.bone }}>
                      <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Employee</th>
                      <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Station</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Completed Units</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Gross Earnings</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Advance Deduction</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Net Cash Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayroll.map((row) => (
                      <tr key={row.empId} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-5 py-3 font-semibold" style={{ color: COLORS.ink }}>{row.name} ({row.empId})</td>
                        <td className="px-5 py-3" style={{ color: COLORS.graphite }}>{row.station}</td>
                        <td className="px-5 py-3 text-right font-mono font-medium">{row.totalUnits.toLocaleString()} pcs</td>
                        <td className="px-5 py-3 text-right font-mono">{formatPKR(row.grossPay)}</td>
                        <td className="px-5 py-3 text-right font-mono text-amber-700">-{formatPKR(row.advanceDeduction)}</td>
                        <td className="px-5 py-3 text-right font-bold text-[13.5px]" style={{ color: COLORS.goldDim }}>{formatPKR(row.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: QUALITY CONTROL & DEFECTS */}
          {activeTab === "qc" && (
            <div className="rounded-2xl overflow-hidden panel fade-in shadow-sm" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: COLORS.border, background: COLORS.boneDim }}>
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Quality Control (QC) &amp; Defect Audit ({dateRange})</h3>
                  <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>Monitor inspection pass rates and flag workers with high rejections</p>
                </div>
                <button type="button" className="btn-primary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={handleExportCsv}>
                  <DownloadIcon /> Download CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ background: COLORS.bone }}>
                      <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Employee</th>
                      <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Station</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Inspected</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Passed</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Defects / Rework</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Pass Rate %</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>QC Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQC.map((row) => (
                      <tr key={row.empId} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-5 py-3 font-semibold" style={{ color: COLORS.ink }}>{row.name} ({row.empId})</td>
                        <td className="px-5 py-3" style={{ color: COLORS.graphite }}>{row.station}</td>
                        <td className="px-5 py-3 text-right font-mono">{row.inspected.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-mono text-emerald-700">{row.passed.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-amber-700">{row.defects} pcs</td>
                        <td className="px-5 py-3 text-right font-bold">{row.passRate}%</td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                            style={{
                              background: row.passRate < 95 ? COLORS.rustSoft : COLORS.greenSoft,
                              color: row.passRate < 95 ? COLORS.rust : COLORS.green,
                            }}
                          >
                            {row.passRate < 95 && <AlertIcon />} {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FABRIC YIELD & WASTAGE */}
          {activeTab === "fabric" && (
            <div className="rounded-2xl overflow-hidden panel fade-in shadow-sm" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: COLORS.border, background: COLORS.boneDim }}>
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Client Fabric Received vs Dispatched Yield ({dateRange})</h3>
                  <p className="text-[11.5px]" style={{ color: COLORS.graphiteLight }}>Track raw fabric consumption efficiency and wastage %</p>
                </div>
                <button type="button" className="btn-primary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: COLORS.gold, color: COLORS.ink }} onClick={handleExportCsv}>
                  <DownloadIcon /> Download CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ background: COLORS.bone }}>
                      <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Client</th>
                      <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Fabric Article</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Meters Received</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Expected Yield</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Actual Dispatched</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Wastage %</th>
                      <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFabric.map((row) => (
                      <tr key={row.clientId} className="tbl-row" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td className="px-5 py-3 font-semibold" style={{ color: COLORS.ink }}>{row.clientName}</td>
                        <td className="px-5 py-3" style={{ color: COLORS.graphite }}>{row.fabricArticle}</td>
                        <td className="px-5 py-3 text-right font-mono">{row.metersReceived.toLocaleString()} m</td>
                        <td className="px-5 py-3 text-right font-mono">{row.expectedYield.toLocaleString()} pcs</td>
                        <td className="px-5 py-3 text-right font-mono font-bold">{row.actualDispatched.toLocaleString()} pcs</td>
                        <td className="px-5 py-3 text-right font-bold text-amber-700">{row.wastePct}%</td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                            style={{
                              background: row.wastePct > 3 ? COLORS.rustSoft : COLORS.greenSoft,
                              color: row.wastePct > 3 ? COLORS.rust : COLORS.green,
                            }}
                          >
                            {row.wastePct > 3 && <AlertIcon />} {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .panel, .btn-primary, .btn-secondary, .tbl-row {
          transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease;
        }
        .tbl-row:hover { background: ${COLORS.boneDim}77; }

        .btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .btn-secondary:hover { border-color: ${COLORS.gold} !important; color: ${COLORS.goldDim} !important; }

        .select-wrap { position: relative; display: inline-flex; align-items: center; }
        .select-wrap select {
          appearance: none; font-family: ${FONT}; font-size: 12.5px; font-weight: 500;
          color: ${COLORS.ink}; background: ${COLORS.card}; border: 1px solid ${COLORS.border};
          border-radius: 8px; padding: 8px 28px 8px 12px; cursor: pointer; outline: none;
        }
        .select-caret { position: absolute; right: 10px; pointer-events: none; }

        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 220px;
        }

        .form-input {
          font-family: ${FONT}; font-size: 12px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 6px 10px; outline: none;
        }

        @media print {
          body { background: white !important; }
          .btn-primary, .btn-secondary, sidebar, nav, .search-wrap, .select-wrap { display: none !important; }
        }
      `}</style>
    </div>
  );
}
