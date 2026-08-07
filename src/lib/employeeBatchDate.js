/** Optional per-employee production batch date (local setting). Empty = use Karachi today. */

import { karachiTodayISO } from "./karachiDate";

const KEY = (empId) => `ns-emp-batch-date-${empId}`;

export function todayISO() {
  return karachiTodayISO();
}

export function getEmployeeBatchDate(empId) {
  if (!empId) return todayISO();
  try {
    const stored = localStorage.getItem(KEY(empId));
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  } catch {
    /* ignore */
  }
  return todayISO();
}

/** Returns stored value or "" if using today by default */
export function getEmployeeBatchDateSetting(empId) {
  if (!empId) return "";
  try {
    return localStorage.getItem(KEY(empId)) || "";
  } catch {
    return "";
  }
}

export function setEmployeeBatchDateSetting(empId, dateOrEmpty) {
  if (!empId) return;
  try {
    const v = String(dateOrEmpty || "").trim();
    if (!v) localStorage.removeItem(KEY(empId));
    else localStorage.setItem(KEY(empId), v);
  } catch {
    /* ignore */
  }
}
