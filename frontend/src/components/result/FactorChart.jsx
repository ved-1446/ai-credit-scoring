import React, { useState } from "react";
import { useChartTheme } from "../charts/useChartTheme";
import { isSensitiveField, getFactorStrength, formatMoney } from "../../utils/format";
import { useChat } from "../../context/useChat";
import { MessageSquare } from "lucide-react";

export function FactorChart({ factors = [] }) {
  const chartColors = useChartTheme();
  const { openChat } = useChat();
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!factors || factors.length === 0) {
    return (
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 p-8 text-center text-xs text-slate-400">
        No factor influence metrics available for this evaluation.
      </div>
    );
  }

  // Max |shap_value| among factors for width normalization (0 to 100%)
  const maxAbsShap = Math.max(...factors.map((f) => Math.abs(f.shap_value || 0)), 0.001);

  const formattedData = factors.map((f, idx) => {
    const absShap = Math.abs(f.shap_value || 0);
    const widthPercent = Math.min(100, Math.max(8, (absShap / maxAbsShap) * 100));
    const strength = getFactorStrength(absShap, maxAbsShap);
    const isSensitive = isSensitiveField(f.source_field, f.feature);
    const isUp = (f.shap_value || 0) > 0;

    let color = isUp ? chartColors.up : chartColors.down;
    if (isSensitive) {
      color = chartColors.neutral;
    }

    // Format display name & category pills
    // e.g. "Group: Category" with value 0/1 -> Group: Category with [Yes] / [No] pill
    const rawDisplayName = f.display_name || f.feature || "";
    let groupName = "";
    let categoryName = rawDisplayName;
    if (rawDisplayName.includes(":")) {
      const parts = rawDisplayName.split(":");
      groupName = parts[0].trim();
      categoryName = parts.slice(1).join(":").trim();
    }

    const isBinary = f.value === 0 || f.value === 1 || f.value === "0" || f.value === "1";
    const isBinaryYes = f.value === 1 || f.value === "1";

    // Plain sentence explanation
    let plainSentence = "";
    if (isUp) {
      if (strength === "Strong") {
        plainSentence = "This raises your estimated risk a lot compared with your other factors.";
      } else if (strength === "Moderate") {
        plainSentence = "This raises your estimated risk moderately compared with your other factors.";
      } else {
        plainSentence = "This slightly raises your estimated risk compared with your other factors.";
      }
    } else {
      if (strength === "Strong") {
        plainSentence = "This lowers your estimated risk a lot compared with your other factors.";
      } else if (strength === "Moderate") {
        plainSentence = "This lowers your estimated risk moderately compared with your other factors.";
      } else {
        plainSentence = "This slightly lowers your estimated risk compared with your other factors.";
      }
    }

    return {
      index: idx,
      feature: f.feature,
      sourceField: f.source_field,
      displayName: f.display_name,
      groupName,
      categoryName,
      value: f.value,
      isBinary,
      isBinaryYes,
      shap: f.shap_value,
      absShap,
      widthPercent,
      isUp,
      strength,
      isSensitive,
      color,
      plainSentence,
    };
  });

  const handleToggleRow = (idx) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  const handleAskWhy = (factorItem, e) => {
    if (e) e.stopPropagation();
    openChat({
      question: `Why did ${factorItem.displayName} affect my result?`,
      topic: "reasons_raised_lowered",
    });
  };

  return (
    <section className="bg-slate-800/40 rounded-xl border border-slate-700/60 p-6 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-slate-50 font-display">Influence of Key Factors on Risk</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Bars to the right push estimated risk up; bars to the left push estimated risk down. Click any factor row to inspect.
        </p>
      </div>

      {/* Legend & Strength Explanation */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 py-1.5 border-b border-slate-700/60">
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.down }} />
            <span>Lowers risk</span>
          </span>
          <span className="inline-flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.up }} />
            <span>Raises risk</span>
          </span>
          <span className="inline-flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.neutral }} />
            <span>Sensitive attribute</span>
          </span>
        </div>
        <span className="italic">
          Strength is relative to your single most influential factor.
        </span>
      </div>

      {/* HTML / CSS Factor Ladder (No Recharts) */}
      <div className="space-y-2 pt-2">
        {formattedData.map((factor, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div
              key={factor.index}
              tabIndex={0}
              role="button"
              aria-expanded={isExpanded}
              onClick={() => handleToggleRow(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleRow(idx);
                }
              }}
              style={{ animationDelay: `${idx * 60}ms` }}
              className={`p-3 rounded-xl border transition-all duration-160 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isExpanded
                  ? "bg-slate-800/90 border-slate-600 shadow-md"
                  : "bg-slate-900/50 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              {/* Row Grid: Factor Name (left), Diverging Bar with Strength word (center & right) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Left 4 cols: Factor Name & Value */}
                <div className="md:col-span-4 min-w-0 pr-2">
                  {factor.groupName && (
                    <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400 truncate">
                      {factor.groupName}
                    </span>
                  )}
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {factor.categoryName}
                    </span>
                    {factor.isBinary ? (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                          factor.isBinaryYes
                            ? "bg-slate-800 text-brand-300 border border-slate-700"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {factor.isBinaryYes ? "Yes" : "No"}
                      </span>
                    ) : (
                      factor.value !== null &&
                      factor.value !== undefined && (
                        <span className="text-[11px] font-mono text-slate-400">
                          ({["amt_credit", "amt_income_total", "amt_annuity", "amt_goods_price"].includes(factor.sourceField || factor.feature) && typeof factor.value === "number"
                            ? formatMoney(factor.value)
                            : String(factor.value)})
                        </span>
                      )
                    )}
                  </div>
                  {factor.isSensitive && (
                    <span className="inline-block text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 mt-0.5">
                      Sensitive attribute, shown for transparency
                    </span>
                  )}
                </div>

                {/* Right 8 cols: Center Axis Diverging Bar Container */}
                <div className="md:col-span-8 flex items-center h-7 relative bg-slate-950/40 rounded-lg px-2 border border-slate-800/50">
                  {/* Left Half (Lowers Risk) */}
                  <div className="w-1/2 flex justify-end items-center pr-1 relative h-full">
                    {!factor.isUp && (
                      <div
                        style={{
                          width: `${factor.widthPercent}%`,
                          backgroundColor: factor.color,
                        }}
                        className={`h-3.5 rounded-l-[3px] transition-all duration-500 ease-out flex items-center justify-start pl-1.5 ${
                          isExpanded ? "h-4 brightness-110" : ""
                        }`}
                      >
                        <span className="text-[9px] font-mono uppercase font-bold text-slate-900 drop-shadow-sm select-none">
                          {factor.strength}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Center Vertical Axis Marker */}
                  <div className="w-[1.5px] h-full bg-slate-700 z-10" />

                  {/* Right Half (Raises Risk) */}
                  <div className="w-1/2 flex justify-start items-center pl-1 relative h-full">
                    {factor.isUp && (
                      <div
                        style={{
                          width: `${factor.widthPercent}%`,
                          backgroundColor: factor.color,
                        }}
                        className={`h-3.5 rounded-r-[3px] transition-all duration-500 ease-out flex items-center justify-end pr-1.5 ${
                          isExpanded ? "h-4 brightness-110" : ""
                        }`}
                      >
                        <span className="text-[9px] font-mono uppercase font-bold text-slate-900 drop-shadow-sm select-none">
                          {factor.strength}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Smoothly Expandable Row Details */}
              {isExpanded && (
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-300 animate-in fade-in duration-160">
                  <p className="leading-relaxed">
                    {factor.plainSentence}
                  </p>

                  <button
                    type="button"
                    onClick={(e) => handleAskWhy(factor, e)}
                    className="self-start sm:self-auto inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-lg transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Ask why</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Caption footer */}
      <p className="text-[11px] text-slate-400 italic pt-1">
        Bars show how far each factor moved the model's score. This is not proof that a factor causes default.
      </p>
    </section>
  );
}
