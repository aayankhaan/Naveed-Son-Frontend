// Item Costing — clean article → type flow

import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT } from "../constants/theme";
import AppShell from "../components/layout/AppShell";
import ModalLayer from "../components/ui/ModalLayer";
import { SearchIcon, CloseIcon } from "../components/icons/CommonIcons";
import { apiFetch } from "../lib/api";
import { emptyTypeDraft } from "../lib/costingV2";
import TypeEditor from "../components/costing/TypeEditor";

async function readApiError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NameModal({ title, initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), description: description.trim() });
    } catch (err) {
      setError(err?.message || "Could not save");
      setSaving(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-center justify-center p-4">
      <form
        className="modal-pop w-full max-w-sm rounded-2xl p-5"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: COLORS.ink }}>{title}</h3>
          <button type="button" className="p-1.5 rounded-lg" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Duvet Cover"
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Note</label>
            <input
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        {error && <p className="text-[12px] mb-3" style={{ color: COLORS.rust }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={!name.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalLayer>
  );
}

function ConfirmDelete({ label, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err?.message || "Delete failed");
      setBusy(false);
    }
  }

  return (
    <ModalLayer onClose={onClose} zClass="z-[90]" alignClass="items-center justify-center p-4">
      <div
        className="modal-pop w-full max-w-sm rounded-2xl p-5"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold mb-1" style={{ color: COLORS.ink }}>Delete {label}?</h3>
        <p className="text-[12.5px] mb-5" style={{ color: COLORS.graphite }}>This cannot be undone.</p>
        {error && <p className="text-[12px] mb-3" style={{ color: COLORS.rust }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="primary-btn"
            style={{ background: COLORS.rust, color: COLORS.card }}
            onClick={go}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </ModalLayer>
  );
}

function typeMeta(type) {
  const mats = (type.materials || []).length;
  const sizes = (type.sizes || []).length;
  const parts = (type.parts || []).length;
  const bits = [];
  if (mats) bits.push(`${mats} fabric${mats === 1 ? "" : "s"}`);
  if (sizes) bits.push(`${sizes} size${sizes === 1 ? "" : "s"}`);
  bits.push(parts ? `${parts} part${parts === 1 ? "" : "s"}` : "single piece");
  return bits.join(" · ");
}

export default function CostingPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [typeEditor, setTypeEditor] = useState(null);
  const [articleModal, setArticleModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function refreshList() {
    const res = await apiFetch("/api/articles");
    if (!res.ok) throw new Error(await readApiError(res, "Failed to load articles"));
    const data = await res.json();
    setArticles(Array.isArray(data) ? data : []);
  }

  async function openArticle(id) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/articles/${id}`);
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load article"));
      setSelected(await res.json());
    } catch (err) {
      setLoadError(err.message || "Could not open article");
      setSelectedId(null);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        await refreshList();
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load catalog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    );
  }, [articles, search]);

  async function saveArticleMeta({ name, description }) {
    const isEdit = articleModal?.mode === "edit";
    const res = await apiFetch(
      isEdit ? `/api/articles/${articleModal.article.id}` : "/api/articles",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      }
    );
    if (!res.ok) throw new Error(await readApiError(res, "Failed to save article"));
    const saved = await res.json();
    await refreshList();
    setArticleModal(null);
    if (!isEdit) await openArticle(saved.id);
    else if (selectedId === saved.id) {
      setSelected((prev) => (prev ? { ...prev, ...saved, types: prev.types } : saved));
    }
  }

  async function saveType(payload) {
    const isEdit = Boolean(typeEditor?.type?.id);
    const url = isEdit
      ? `/api/types/${typeEditor.type.id}`
      : `/api/articles/${selectedId}/types`;
    const res = await apiFetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readApiError(res, "Failed to save type"));
    setTypeEditor(null);
    await openArticle(selectedId);
    await refreshList();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "article") {
      const res = await apiFetch(`/api/articles/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to delete"));
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
        setSelected(null);
      }
      await refreshList();
      return;
    }
    const res = await apiFetch(`/api/types/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readApiError(res, "Failed to delete"));
    setDeleteTarget(null);
    await openArticle(selectedId);
    await refreshList();
  }

  const inTypeEditor = Boolean(typeEditor);
  const inArticle = Boolean(selectedId) && !inTypeEditor;

  return (
    <AppShell
      title={
        inTypeEditor
          ? typeEditor.type?.name || (typeEditor.type?.id ? "Edit type" : "New type")
          : inArticle
            ? selected?.name || "Article"
            : "Item Costing"
      }
      subtitle={
        inTypeEditor
          ? selected?.name
          : inArticle
            ? "Choose a type to edit rates"
            : "Add articles, then types"
      }
      maxWidth="48rem"
      actions={
        !inTypeEditor && !inArticle ? (
          <button type="button" className="primary-btn inline-flex items-center gap-1.5" onClick={() => setArticleModal({ mode: "create" })}>
            <PlusIcon /> Article
          </button>
        ) : inArticle ? (
          <button type="button" className="primary-btn inline-flex items-center gap-1.5" onClick={() => setTypeEditor({ type: emptyTypeDraft() })}>
            <PlusIcon /> Type
          </button>
        ) : null
      }
    >
      {loading ? (
        <p className="text-[13px] py-16 text-center" style={{ color: COLORS.graphiteLight }}>Loading…</p>
      ) : loadError && !articles.length ? (
        <div className="py-12 text-center">
          <p className="text-[14px] font-semibold mb-1" style={{ color: COLORS.rust }}>Could not load</p>
          <p className="text-[12.5px] mb-4" style={{ color: COLORS.graphite }}>{loadError}</p>
          <button type="button" className="primary-btn" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : inTypeEditor ? (
        <TypeEditor
          initialType={typeEditor.type}
          articleName={selected?.name || ""}
          onCancel={() => setTypeEditor(null)}
          onSave={saveType}
        />
      ) : inArticle ? (
        <div>
          <div className="flex items-center gap-3 mb-6 text-[12.5px]">
            <button
              type="button"
              className="font-semibold"
              style={{ color: COLORS.goldDim }}
              onClick={() => { setSelectedId(null); setSelected(null); }}
            >
              ← Articles
            </button>
            <span style={{ color: COLORS.border }}>|</span>
            <button
              type="button"
              className="font-medium"
              style={{ color: COLORS.graphite }}
              onClick={() => setArticleModal({ mode: "edit", article: selected })}
            >
              Rename
            </button>
            <button
              type="button"
              className="font-medium"
              style={{ color: COLORS.rust }}
              onClick={() => setDeleteTarget({ kind: "article", id: selected.id, label: selected.name })}
            >
              Delete
            </button>
          </div>

          {detailLoading || !selected ? (
            <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>Loading…</p>
          ) : (selected.types || []).length ? (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              {(selected.types || []).map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3.5 group"
                  style={{
                    borderTop: i ? `1px solid ${COLORS.border}` : "none",
                  }}
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setTypeEditor({ type: t })}
                  >
                    <div className="text-[14.5px] font-semibold truncate" style={{ color: COLORS.ink }}>{t.name}</div>
                    <div className="text-[12px] mt-0.5 truncate" style={{ color: COLORS.graphiteLight }}>
                      {typeMeta(t)}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="text-[12px] font-medium opacity-0 group-hover:opacity-100 px-2 py-1"
                    style={{ color: COLORS.rust }}
                    onClick={() => setDeleteTarget({ kind: "type", id: t.id, label: t.name })}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg"
                    style={{ color: COLORS.graphiteLight }}
                    onClick={() => setTypeEditor({ type: t })}
                    aria-label={`Edit ${t.name}`}
                  >
                    <ChevronRight />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-[13px] mb-4" style={{ color: COLORS.graphiteLight }}>
                No types yet — e.g. KAJ Button, Zipper
              </p>
              <button
                type="button"
                className="primary-btn inline-flex items-center gap-1.5"
                onClick={() => setTypeEditor({ type: emptyTypeDraft() })}
              >
                <PlusIcon /> Add type
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5">
            <div className="search-wrap w-full max-w-md">
              <SearchIcon />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
              />
            </div>
          </div>

          {filtered.length ? (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              {filtered.map((a, i) => {
                const count = (a.types || []).length || a.typeCount || 0;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left row-hover"
                    style={{ borderTop: i ? `1px solid ${COLORS.border}` : "none" }}
                    onClick={() => openArticle(a.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-semibold truncate" style={{ color: COLORS.ink }}>
                        {a.name}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                        {count} type{count === 1 ? "" : "s"}
                        {a.description ? ` · ${a.description}` : ""}
                      </div>
                    </div>
                    <span style={{ color: COLORS.graphiteLight }}><ChevronRight /></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-[13px]" style={{ color: COLORS.graphiteLight }}>
                {search.trim() ? "Nothing matched." : "Add your first article to begin."}
              </p>
            </div>
          )}
        </>
      )}

      {articleModal && (
        <NameModal
          title={articleModal.mode === "edit" ? "Rename" : "New article"}
          initial={articleModal.article}
          onClose={() => setArticleModal(null)}
          onSave={saveArticleMeta}
        />
      )}

      {deleteTarget && (
        <ConfirmDelete
          label={deleteTarget.label}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      <style>{`
        @keyframes modalPop { from { opacity: 0; transform: scale(0.97) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-overlay { background: rgba(28,25,23,0.45); backdrop-filter: blur(2px); animation: overlayIn 0.15s ease both; }
        .modal-pop { animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .form-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: ${COLORS.graphite}; margin-bottom: 5px; display: block; }
        .form-input {
          font-family: ${FONT}; font-size: 13px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 10px; padding: 8px 11px; outline: none; width: 100%;
        }
        .form-input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}55; }
        .primary-btn {
          font-family: ${FONT}; font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 10px;
          background: ${COLORS.gold}; color: ${COLORS.inkSurface}; border: none; cursor: pointer;
        }
        .primary-btn:disabled { opacity: 0.45; cursor: default; }
        .primary-btn:not(:disabled):hover { filter: brightness(1.05); }
        .ghost-btn {
          font-family: ${FONT}; font-size: 12.5px; font-weight: 600; padding: 8px 14px; border-radius: 10px;
          background: transparent; color: ${COLORS.graphite}; border: 1px solid ${COLORS.border}; cursor: pointer;
        }
        .row-hover { transition: background .15s ease; }
        .row-hover:hover { background: ${COLORS.boneDim}; }
        .search-wrap { position: relative; display: flex; align-items: center; }
        .search-wrap svg { position: absolute; left: 12px; color: ${COLORS.graphiteLight}; pointer-events: none; }
        .search-wrap input {
          font-family: ${FONT}; font-size: 13px; color: ${COLORS.ink}; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 10px 12px 10px 34px;
          outline: none; width: 100%;
        }
        .search-wrap input::placeholder { color: ${COLORS.graphiteLight}; }
        .search-wrap input:focus { border-color: ${COLORS.gold}; box-shadow: 0 0 0 3px ${COLORS.goldSoft}55; }
      `}</style>
    </AppShell>
  );
}
