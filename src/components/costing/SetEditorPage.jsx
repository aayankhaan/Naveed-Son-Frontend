import { useState, useMemo } from "react";
import { FONT, COLORS } from "../../constants/theme";
import { genId, emptySetArticle, formatPKR } from "../../lib/manufacturingPricing";
import ArticleCostingForm, { normalizeSetArticle } from "./ArticleCostingForm";

const STEPS = [
  { id: "basics", label: "Set info", short: "1" },
  { id: "articles", label: "Articles", short: "2" },
];

function StepIndicator({ current, onJump }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {STEPS.map((step, i) => {
        const active = step.id === current;
        const done = STEPS.findIndex((s) => s.id === current) > i;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onJump(step.id)}
            className="flex items-center gap-2 shrink-0 px-3 sm:px-4 py-2.5 rounded-xl transition-all"
            style={{
              background: active ? COLORS.gold : done ? COLORS.goldSoft : COLORS.card,
              border: `1px solid ${active ? COLORS.gold : COLORS.border}`,
              color: COLORS.ink,
            }}
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: active ? COLORS.inkSurface : COLORS.boneDim, color: active ? COLORS.gold : COLORS.graphite }}>
              {done ? "✓" : step.short}
            </span>
            <span className="text-[12px] font-semibold">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function SetEditorPage({ initialSet, onSave, onCancel }) {
  const isNew = !initialSet?.id;
  const [step, setStep] = useState("basics");
  const [name, setName] = useState(initialSet?.name || "");
  const [description, setDescription] = useState(initialSet?.description || "");
  const [setArticles, setSetArticles] = useState(() =>
    initialSet?.articles?.length ? JSON.parse(JSON.stringify(initialSet.articles)) : [emptySetArticle()]
  );
  const [expandedArticleId, setExpandedArticleId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const canBasics = name.trim().length > 0;
  const canArticles = setArticles.some((a) => a.name?.trim());

  const validationMsg = useMemo(() => {
    if (step === "basics" && !canBasics) return "Enter a set name to continue.";
    if (step === "articles" && !canArticles) return "Add at least one article with a name.";
    return "";
  }, [step, canBasics, canArticles]);

  function goNext() {
    if (step === "basics" && canBasics) setStep("articles");
  }
  function goBack() {
    if (step === "articles") setStep("basics");
  }

  async function handleSave() {
    if (!canBasics || !canArticles || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        id: initialSet?.id || genId("SET"),
        name: name.trim(),
        description: description.trim(),
        articles: setArticles.filter((a) => a.name?.trim()).map(normalizeSetArticle),
        configurations: [],
      });
    } catch (err) {
      console.error(err);
      setSaveError(err?.message || "Could not save set");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col" style={{ fontFamily: FONT }}>
      <div className="sticky top-[65px] z-20 px-4 sm:px-6 py-4 backdrop-blur" style={{ background: `${COLORS.bone}F5`, borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button type="button" className="btn-secondary p-2 rounded-lg shrink-0" style={{ border: `1px solid ${COLORS.border}` }} onClick={onCancel} aria-label="Back to sets">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke={COLORS.ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] sm:text-[18px] font-semibold truncate" style={{ color: COLORS.ink }}>{isNew ? "Create new set" : `Edit ${name || "set"}`}</h2>
              <p className="text-[11.5px] truncate" style={{ color: COLORS.graphiteLight }}>Name the set, then list its articles — size &amp; qty are set on the order</p>
            </div>
          </div>
          <StepIndicator current={step} onJump={setStep} />
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-6 pb-28 max-w-3xl mx-auto w-full">
        {step === "basics" && (
          <div className="space-y-5 fade-in">
            <div className="rounded-2xl p-4 sm:p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <label className="form-label">Set name *</label>
              <input className="form-input text-[15px] py-2.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Duvet Set" autoFocus />
              <label className="form-label mt-4">Description</label>
              <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's in this set?" />
            </div>
          </div>
        )}

        {step === "articles" && (
          <div className="space-y-4 fade-in">
            <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: COLORS.goldSoft, border: `1px solid ${COLORS.border}`, color: COLORS.graphite }}>
              Tap an article to expand wages &amp; add-ons. Part quantities and size are chosen when placing an order.
            </div>
            {setArticles.map((article, i) => {
              const open = expandedArticleId === article.id;
              const labor = (Number(article.cuttingRate) || 0) + (Number(article.stitchingRate) || 0) + (Number(article.checkingRate) || 0) + (Number(article.packingRate) || 0);
              return (
                <div key={article.id} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${open ? COLORS.gold : COLORS.border}`, background: COLORS.card }}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-4 text-left"
                    style={{ background: open ? COLORS.goldSoft : COLORS.card }}
                    onClick={() => setExpandedArticleId(open ? null : article.id)}
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: COLORS.inkSurface, color: COLORS.gold }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: COLORS.ink }}>{article.name?.trim() || "Untitled article"}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: COLORS.graphiteLight }}>
                        Sell {formatPKR(Number(article.sellingPrice) || 0)} · Labor {formatPKR(labor)} · {(article.addons || []).length} add-ons
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}>
                      <path d="M3.5 5.5L7 9l3.5-3.5" stroke={COLORS.graphite} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {open && (
                    <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                      <ArticleCostingForm
                        article={article}
                        index={i}
                        embedded
                        onChange={(updated) => setSetArticles(setArticles.map((x, j) => (j === i ? updated : x)))}
                        onRemove={setArticles.length > 1 ? () => { setSetArticles(setArticles.filter((_, j) => j !== i)); setExpandedArticleId(null); } : undefined}
                        showProfitCalc
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className="w-full py-4 rounded-2xl text-[13px] font-semibold border-2 border-dashed"
              style={{ borderColor: COLORS.boneBorder, color: COLORS.goldDim, background: COLORS.card }}
              onClick={() => {
                const next = emptySetArticle();
                setSetArticles([...setArticles, next]);
                setExpandedArticleId(next.id);
              }}
            >
              + Add another article
            </button>
          </div>
        )}

        {(validationMsg || saveError) && (
          <p className="text-[12px] mt-4 text-center" style={{ color: COLORS.rust }}>{saveError || validationMsg}</p>
        )}
      </div>

      <div
        className="fixed bottom-0 inset-x-0 z-30 md:left-64 backdrop-blur"
        style={{ background: `${COLORS.bone}F8`, borderTop: `1px solid ${COLORS.border}` }}
      >
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-3 sm:py-4">
          {saveError && stepIndex === STEPS.length - 1 && (
            <p className="text-[12px] text-center mb-2" style={{ color: COLORS.rust }}>{saveError}</p>
          )}
          <div className="mx-auto flex w-full max-w-sm flex-col-reverse gap-2.5 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-3">
            {stepIndex > 0 ? (
              <button type="button" className="btn-secondary w-full sm:w-auto sm:min-w-[7.5rem] text-[13px] font-semibold px-6 py-3 rounded-xl" style={{ border: `1px solid ${COLORS.border}` }} onClick={goBack} disabled={saving}>Back</button>
            ) : (
              <button type="button" className="btn-secondary w-full sm:w-auto sm:min-w-[7.5rem] text-[13px] font-semibold px-6 py-3 rounded-xl" style={{ border: `1px solid ${COLORS.border}` }} onClick={onCancel} disabled={saving}>Cancel</button>
            )}
            {stepIndex < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn-primary w-full sm:w-auto sm:min-w-[9rem] text-[13px] font-semibold px-6 py-3 rounded-xl"
                style={{ background: COLORS.gold, color: COLORS.inkSurface, opacity: canBasics ? 1 : 0.5 }}
                disabled={!canBasics}
                onClick={goNext}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary w-full sm:w-auto sm:min-w-[9rem] text-[13px] font-semibold px-6 py-3 rounded-xl"
                style={{ background: COLORS.gold, color: COLORS.inkSurface, opacity: canArticles && !saving ? 1 : 0.5 }}
                disabled={!canArticles || saving}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save set"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
