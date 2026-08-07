// ========================================
// Employees.jsx
// Employee roster with piece-rate pay, installment deductions,
// employee earnings/work-log modal, and full CRUD (Add/Edit/Delete).
// ========================================

import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FONT, COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import ModalLayer from "../components/ui/ModalLayer";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, ChevronIcon, CloseIcon, SparkIcon } from "../components/icons/CommonIcons";
import { API_BASE, apiFetch } from "../lib/api";
import { getEmployeeBatchDateSetting, setEmployeeBatchDateSetting } from "../lib/employeeBatchDate";
import LoansTab from "../components/employees/LoansTab";
import EmployeePayModal from "../components/employees/EmployeePayModal";
import { useAuth } from "../context/AuthContext";
import ReadOnlyBanner from "../components/auth/ReadOnlyBanner";

// Turns a relative "/uploads/xyz.jpg" path from the backend into a full URL
// the browser can actually load. Leaves absolute URLs and blob: previews as-is.
function getImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_BASE}${path}`;
}

const STATION_META = [
  { name: "Cutting", color: COLORS.graphiteLight },
  { name: "Stitching", color: COLORS.gold },
  { name: "Checking", color: COLORS.goldDim },
  { name: "Packing", color: COLORS.green },
  { name: "Management", color: COLORS.rust },
];
const STATION_COLOR = Object.fromEntries(STATION_META.map((s) => [s.name, s.color]));
const FLOOR_STATIONS = ["Cutting", "Stitching", "Checking", "Packing"];

function isManagementStation(station) {
  return String(station || "").trim().toLowerCase() === "management";
}

const PAY_CYCLE_DAYS = 15;

/** Merge roster API totals into employee card shape. */
function buildEmployee(base, payTotals = {}) {
  const numericId = Number(String(base.id).replace("EMP-", ""));
  const t = payTotals[numericId] || {};
  const inst = t.installment || null;
  const advance = t.advance || null;
  const installment = inst
    ? {
        principal: Number(inst.principal) || 0,
        perPayout: Number(inst.per_payout) || 0,
        paidSoFar: Number(inst.paid_so_far) || 0,
        payoutsRemaining: inst.payouts_remaining,
        balance: Number(inst.balance) || 0,
      }
    : null;

  return {
    ...base,
    units: Number(t.units) || 0,
    gross: Number(t.raw_gross) || 0,
    settledUnpaid: Number(t.settled_unpaid) || 0,
    installment,
    advance,
    remainingBalance:
      (installment ? Number(installment.balance) || 0 : 0) +
      (advance ? Number(advance.remaining_amount) || 0 : 0),
    perCycleDeduction: Number(t.per_cycle_deduction) || 0,
    netDue: Number(t.net_due) || 0,
  };
}

function initials(name) {
  if (!name) return "E";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatPKR(n) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

// ---- Pakistan phone number: 03XX-XXXXXXX (11 digits, starts with 03) ----
function formatPakPhone(raw) {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function isValidPakPhone(value) {
  const digits = (value || "").replace(/\D/g, "");
  return /^03\d{9}$/.test(digits);
}

// ---- Pakistan CNIC: XXXXX-XXXXXXX-X (13 digits) ----
function formatCNIC(raw) {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 13);
  let out = digits.slice(0, 5);
  if (digits.length > 5) out += `-${digits.slice(5, 12)}`;
  if (digits.length > 12) out += `-${digits.slice(12, 13)}`;
  return out;
}

function isValidCNIC(value) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length === 13;
}

// ---- Date <-> "DD-MM-YY" display format ----
function isoToDMY(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y.slice(2)}`;
}

function dmyToISO(dmy) {
  if (!dmy) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(dmy)) return dmy.slice(0, 10);
  const parts = dmy.split("-");
  if (parts.length !== 3) return "";
  let [d, m, y] = parts;
  if (!/^\d+$/.test(d) || !/^\d+$/.test(m) || !/^\d+$/.test(y)) return "";
  if (y.length === 2) y = `20${y}`;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M10.1 1.9a1.4 1.4 0 0 1 2 2L4.5 11.5 1.5 12.5l1-3L10.1 1.9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.6 8.2c0 .5.5.8 1 .8h3.8c.5 0 .9-.3 1-.8L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.7 14c.6-3 2.4-4.6 4.3-4.6S10 11 10.6 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="11.5" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.8 9.6c1.8.2 3 1.6 3.4 3.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
function LoanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13V6.5L8 2l6 4.5V13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.5 13V9h5v4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function CoinsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse cx="6" cy="4.3" rx="4.2" ry="2.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.8 4.3v4c0 1.3 1.9 2.3 4.2 2.3s4.2-1 4.2-2.3v-4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.8 8.3v3c0 1.3 1.9 2.3 4.2 2.3.7 0 1.4-.1 2-.3" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="11" cy="8.8" rx="3.2" ry="1.7" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.2" width="12" height="10.8" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6.4h12M5 1.7v2.4M11 1.7v2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function StationBadge({ station }) {
  const color = STATION_COLOR[station] || COLORS.gold;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap"
      style={{ background: COLORS.boneDim, color: COLORS.graphite }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {station}
    </span>
  );
}

function InstallmentBadge({ employee }) {
  if (!employee.installment && !employee.advance) {
    return (
      <span className="text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ background: COLORS.boneDim, color: COLORS.graphiteLight }}>
        No dues
      </span>
    );
  }
  if (!employee.installment && employee.advance) {
    const n = employee.advance.count || 1;
    return (
      <span className="text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}>
        Adv {formatPKR(employee.advance.remaining_amount)}
        {n > 1 ? ` ×${n}` : ""}
      </span>
    );
  }
  const n = employee.installment?.count || 1;
  return (
    <span className="text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
      {formatPKR(employee.remainingBalance)} left
      {n > 1 ? ` · ${n} plans` : ""}
    </span>
  );
}

function EmployeeRow({ employee, index, onOpen, onEdit, onDelete, canWrite = true }) {
  return (
    <tr className="tbl-row cursor-pointer" style={{ borderTop: `1px solid ${COLORS.border}` }} onClick={() => onOpen(employee)}>
      <td className="px-5 py-3.5">
        <span className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 overflow-hidden"
            style={{ background: COLORS.goldSoft, color: COLORS.goldDim }}
          >
            {employee.image ? (
              <img src={getImageUrl(employee.image)} alt={employee.name} className="w-full h-full object-cover" />
            ) : (
              initials(employee.name)
            )}
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold truncate" style={{ color: COLORS.ink }}>{employee.name}</span>
            <span className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: COLORS.graphiteLight }}>
              <span>{employee.id}</span>
              {employee.cnic && employee.cnic !== "—" && (
                <>
                  <span>·</span>
                  <span>CNIC: {employee.cnic}</span>
                </>
              )}
              {employee.phone && employee.phone !== "—" && (
                <>
                  <span>·</span>
                  <span>Ph: {employee.phone}</span>
                </>
              )}
            </span>
          </span>
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <StationBadge station={employee.station} />
          {isManagementStation(employee.station) && employee.monthlySalary > 0 && (
            <span className="text-[10.5px]" style={{ color: COLORS.graphiteLight }}>
              {formatPKR(employee.monthlySalary)} · day {employee.payDay || "—"}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 text-right" style={{ color: COLORS.graphite }}>{employee.units.toLocaleString()}</td>
      <td className="px-5 py-3.5 text-right" style={{ color: COLORS.graphiteLight }}>
        <div className="font-medium" style={{ color: COLORS.ink }}>{formatPKR(employee.settledUnpaid || 0)}</div>
        <div className="text-[10px]">raw {formatPKR(employee.gross)}</div>
      </td>
      <td className="px-5 py-3.5"><InstallmentBadge employee={employee} /></td>
      <td className="px-5 py-3.5 text-right font-semibold" style={{ color: employee.netDue > 0 ? COLORS.rust : COLORS.green }}>
        {formatPKR(employee.netDue)}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canWrite ? (
            <>
              <button
                type="button"
                className="btn-secondary p-1.5 rounded-lg shrink-0"
                title="Edit employee"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
                onClick={() => onEdit(employee)}
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className="btn-secondary p-1.5 rounded-lg shrink-0"
                title="Delete employee"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust, background: COLORS.rustSoft }}
                onClick={() => onDelete(employee)}
              >
                <TrashIcon />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="p-1.5 rounded-lg shrink-0 text-graphiteLight"
            title="View details"
            style={{ color: COLORS.graphiteLight }}
            onClick={() => onOpen(employee)}
          >
            <ChevronIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmployeeModal({ employee, onClose, onEdit, onDelete, onPaid }) {
  if (!employee) return null;
  return (
    <EmployeePayModal
      employee={employee}
      onClose={onClose}
      onEdit={onEdit}
      onDelete={onDelete}
      onPaid={onPaid}
    />
  );
}

function AddEditEmployeeModal({ employee, onClose, onSave }) {
  const isEditing = Boolean(employee?.id);
  const [name, setName] = useState(employee?.name || "");
  const [cnic, setCnic] = useState(employee?.cnic || "");
  const [phone, setPhone] = useState(employee?.phone || "");
  const [station, setStation] = useState(employee?.station || "Stitching");
  const [joinedISO, setJoinedISO] = useState(dmyToISO(employee?.joined) || todayISO());
  const [image, setImage] = useState(employee?.image || "");
  const [batchDate, setBatchDate] = useState(() => getEmployeeBatchDateSetting(employee?.id) || "");
  const [monthlySalary, setMonthlySalary] = useState(
    employee?.monthlySalary != null && employee.monthlySalary !== "" ? String(employee.monthlySalary) : ""
  );
  const [payDay, setPayDay] = useState(
    employee?.payDay != null && employee.payDay !== "" ? String(employee.payDay) : "1"
  );
  const isManagement = isManagementStation(station);

  const cnicTouched = cnic.length > 0;
  const phoneTouched = phone.length > 0;
  const cnicError = cnicTouched && !isValidCNIC(cnic) ? "Enter a valid 13-digit CNIC (e.g. 35202-1234567-1)" : "";
  const phoneError = phoneTouched && !isValidPakPhone(phone) ? "Enter a valid Pakistani number starting with 03 (e.g. 0300-1234567)" : "";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiFetch("/api/upload", {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setImage(data.url); // e.g. "/uploads/173..."
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setUploading(false);
    }
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (cnic.trim() && !isValidCNIC(cnic)) {
      setError("Please enter a valid 13-digit CNIC number.");
      return;
    }
    if (phone.trim() && !isValidPakPhone(phone)) {
      setError("Please enter a valid Pakistani phone number (starts with 03, 11 digits).");
      return;
    }
    if (isManagement) {
      const salary = Number(monthlySalary);
      const day = Number(payDay);
      if (!(salary > 0)) {
        setError("Management staff need a monthly pay amount.");
        return;
      }
      if (!(day >= 1 && day <= 31)) {
        setError("Pay day must be between 1 and 31.");
        return;
      }
    }

    setSaving(true);
    setError("");

    const payload = {
      full_name: name.trim(),
      cnic_number: cnic.trim(),
      phone_number: phone.trim(),
      joining_date: joinedISO,
      station,
      image_link: image.trim(),
      monthly_salary: isManagement ? Number(monthlySalary) : null,
      pay_day: isManagement ? Number(payDay) : null,
    };

    const numericId = isEditing ? employee.id.replace("EMP-", "") : null;
    const url = isEditing ? `/api/employees/${numericId}` : "/api/employees";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSaving(false);
        return;
      }

      const savedId = `EMP-${data.e_id}`;
      setEmployeeBatchDateSetting(savedId, batchDate);

      onSave({
        id: savedId,
        name: data.full_name,
        cnic: data.cnic_number || "—",
        phone: data.phone_number || "—",
        station: data.station,
        joined: data.joining_date,
        image: data.image_link,
        monthlySalary: data.monthly_salary != null ? Number(data.monthly_salary) : null,
        payDay: data.pay_day != null ? Number(data.pay_day) : null,
      });
    } catch (err) {
      console.error(err);
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }
  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-center justify-center p-3 sm:p-6">
      <div
        className="modal-pop w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>
              {isEditing ? "Edit employee details" : "Add new employee"}
            </h2>
            <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              {isEditing ? `Update profile info for ${employee.name}` : "Enter details for the new staff member"}
            </p>
          </div>
          <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center gap-4 mb-5 p-3 rounded-xl" style={{ background: COLORS.boneDim, border: `1px solid ${COLORS.border}` }}>
            <span
              className="w-14 h-14 rounded-full flex items-center justify-center text-[16px] font-semibold shrink-0 overflow-hidden"
              style={{ background: COLORS.goldSoft, color: COLORS.goldDim, border: `1px solid ${COLORS.border}` }}
            >
              {image ? (
                <img src={getImageUrl(image)} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                initials(name || "Employee")
              )}
            </span>
            <div className="flex-1 min-w-0">
              <label className="form-label mb-1">Profile Photo / Avatar</label>
              <div className="flex items-center gap-2">
                <label
                  className="btn-secondary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center"
                  style={{ border: `1px solid ${COLORS.border}`, color: COLORS.ink, background: COLORS.card }}
                >
                  Upload Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {image && (
                  <button
                    type="button"
                    className="btn-secondary text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ border: `1px solid ${COLORS.border}`, color: COLORS.rust }}
                    onClick={() => setImage("")}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fahad Iqbal"
              />
            </div>

            <div>
              <label className="form-label">CNIC Number</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={cnic}
                onChange={(e) => setCnic(formatCNIC(e.target.value))}
                placeholder="e.g. 35202-1234567-1"
                maxLength={15}
                style={cnicError ? { borderColor: COLORS.rust } : undefined}
              />
              {cnicError && (
                <p className="text-[10.5px] mt-1" style={{ color: COLORS.rust }}>{cnicError}</p>
              )}
            </div>

            <div>
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(formatPakPhone(e.target.value))}
                placeholder="e.g. 0300-1234567"
                maxLength={12}
                style={phoneError ? { borderColor: COLORS.rust } : undefined}
              />
              {phoneError && (
                <p className="text-[10.5px] mt-1" style={{ color: COLORS.rust }}>{phoneError}</p>
              )}
            </div>

            <div>
              <label className="form-label">Department / Station</label>
              <div className="select-wrap w-full">
                <select className="w-full" value={station} onChange={(e) => setStation(e.target.value)}>
                  {STATION_META.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {isManagement && (
                <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                  Monthly salary — not piece-rate. Installments &amp; advances still apply.
                </p>
              )}
            </div>

            <div>
              <label className="form-label">Joining Date</label>
              <input
                type="date"
                className="form-input"
                value={joinedISO}
                onChange={(e) => setJoinedISO(e.target.value)}
              />
              <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                Saved as {isoToDMY(joinedISO) || "—"}
              </p>
            </div>

            {isManagement ? (
              <>
                <div>
                  <label className="form-label">Monthly pay (PKR) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="form-input"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="e.g. 45000"
                  />
                </div>
                <div>
                  <label className="form-label">Pay day of month *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    className="form-input"
                    value={payDay}
                    onChange={(e) => setPayDay(e.target.value)}
                    placeholder="e.g. 30"
                  />
                  <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                    Salary posts on this day each month. If you set them up after that day, the first post is next month. Paying clears the balance.
                  </p>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="form-label">Production batch date (optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                />
                <p className="text-[10.5px] mt-1" style={{ color: COLORS.graphiteLight }}>
                  Leave empty to always log on today. Set only if this person should post to a fixed batch date.
                </p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="form-label">Image URL (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={image.startsWith("data:") ? "" : image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: COLORS.border }}>
            <button
              type="button"
              className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || uploading || Boolean(cnicError) || Boolean(phoneError)}
              className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
              style={{ background: COLORS.gold, color: COLORS.ink, opacity: name.trim() && !cnicError && !phoneError ? 1 : 0.5 }}
            >
              {uploading ? "Uploading..." : isEditing ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </ModalLayer>
  );
}

function DeleteConfirmModal({ employee, onClose, onConfirm }) {
  if (!employee) return null;

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-center justify-center p-4">
      <div
        className="modal-pop w-full max-w-md rounded-2xl p-6"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold" style={{ color: COLORS.rust }}>Delete Employee</h3>
          <button type="button" className="btn-secondary p-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}` }} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <p className="text-[13px] mb-6" style={{ color: COLORS.graphite }}>
          Are you sure you want to delete <strong style={{ color: COLORS.ink }}>{employee.name}</strong> ({employee.id})? This will remove them from the roster.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-secondary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: COLORS.rust, color: COLORS.card }}
            onClick={() => onConfirm(employee.id)}
          >
            Delete Employee
          </button>
        </div>
      </div>
    </ModalLayer>
  );
}

export default function EmployeesPage() {
  const { canWrite } = useAuth();
  const [pageTab, setPageTab] = useState("roster"); // roster | loans
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("All stations");
  const [selectedId, setSelectedId] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);

  const [employeeBases, setEmployeeBases] = useState([]);
  const [payTotals, setPayTotals] = useState({});
  const [loanModalRequest, setLoanModalRequest] = useState(null); // 'installment' | 'advance' | null

  useEffect(() => {
    if (!canWrite && pageTab === "loans") setPageTab("roster");
  }, [canWrite, pageTab]);

  const refreshPayTotals = useCallback(async () => {
    try {
      const res = await apiFetch("/api/payouts/roster-totals");
      if (!res.ok) return;
      const data = await res.json();
      setPayTotals(data.totals || {});
    } catch (err) {
      console.error("Failed to fetch pay totals", err);
    }
  }, []);

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const res = await apiFetch("/api/employees");
        const data = await res.json();
        const mapped = data.map((emp) => ({
          id: `EMP-${emp.e_id}`,
          name: emp.full_name,
          cnic: emp.cnic_number || "—",
          phone: emp.phone_number || "—",
          station: emp.station,
          joined: emp.joining_date,
          image: emp.image_link,
          monthlySalary: emp.monthly_salary != null ? Number(emp.monthly_salary) : null,
          payDay: emp.pay_day != null ? Number(emp.pay_day) : null,
        }));
        setEmployeeBases(mapped);
      } catch (err) {
        console.error("Failed to fetch employees", err);
      }
    }
    fetchEmployees();
    refreshPayTotals();
  }, [refreshPayTotals]);

  useEffect(() => {
    if (pageTab !== "roster") return;
    refreshPayTotals();
  }, [pageTab, refreshPayTotals]);

  const employees = useMemo(
    () => employeeBases.map((base) => buildEmployee(base, payTotals)),
    [employeeBases, payTotals]
  );
  const selectedEmployee = useMemo(() => employees.find((e) => e.id === selectedId) || null, [employees, selectedId]);

  const filtered = useMemo(() => {
    return employees
      .filter((e) => (stationFilter === "All stations" ? true : e.station === stationFilter))
      .filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.id.toLowerCase().includes(search.toLowerCase()) ||
          (e.cnic && e.cnic.toLowerCase().includes(search.toLowerCase())) ||
          (e.phone && e.phone.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => b.netDue - a.netDue);
  }, [employees, search, stationFilter]);

  const totalDue = employees.reduce((s, e) => s + e.netDue, 0);
  const totalGross = employees.reduce((s, e) => s + e.gross, 0);
  const activeInstallments = employees.filter((e) => e.installment).length;

  const today = new Date();
  const cycleStart = new Date(today);
  cycleStart.setDate(cycleStart.getDate() - (PAY_CYCLE_DAYS - 1));
  const cycleLabel = `${cycleStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  function handleSaveEmployee(newOrUpdatedData) {
    setEmployeeBases((prev) => {
      const exists = prev.some((e) => e.id === newOrUpdatedData.id);
      if (exists) {
        return prev.map((e) => (e.id === newOrUpdatedData.id ? { ...e, ...newOrUpdatedData } : e));
      }
      return [newOrUpdatedData, ...prev];
    });
    setIsAddModalOpen(false);
    setEditingEmployee(null);
  }

  async function handleDeleteEmployee(id) {
    const numericId = id.replace("EMP-", "");
    try {
      const res = await apiFetch(`/api/employees/${numericId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        console.error(data.error || "Failed to delete employee");
        return;
      }
      setEmployeeBases((prev) => prev.filter((e) => e.id !== id));
      setDeletingEmployee(null);
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <AppShell
      title="Employees"
      subtitle={
        pageTab === "loans"
          ? "Installments & advances · 15-day payout cycle"
          : `${employees.length} people across the floor`
      }
      maxWidth="80rem"
      actions={
        !canWrite
          ? null
          : pageTab === "loans" ? (
          <>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shrink-0"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
              onClick={() => setLoanModalRequest("advance")}
            >
              <PlusIcon /> <span className="hidden sm:inline">Advance</span><span className="sm:hidden">Adv</span>
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shrink-0"
              style={{ background: COLORS.gold, color: COLORS.inkSurface }}
              onClick={() => setLoanModalRequest("installment")}
            >
              <PlusIcon /> <span className="hidden sm:inline">Installment</span><span className="sm:hidden">Inst</span>
            </button>
          </>
        ) : (
          <>
            <Link
              to="/daily-entry"
              className="btn-primary inline-flex items-center gap-1.5 text-[11.5px] sm:text-[12.5px] font-bold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shrink-0 no-underline"
              style={{ background: COLORS.inkSurface, color: COLORS.gold, border: `1px solid ${COLORS.gold}` }}
            >
              <SparkIcon size={13} /> <span className="hidden sm:inline">Insert daily data</span><span className="sm:hidden">Daily</span>
            </Link>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1 text-[11.5px] sm:text-[12.5px] font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shrink-0"
              style={{ background: COLORS.gold, color: COLORS.inkSurface }}
              onClick={() => setIsAddModalOpen(true)}
            >
              <PlusIcon /> <span className="hidden sm:inline">Add employee</span><span className="sm:hidden">Add</span>
            </button>
          </>
        )
      }
    >
          <ReadOnlyBanner />
          <div className="segmented mb-6">
            {(canWrite
              ? [
                  { id: "roster", label: "Roster" },
                  { id: "loans", label: "Installments & Advances" },
                ]
              : [{ id: "roster", label: "Roster" }]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPageTab(t.id)}
                style={{
                  background: pageTab === t.id ? COLORS.inkSurface : "transparent",
                  color: pageTab === t.id ? COLORS.onDark : COLORS.graphite,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {pageTab === "loans" ? (
            <LoansTab
              openModal={loanModalRequest}
              onOpenModalConsumed={() => setLoanModalRequest(null)}
            />
          ) : (
            <>
              {canWrite ? (
              <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3 fade-in" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.card, color: COLORS.goldDim }}>
                    <CalendarIcon />
                  </div>
                  <div>
                    <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>Current pay cycle: {cycleLabel}</div>
                    <div className="text-[11.5px]" style={{ color: COLORS.goldDim }}>Paid every {PAY_CYCLE_DAYS} days · next payout today</div>
                  </div>
                </div>
                <Link
                  to="/payouts"
                  className="btn-primary text-[12px] font-semibold px-3.5 py-2 rounded-lg no-underline inline-flex"
                  style={{ background: COLORS.ink, color: COLORS.gold }}
                >
                  Open payouts
                </Link>
              </div>
              ) : (
              <div className="rounded-2xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3 fade-in" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.card, color: COLORS.goldDim }}>
                    <CalendarIcon />
                  </div>
                  <div>
                    <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>Current pay cycle: {cycleLabel}</div>
                    <div className="text-[11.5px]" style={{ color: COLORS.goldDim }}>Paid every {PAY_CYCLE_DAYS} days · view only</div>
                  </div>
                </div>
              </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MiniStat index={0} icon={<UsersIcon />} label="Total employees" value={employees.length} sub={`${FLOOR_STATIONS.length} floor + Management`} />
                <MiniStat
                  index={1}
                  icon={<CoinsIcon />}
                  label="Settled payable"
                  value={formatPKR(employees.reduce((s, e) => s + (e.settledUnpaid || 0), 0))}
                  sub={`raw logged ${formatPKR(totalGross)}`}
                />
                <MiniStat index={2} icon={<LoanIcon />} label="Active installments" value={activeInstallments} sub={`of ${employees.length} employees`} />
                <MiniStat index={3} icon={<BanknoteIcon />} label="Net payable" value={formatPKR(totalDue)} sub="after installment & advance" />
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="search-wrap">
                  <SearchIcon />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, CNIC or phone" />
                </div>
                <div className="select-wrap">
                  <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}>
                    {["All stations", ...STATION_META.map((s) => s.name)].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="select-caret">
                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[11.5px] ml-auto" style={{ color: COLORS.graphiteLight }}>{filtered.length} shown</span>
              </div>

              <div className="rounded-2xl overflow-hidden panel fade-in" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: "120ms" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr style={{ background: COLORS.boneDim }}>
                        <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Employee</th>
                        <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Station</th>
                        <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Units</th>
                        <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Payable</th>
                        <th className="text-left font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Dues</th>
                        <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Net payable</th>
                        <th className="text-right font-semibold px-5 py-2.5 uppercase text-[10.5px] tracking-wide" style={{ color: COLORS.graphite }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((emp, i) => (
                        <EmployeeRow
                          key={emp.id}
                          employee={emp}
                          index={i}
                          onOpen={(e) => setSelectedId(e.id)}
                          onEdit={(e) => setEditingEmployee(e)}
                          onDelete={(e) => setDeletingEmployee(e)}
                          canWrite={canWrite}
                        />
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-[12.5px]" style={{ color: COLORS.graphiteLight }}>
                            No employees match your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedId(null)}
          onEdit={canWrite ? (e) => setEditingEmployee(e) : undefined}
          onDelete={canWrite ? (e) => setDeletingEmployee(e) : undefined}
          onPaid={canWrite ? refreshPayTotals : undefined}
        />
      )}

      {canWrite && (isAddModalOpen || editingEmployee) && (
        <AddEditEmployeeModal
          employee={editingEmployee}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingEmployee(null);
          }}
          onSave={handleSaveEmployee}
        />
      )}

      {canWrite && deletingEmployee && (
        <DeleteConfirmModal
          employee={deletingEmployee}
          onClose={() => setDeletingEmployee(null)}
          onConfirm={handleDeleteEmployee}
        />
      )}


      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

        .fade-in { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .modal-overlay { background: rgba(28,25,23,0.5); backdrop-filter: blur(2px); animation: overlayIn 0.18s ease both; }
        .modal-pop { animation: modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }

        .stat-card, .panel, .loan-card, .btn-primary, .btn-secondary, .btn-link, .tbl-row {
          transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, color .18s ease;
        }
        .loan-card:hover { border-color: ${COLORS.gold} !important; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 14px 28px -18px rgba(28,25,23,0.28); border-color: ${COLORS.gold} !important; }
        .panel:hover { box-shadow: 0 10px 26px -18px rgba(28,25,23,0.22); }
        .tbl-row:hover { background: ${COLORS.boneDim}77; }

        .btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 8px 18px -8px rgba(184,135,61,0.5); }
        .btn-primary:active { transform: translateY(0); }
        .btn-secondary:hover { border-color: ${COLORS.gold} !important; color: ${COLORS.goldDim} !important; background: ${COLORS.goldSoft}55 !important; }
        .btn-link { background: none; border: none; cursor: pointer; padding: 0; }
        .btn-link:hover { color: ${COLORS.gold} !important; text-decoration: underline; }

        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: ${COLORS.graphite}; margin-bottom: 4px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 7px 10px; outline: none; width: 100%;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .form-input:hover, .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

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
          outline: none; width: 260px; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .search-wrap input::placeholder { color: ${COLORS.graphiteLight}; }
        .search-wrap input:hover, .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}66; }

        .nav-item { transition: background .18s ease, transform .18s ease, color .18s ease; }
        .nav-item:hover:not(:disabled) { background: ${COLORS.inkSoft} !important; transform: translateX(2px); }

        table th, table td { white-space: nowrap; }

        @media (max-width: 640px) {
          .search-wrap, .select-wrap { width: 100%; }
          .search-wrap input { width: 100% !important; }
          .select-wrap select { width: 100% !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .stat-card, .panel, .modal-pop, .modal-overlay, .btn-primary, .btn-secondary { animation: none !important; transition: none !important; }
        }
      `}</style>
    </AppShell>
  );
}