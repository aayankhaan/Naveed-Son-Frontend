import { useMemo, useState } from "react";
import { COLORS } from "../../constants/theme";
import ModalLayer from "../ui/ModalLayer";

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M10.1 1.9a1.4 1.4 0 0 1 2 2L4.5 11.5 1.5 12.5l1-3L10.1 1.9z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.6 8.2c0 .5.5.8 1 .8h3.8c.5 0 .9-.3 1-.8L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SetCard({ set, index, onEdit, onDelete }) {
  const articles = set.articles || [];

  return (
    <button
      type="button"
      className="panel fade-in rounded-2xl p-5 sm:p-6 text-left w-full transition-all hover:shadow-md active:scale-[0.99]"
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, animationDelay: `${index * 60}ms` }}
      onClick={() => onEdit(set)}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold truncate" style={{ color: COLORS.ink }}>{set.name}</h3>
          {set.description && <p className="text-[12px] mt-1 line-clamp-2" style={{ color: COLORS.graphiteLight }}>{set.description}</p>}
        </div>
        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="p-2.5 rounded-xl" style={{ background: COLORS.goldSoft, color: COLORS.goldDim }} onClick={() => onEdit(set)} aria-label="Edit"><PencilIcon /></button>
          <button type="button" className="p-2.5 rounded-xl" style={{ background: COLORS.rustSoft, color: COLORS.rust }} onClick={() => onDelete(set)} aria-label="Delete"><TrashIcon /></button>
        </div>
      </div>

      <div className="rounded-xl p-3 text-center mb-4" style={{ background: COLORS.boneDim }}>
        <div className="text-[18px] font-bold" style={{ color: COLORS.ink }}>{articles.length}</div>
        <div className="text-[10px] font-semibold uppercase" style={{ color: COLORS.graphiteLight }}>Articles in set</div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {articles.slice(0, 6).map((a) => (
          <span key={a.id} className="text-[10.5px] px-2.5 py-1 rounded-full" style={{ background: COLORS.goldSoft, color: COLORS.graphite }}>{a.name}</span>
        ))}
        {articles.length > 6 && <span className="text-[10.5px] px-2 py-1" style={{ color: COLORS.graphiteLight }}>+{articles.length - 6}</span>}
      </div>
    </button>
  );
}

export default function SetBuilderSection({ sets, search, onCreate, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const filtered = useMemo(() => sets.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())
  ), [sets, search]);

  return (
    <>
      <button
        type="button"
        className="w-full sm:w-auto mb-5 flex items-center justify-center gap-2 text-[13px] font-semibold px-5 py-3.5 rounded-xl"
        style={{ background: COLORS.gold, color: COLORS.inkSurface }}
        onClick={onCreate}
      >
        <PlusIcon /> Create new set
      </button>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-10 sm:p-14 text-center" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          <div className="text-[15px] font-semibold mb-2" style={{ color: COLORS.ink }}>No sets yet</div>
          <p className="text-[13px] mb-6 max-w-sm mx-auto" style={{ color: COLORS.graphiteLight }}>Build a set with a name and article list — size and part quantities are set on the order.</p>
          <button type="button" className="text-[13px] font-semibold px-5 py-3 rounded-xl" style={{ background: COLORS.gold, color: COLORS.inkSurface }} onClick={onCreate}>Create your first set</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filtered.map((set, i) => (
            <SetCard key={set.id} set={set} index={i} onEdit={onEdit} onDelete={(s) => setDeleting(s)} />
          ))}
        </div>
      )}

      {deleting && (
        <ModalLayer onClose={() => !deleteBusy && setDeleting(null)} zClass="z-[90]" alignClass="items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="modal-pop w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-semibold mb-2" style={{ color: COLORS.rust }}>Delete set?</h3>
            <p className="text-[13px] mb-4" style={{ color: COLORS.graphite }}><strong>{deleting.name}</strong> will be removed permanently.</p>
            {deleteError && <p className="text-[12px] mb-4" style={{ color: COLORS.rust }}>{deleteError}</p>}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button type="button" className="w-full sm:w-auto px-5 py-3 rounded-xl text-[13px] font-semibold" style={{ border: `1px solid ${COLORS.border}` }} disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button>
              <button
                type="button"
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-[13px] font-semibold"
                style={{ background: COLORS.rust, color: COLORS.card, opacity: deleteBusy ? 0.7 : 1 }}
                disabled={deleteBusy}
                onClick={async () => {
                  setDeleteBusy(true);
                  setDeleteError("");
                  try {
                    await onDelete(deleting.id);
                    setDeleting(null);
                  } catch (err) {
                    setDeleteError(err?.message || "Could not delete set");
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}
    </>
  );
}
