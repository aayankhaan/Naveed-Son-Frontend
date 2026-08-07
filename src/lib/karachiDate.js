/** Karachi (Asia/Karachi) calendar helpers for daily production catch-up */

const TZ = "Asia/Karachi";

export function karachiTodayISO(now = new Date()) {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Normalize any API date value to YYYY-MM-DD (no timezone shift). */
export function toIsoDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Prefer Karachi calendar day for Date objects
    return karachiTodayISO(value);
  }
  return null;
}

/** DD/MM/YYYY for display */
export function formatKarachiDMY(isoOrDate) {
  const iso =
    typeof isoOrDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(isoOrDate)
      ? isoOrDate.slice(0, 10)
      : toIsoDateOnly(isoOrDate) || karachiTodayISO(isoOrDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(isoOrDate || "");
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Add days to an ISO date (calendar math, not local DST). */
export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Inclusive list of ISO dates from `from` to `to`. */
export function eachDateISO(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

/**
 * Last N Karachi calendar days ending at today (inclusive), not before joiningDate.
 * Returns { today, from, to, days: string[] }
 */
export function catchUpWindow({ today = karachiTodayISO(), joiningDate = null, daysBack = 7 } = {}) {
  const to = today;
  let from = addDaysISO(to, -(Math.max(1, daysBack) - 1));
  if (joiningDate && /^\d{4}-\d{2}-\d{2}$/.test(joiningDate) && joiningDate > from) {
    from = joiningDate;
  }
  if (from > to) from = to;
  return { today: to, from, to, days: eachDateISO(from, to) };
}

/**
 * Missing days in the window that have no work/leave coverage.
 * `coveredDates` = Set or object keys of dates that already have status.
 * Returns earliest-first list (excludes today if you pass through today — caller decides).
 */
export function missingDaysInWindow(windowDays, coveredDates) {
  const covered =
    coveredDates instanceof Set
      ? coveredDates
      : new Set(Object.keys(coveredDates || {}));
  return (windowDays || []).filter((d) => !covered.has(d));
}

/**
 * Earliest missing day strictly before Karachi today.
 * null = gaps clear; employee may enter today's data.
 */
export function nextCatchUpDate(windowDays, coveredDates, today = karachiTodayISO()) {
  const missing = missingDaysInWindow(windowDays, coveredDates).filter((d) => d < today);
  return missing[0] || null;
}
