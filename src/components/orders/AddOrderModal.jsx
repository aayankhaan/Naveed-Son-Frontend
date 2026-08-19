import { useEffect, useState } from "react";
import { COLORS } from "../../constants/theme";
import { CloseIcon } from "../icons/CommonIcons";
import TypeOrderBuilder, { typeBlocksFromOrder } from "./TypeOrderBuilder";
import { formatPKR } from "../../lib/orderFromType";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AddOrderModal({
  articles,
  editingOrder,
  onClose,
  onSave,
  isSaving,
  error,
}) {
  const initialBlocks = editingOrder
    ? typeBlocksFromOrder(editingOrder, articles)
    : undefined;

  const [atmNo, setAtmNo] = useState(editingOrder?.atm_no || "");
  const [customer, setCustomer] = useState(editingOrder?.customer || "");
  const [date, setDate] = useState(editingOrder?.order_date || todayISO());
  const [typeDraft, setTypeDraft] = useState({
    canApply: false,
    lines: [],
    error: null,
    grandTotal: 0,
  });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isValid =
    Boolean(atmNo.trim() && customer.trim()) && Boolean(typeDraft.canApply);

  function handleSubmit() {
    if (!isValid || isSaving) return;
    onSave({
      atm_no: atmNo.trim(),
      customer: customer.trim(),
      order_date: date || todayISO(),
      notes: "",
      lines: typeDraft.lines,
    });
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="modal-pop w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl"
        style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex items-start justify-between gap-3 px-6 py-5 sticky top-0 z-10"
          style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}` }}
        >
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: COLORS.ink }}>
              {editingOrder ? "Edit order" : "New order"}
            </h2>
            <p className="text-[11.5px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
              Article → type → material → size
            </p>
          </div>
          <button
            type="button"
            className="p-2 rounded-lg shrink-0"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-[12px]"
              style={{ background: COLORS.rustSoft, color: COLORS.rust }}
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div>
              <label className="form-label">ATM No</label>
              <input
                className="form-input"
                value={atmNo}
                onChange={(e) => setAtmNo(e.target.value)}
                placeholder="e.g. 4431"
              />
            </div>
            <div>
              <label className="form-label">Customer</label>
              <input
                className="form-input"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g. ZEEMAN"
              />
            </div>
            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <TypeOrderBuilder
            articles={articles}
            initialBlocks={initialBlocks}
            onDraftChange={setTypeDraft}
          />

          {typeDraft.error && (
            <p className="text-[12px] mt-3" style={{ color: COLORS.rust }}>
              {typeDraft.error}
            </p>
          )}
          {typeDraft.canApply && (
            <p className="text-[12px] mt-3" style={{ color: COLORS.graphite }}>
              Estimated sell {formatPKR(typeDraft.grandTotal)}
            </p>
          )}
        </div>

        <div
          className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4"
          style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}
        >
          <button
            type="button"
            className="text-[12.5px] font-medium px-4 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="text-[12.5px] font-semibold px-4 py-2 rounded-lg"
            style={{
              background: isValid ? COLORS.gold : COLORS.boneBorder,
              color: isValid ? COLORS.inkSurface : COLORS.graphiteLight,
              cursor: isValid && !isSaving ? "pointer" : "not-allowed",
            }}
            onClick={handleSubmit}
            disabled={!isValid || isSaving}
          >
            {isSaving ? "Saving…" : editingOrder ? "Save changes" : "Add order"}
          </button>
        </div>
      </div>
    </div>
  );
}
