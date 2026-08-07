// ========================================
// SecurityHistory.jsx
// Per-ATM security holds from shipments. Full amount mark-paid only.
// ========================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { FONT, COLORS } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import MiniStat from "../components/ui/MiniStat";
import { SearchIcon, ChevronIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ReadOnlyBanner from "../components/auth/ReadOnlyBanner";

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function formatPKR(n) {
  return `Rs ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5l5 2v4.2c0 3.2-2.1 5.3-5 6.3-2.9-1-5-3.1-5-6.3V3.5l5-2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AtmGroup({ group, open, onToggle, onMarkPaid, payingId, canWrite = true }) {
  return (
    <div
      className="sec-card fade-in rounded-2xl overflow-hidden"
      style={{ background: COLORS.card, border: `1px solid ${open ? COLORS.gold : COLORS.border}` }}
    >
      <button type="button" className="w-full text-left px-5 py-4" onClick={onToggle}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded"
                style={{ background: COLORS.inkSurface, color: COLORS.gold }}
              >
                ATM {group.atm_no}
              </span>
              {group.total_owed > 0 ? (
                <span
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                  style={{ background: COLORS.rustSoft, color: COLORS.rust }}
                >
                  {formatPKR(group.total_owed)} owed
                </span>
              ) : (
                <span
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                  style={{ background: COLORS.greenSoft, color: COLORS.green }}
                >
                  Cleared
                </span>
              )}
            </div>
            <div className="text-[14px] font-semibold mt-2" style={{ color: COLORS.ink }}>
              {group.customer || "—"}
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              {group.holds.length} hold{group.holds.length === 1 ? "" : "s"} · paid{" "}
              {formatPKR(group.total_paid)}
            </div>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: COLORS.boneDim,
              color: COLORS.graphite,
              transform: open ? "rotate(-90deg)" : "rotate(90deg)",
            }}
          >
            <ChevronIcon />
          </div>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <div className="pt-3 space-y-2">
            {group.holds.map((h) => (
              <div
                key={h.security_id}
                className="rounded-xl px-3.5 py-3 flex flex-wrap items-center justify-between gap-3"
                style={{ background: COLORS.bone }}
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold" style={{ color: COLORS.ink }}>
                    {h.bill_no || `Hold #${h.security_id}`} · {h.security_pct}%
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: COLORS.graphite }}>
                    Goods {formatPKR(h.goods_total)} · Due {formatDate(h.due_date)}
                    {h.status === "paid" && h.paid_at ? ` · Paid ${formatDate(h.paid_at)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[14px] font-semibold tabular-nums"
                    style={{ color: h.status === "paid" ? COLORS.green : COLORS.ink }}
                  >
                    {formatPKR(h.amount)}
                  </span>
                  {h.status === "owed" ? (
                    canWrite ? (
                      <button
                        type="button"
                        className="btn-primary text-[11.5px] font-semibold px-3 py-1.5 rounded-lg"
                        style={{ background: COLORS.gold, color: COLORS.ink }}
                        disabled={payingId === h.security_id}
                        onClick={() => onMarkPaid(h)}
                      >
                        {payingId === h.security_id ? "…" : "Mark paid"}
                      </button>
                    ) : (
                      <span
                        className="text-[10.5px] font-semibold px-2 py-1 rounded"
                        style={{ background: COLORS.rustSoft, color: COLORS.rust }}
                      >
                        Owed
                      </span>
                    )
                  ) : (
                    <span
                      className="text-[10.5px] font-semibold px-2 py-1 rounded"
                      style={{ background: COLORS.greenSoft, color: COLORS.green }}
                    >
                      Paid
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecurityHistoryPage() {
  const { canWrite } = useAuth();
  const [data, setData] = useState({ by_atm: [], totals: { owed: 0, paid: 0, all: 0 } });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedAtm, setExpandedAtm] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiFetch(`/api/security?status=${filter === "all" ? "all" : filter}`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load security"));
      const json = await res.json();
      setData({
        by_atm: Array.isArray(json.by_atm) ? json.by_atm : [],
        totals: json.totals || { owed: 0, paid: 0, all: 0 },
      });
      setExpandedAtm((prev) => {
        if (prev && (json.by_atm || []).some((g) => g.atm_no === prev)) return prev;
        return (json.by_atm || [])[0]?.atm_no ?? null;
      });
    } catch (err) {
      setLoadError(err.message || "Failed to load security");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.by_atm;
    return data.by_atm.filter(
      (g) =>
        String(g.atm_no || "").toLowerCase().includes(q) ||
        String(g.customer || "").toLowerCase().includes(q)
    );
  }, [data.by_atm, search]);

  async function markPaid(hold) {
    if (!canWrite) return;
    if (!window.confirm(`Mark security ${formatPKR(hold.amount)} paid in full for ATM ${hold.atm_no}?`)) {
      return;
    }
    setPayingId(hold.security_id);
    setActionError("");
    setActionOk("");
    try {
      const res = await apiFetch(`/api/security/${hold.security_id}/paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to mark paid"));
      setActionOk(`ATM ${hold.atm_no} · ${formatPKR(hold.amount)} marked paid`);
      await load();
    } catch (err) {
      setActionError(err.message || "Failed to mark paid");
    } finally {
      setPayingId(null);
    }
  }

  return (
    <AppShell
      title="Security History"
      subtitle="Per ATM · held from shipments · full amount only"
      maxWidth="64rem"
      showAvatar={false}
      actions={
        <button
          type="button"
          className="btn-secondary text-[12px] font-semibold px-3 py-2 rounded-xl"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.ink }}
          onClick={load}
        >
          Refresh
        </button>
      }
    >
      <ReadOnlyBanner />
      {(loadError || actionError || actionOk) && (
        <div className="space-y-2 mb-5">
          {loadError && (
            <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
              {loadError}
            </div>
          )}
          {actionError && (
            <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.rustSoft, color: COLORS.rust }}>
              {actionError}
            </div>
          )}
          {actionOk && (
            <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: COLORS.greenSoft, color: COLORS.green }}>
              {actionOk}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MiniStat index={0} icon={<ShieldIcon />} label="Total owed" value={formatPKR(data.totals.owed)} sub="across ATMs" />
        <MiniStat index={1} icon={<ShieldIcon />} label="Total paid" value={formatPKR(data.totals.paid)} sub="cleared" />
        <MiniStat index={2} icon={<ShieldIcon />} label="ATMs" value={data.by_atm.length} sub="with security" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex p-1 rounded-xl" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          {[
            { id: "all", label: "All" },
            { id: "owed", label: "Owed" },
            { id: "paid", label: "Paid" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className="px-3.5 py-2 text-[12.5px] font-semibold rounded-lg"
              style={{
                background: filter === t.id ? COLORS.inkSurface : "transparent",
                color: filter === t.id ? COLORS.onDark : COLORS.graphite,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ATM or customer…"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl h-[88px] animate-pulse"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-14 text-center"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>
            No security holds
          </div>
          <p className="text-[13px] mt-1.5" style={{ color: COLORS.graphite }}>
            {search
              ? "No matches."
              : "Security is created when you ship (default 3% of goods). Run migration 16 if this stays empty after shipping."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => (
            <AtmGroup
              key={g.atm_no}
              group={g}
              open={expandedAtm === g.atm_no}
              onToggle={() => setExpandedAtm(expandedAtm === g.atm_no ? null : g.atm_no)}
              onMarkPaid={markPaid}
              payingId={payingId}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .sec-card { transition: border-color 0.2s ease; }
        .sec-card:hover { border-color: ${COLORS.gold} !important; }
        .search-wrap { position: relative; display: inline-flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 10px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 12.5px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 8px 12px 8px 30px;
          outline: none; width: 260px;
        }
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </AppShell>
  );
}
