import React, { useState, useEffect } from "react";
import { api } from "../api";
import { formatBand } from "../utils/format";
import { useChartTheme } from "../components/charts/useChartTheme";
import { ChartTooltip } from "../components/charts/ChartTooltip";
import { Skeleton } from "../components/ui/Skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell 
} from "recharts";
import { AlertCircle } from "lucide-react";

export function Reliability() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chartColors = useChartTheme();

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getMetrics();
        setMetrics(data);
      } catch (err) {
        setError(err.message || "Failed to load reliability metrics.");
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-amber-400 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-50">Information Unavailable</h2>
        <p className="text-xs text-slate-400">{error || "Could not retrieve reliability data."}</p>
      </div>
    );
  }

  const precision = metrics.test_metrics?.precision ?? 0;
  const recall = metrics.test_metrics?.recall ?? 0;
  const nFlagged = Math.round(precision * 100);
  const mCaught = Math.round(recall * 100);

  const riskBandsData = (metrics.risk_bands || []).map((b) => {
    let barColor = chartColors.neutral;
    const bandKey = (b.band || "").toUpperCase();
    if (bandKey === "LOW") barColor = chartColors.riskLow;
    else if (bandKey === "MEDIUM") barColor = chartColors.riskMedium;
    else if (bandKey === "HIGH") barColor = chartColors.riskHigh;
    else if (bandKey === "VERY_HIGH") barColor = chartColors.riskVeryHigh;

    return {
      band: b.band,
      label: formatBand(b.band),
      rate: Number(((b.val_default_rate || 0) * 100).toFixed(1)),
      color: barColor,
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-display text-theme-primary tracking-tight">
          How reliable is this tool?
        </h1>
        <p className="text-sm text-theme-muted max-w-2xl leading-relaxed">
          This system uses empirical historical evaluations to estimate default risk. Below is how the system performs on a held-out test set and what its practical limitations are.
        </p>
      </div>

      <div className="border-t border-theme" />

      {/* 10x10 Dot Grids */}
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-mono mb-2">
            measured on a held-out test set
          </div>
          <p className="text-xs text-theme-muted max-w-2xl leading-relaxed">
            These numbers come from the full model that uses all 226 inputs. This website asks 27 questions and fills the rest with typical values, so results on the website can differ somewhat. The test set is small (about 103 people who defaulted), so the numbers are rough.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Flagged accuracy */}
          <div className="p-6 rounded-xl border border-theme bg-surface space-y-4">
            <div>
              <p className="text-base font-semibold text-theme-primary">
                Of every 100 people the model flags, about{" "}
                <span className="text-brand-400 font-mono font-bold">{nFlagged}</span> really default.
              </p>
              <p className="text-xs text-theme-muted mt-1">
                The other {100 - nFlagged} people flagged did repay.
              </p>
            </div>

            <div className="grid grid-cols-10 gap-1.5 pt-2 max-w-[220px]">
              {Array.from({ length: 100 }).map((_, i) => (
                <div
                  key={`dot-n-${i}`}
                  className="h-3 w-3 rounded-sm transition-colors"
                  style={{
                    backgroundColor: i < nFlagged ? chartColors.accent : chartColors.grid,
                  }}
                  title={i < nFlagged ? "Defaulted" : "Repaid"}
                />
              ))}
            </div>
            <div className="flex items-center space-x-4 text-[11px] text-theme-muted pt-1 font-mono">
              <span className="inline-flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.accent }} />
                <span>Really defaulted ({nFlagged})</span>
              </span>
              <span className="inline-flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.grid }} />
                <span>Repaid ({100 - nFlagged})</span>
              </span>
            </div>
          </div>

          {/* Catch rate */}
          <div className="p-6 rounded-xl border border-theme bg-surface space-y-4">
            <div>
              <p className="text-base font-semibold text-theme-primary">
                Of every 100 people who really default, the model catches about{" "}
                <span className="text-brand-400 font-mono font-bold">{mCaught}</span>.
              </p>
              <p className="text-xs text-theme-muted mt-1">
                The other {100 - mCaught} people who defaulted were not flagged.
              </p>
            </div>

            <div className="grid grid-cols-10 gap-1.5 pt-2 max-w-[220px]">
              {Array.from({ length: 100 }).map((_, i) => (
                <div
                  key={`dot-m-${i}`}
                  className="h-3 w-3 rounded-sm transition-colors"
                  style={{
                    backgroundColor: i < mCaught ? chartColors.brand : chartColors.grid,
                  }}
                  title={i < mCaught ? "Caught by tool" : "Missed"}
                />
              ))}
            </div>
            <div className="flex items-center space-x-4 text-[11px] text-theme-muted pt-1 font-mono">
              <span className="inline-flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.brand }} />
                <span>Caught ({mCaught})</span>
              </span>
              <span className="inline-flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.grid }} />
                <span>Missed ({100 - mCaught})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* Bar Chart: Default rate by risk band */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400">
            Real default rate by risk level (measured on a validation sample)
          </h2>
          <p className="text-sm font-semibold text-slate-50 mt-1">
            Do higher risk levels really default more?
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Higher assigned levels correspond to significantly higher observed default rates in validation data.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-slate-700/60 bg-slate-800/40">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBandsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={chartColors.axis}
                  tick={{ fill: chartColors.mutedText, fontSize: 12 }}
                />
                <YAxis
                  stroke={chartColors.axis}
                  tick={{ fill: chartColors.mutedText, fontSize: 11 }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.03)" }}
                  content={
                    <ChartTooltip
                      formatter={(val) => `${val}% real default rate`}
                    />
                  }
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={54}>
                  {riskBandsData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* Limits Section */}
      <div className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400">
          Known tool limits
        </h2>

        <div className="p-6 rounded-xl border border-slate-700/60 bg-slate-800/40 space-y-3">
          <ul className="space-y-2.5 text-xs text-slate-300 list-disc list-inside leading-relaxed">
            <li>
              <strong className="text-slate-50">Trained on a sample:</strong> The evaluation is trained on representative historical credit records and may not reflect unusual individual circumstances.
            </li>
            <li>
              <strong className="text-slate-50">Simplified inputs:</strong> The application form asks for fewer details than full institutional credit checks, so unentered parameters use typical median values.
            </li>
            <li>
              <strong className="text-slate-50">Simulated estimates:</strong> Results are educational risk score simulations, not real-world credit approvals or loan commitments.
            </li>
            <li>
              <strong className="text-slate-50">Demographic parameters:</strong> Gender and age are included in the underlying model features and are actively tracked on fairness audits.
            </li>
            <li>
              <strong className="text-slate-50">Currency &amp; amounts:</strong> Amounts are entered in rupees and used as plain numbers. The tool does no currency conversion.
            </li>
            <li>
              <strong className="text-slate-50">Language:</strong> Explanations and feature summaries are optimized primarily for English text.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
