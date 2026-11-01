import React, { useState, useEffect } from "react";
import { api } from "../../api";
import { SENSITIVE_INPUTS_NOTE } from "../../constants/text";
import { Sparkles, FileText, Globe, AlertCircle } from "lucide-react";

export function ExplanationPanel({ predictionId, fallbackHeadline }) {
  const [currentLang, setCurrentLang] = useState("en");
  const [cachedExplanations, setCachedExplanations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch explanation when language changes if not already in memory
  useEffect(() => {
    if (!predictionId) return;
    if (cachedExplanations[currentLang]) return;

    let isMounted = true;
    async function loadExplanation() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.explain({
          prediction_id: predictionId,
          language: currentLang,
        });
        if (isMounted) {
          setCachedExplanations((prev) => ({
            ...prev,
            [currentLang]: res,
          }));
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Could not load AI explanation.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadExplanation();

    return () => {
      isMounted = false;
    };
  }, [predictionId, currentLang, cachedExplanations]);

  const explanation = cachedExplanations[currentLang];

  return (
    <section className="bg-slate-800/40 rounded-xl border border-slate-700/60 p-6 space-y-6">
      {/* Header with Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-700/60">
        <div className="flex items-center space-x-2.5">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <h2 className="text-base font-semibold text-slate-50">Assessment Summary &amp; Factor Breakdown</h2>
        </div>

        <div className="flex items-center space-x-1.5 self-start sm:self-auto">
          <Globe className="h-3.5 w-3.5 text-slate-400 mr-1" />
          {[
            { code: "en", label: "English" },
            { code: "hi", label: "Hindi (हिंदी)" },
            { code: "mr", label: "Marathi (मराठी)" },
          ].map((l) => (
            <button
              key={l.code}
              onClick={() => setCurrentLang(l.code)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                currentLang === l.code
                  ? "bg-slate-700 text-slate-50 font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Body */}
      {loading && !explanation ? (
        <div className="space-y-4 py-3 animate-pulse">
          <div className="h-5 bg-slate-700/50 rounded w-2/3" />
          <div className="h-4 bg-slate-700/40 rounded w-full" />
          <div className="h-4 bg-slate-700/40 rounded w-5/6" />
          <div className="space-y-2 pt-2">
            <div className="h-3 bg-slate-700/30 rounded w-1/2" />
            <div className="h-3 bg-slate-700/30 rounded w-2/5" />
          </div>
        </div>
      ) : explanation ? (
        <div className="space-y-5 text-sm">
          {/* Headline and Source Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-50 font-display">
              {explanation.headline}
            </h3>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
              {explanation.source === "gemini" ? (
                <>
                  <Sparkles className="h-3 w-3 text-brand-400" />
                  <span>AI-assisted summary</span>
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3 text-slate-400" />
                  <span>Standard summary</span>
                </>
              )}
            </span>
          </div>

          {/* Language fallback notice */}
          {explanation.language_fallback && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              Shown in English because this language is not available for this text.
            </div>
          )}

          {/* Summary Text */}
          <p className="text-slate-200 leading-relaxed">
            {explanation.summary}
          </p>

          {/* Main Factors (Numbered List) */}
          {explanation.main_factors && explanation.main_factors.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400">
                Main Factors
              </h4>
              <ol className="space-y-3 list-decimal list-inside text-slate-200 text-xs leading-relaxed">
                {explanation.main_factors.map((factor, idx) => {
                  // Find any matching factor note
                  const matchingNote = explanation.factor_notes?.find(
                    (fn) => fn.factor === factor
                  );

                  return (
                    <li key={`factor-${idx}`} className="space-y-1">
                      <span className="font-medium text-slate-100">{factor}</span>
                      {matchingNote && (
                        <p className="text-[11px] text-slate-400 pl-4 border-l border-slate-700 italic">
                          {matchingNote.note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Other Inputs Note (Sensitive Gender/Age) */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs text-slate-400">
            {explanation.other_inputs_note || SENSITIVE_INPUTS_NOTE}
          </div>

          {/* Disclaimer */}
          <div className="text-[11px] font-mono text-slate-400 border-t border-slate-700/60 pt-3">
            {explanation.disclaimer}
          </div>
        </div>
      ) : (
        /* Fallback when endpoint fails or times out */
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-50 font-display">
              {fallbackHeadline || "Assessment Complete"}
            </h3>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
              <FileText className="h-3 w-3 text-slate-400" />
              <span>Standard text</span>
            </span>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>Detailed explanation currently unavailable. Showing standard model metrics below.</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs text-slate-400">
            {SENSITIVE_INPUTS_NOTE}
          </div>
        </div>
      )}
    </section>
  );
}
