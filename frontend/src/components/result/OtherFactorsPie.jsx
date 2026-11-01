import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useChartTheme } from "../charts/useChartTheme";
import { ChartTooltip } from "../charts/ChartTooltip";
import { isSensitiveField } from "../../utils/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";

export function OtherFactorsPie({ factors = [] }) {
  const chartColors = useChartTheme();
  const [activeSliceIndex, setActiveSliceIndex] = useState(null);

  // If 5 or fewer factors, show informative notice
  if (!factors || factors.length <= 5) {
    return (
      <section className="bg-surface rounded-2xl border border-theme p-6 text-center space-y-3 shadow-sm">
        <div className="mx-auto h-10 w-10 rounded-xl bg-surface-hover border border-theme flex items-center justify-center text-brand-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-theme-primary font-display">
            Extended Factor Breakdown
          </h3>
          <p className="text-xs text-theme-muted max-w-md mx-auto">
            Extra factor detail is available for assessments created after this update. Run a new assessment to see it.
          </p>
        </div>
        <div className="pt-1">
          <Link
            to="/apply"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-surface-hover hover:bg-surface-active text-theme-primary border border-theme rounded-xl text-xs font-medium transition-colors"
          >
            <span>Start new assessment</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-brand-400" />
          </Link>
        </div>
      </section>
    );
  }

  // Next factors after the top 5
  const otherFactors = factors.slice(5);
  const totalAbsShap = otherFactors.reduce((acc, f) => acc + Math.abs(f?.shap_value || 0), 0) || 0.001;

  // Color tint variants for adjacent distinction
  const upTints = [chartColors.up, "#f87171", "#fb923c", "#f43f5e"];
  const downTints = [chartColors.down, "#2dd4bf", "#38bdf8", "#06b6d4"];

  const pieData = otherFactors.map((f, idx) => {
    const absVal = Math.abs(f?.shap_value || 0);
    const sharePercent = Math.round((absVal / totalAbsShap) * 100);
    const isSensitive = isSensitiveField(f?.source_field, f?.feature);
    const isUp = (f?.shap_value || 0) > 0;

    let sliceColor = isUp ? upTints[idx % upTints.length] : downTints[idx % downTints.length];
    if (isSensitive) {
      sliceColor = chartColors.neutral;
    }

    return {
      index: idx,
      name: f?.display_name || f?.feature || `Factor ${idx + 6}`,
      value: absVal,
      sharePercent,
      isUp,
      isSensitive,
      color: sliceColor,
      rawShap: f?.shap_value,
    };
  });

  return (
    <section className="bg-surface rounded-2xl border border-theme p-6 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center space-x-2.5 pb-3 border-b border-theme">
        <PieIcon className="h-4 w-4 text-brand-400" />
        <div>
          <h2 className="text-base font-semibold text-theme-primary font-display">
            Other factors that also counted
          </h2>
          <p className="text-xs text-theme-muted mt-0.5">
            Shares are among these factors only. Color shows the direction.
          </p>
        </div>
      </div>

      {/* Donut Chart & Synchronized Legend */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Donut Chart */}
        <div className="md:col-span-5 h-56 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                onMouseEnter={(_, index) => setActiveSliceIndex(index)}
                onMouseLeave={() => setActiveSliceIndex(null)}
              >
                {pieData.map((entry, idx) => (
                  <Cell
                    key={`pie-${idx}`}
                    fill={entry.color}
                    opacity={activeSliceIndex === null || activeSliceIndex === idx ? 1 : 0.4}
                    stroke={activeSliceIndex === idx ? chartColors.brand : "none"}
                    strokeWidth={1.5}
                  />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <ChartTooltip
                      title={item.name}
                      items={[
                        { label: "Share among secondary factors", value: `${item.sharePercent}%`, mono: true },
                        {
                          label: "Direction",
                          value: item.isUp ? "Raises risk" : "Lowers risk",
                          color: item.color,
                          bold: true,
                        },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider">Next</span>
            <span className="text-sm font-bold text-theme-primary font-mono">{otherFactors.length} factors</span>
          </div>
        </div>

        {/* Legend */}
        <div className="md:col-span-7 space-y-1.5 text-xs">
          {pieData.map((item, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setActiveSliceIndex(idx)}
              onMouseLeave={() => setActiveSliceIndex(null)}
              className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                activeSliceIndex === idx
                  ? "bg-surface-active border-brand-500/50"
                  : "bg-surface-hover border-theme hover:bg-surface-active"
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0 pr-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-theme-primary font-medium truncate">{item.name}</span>
                {item.isUp ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                )}
              </div>

              <span className="font-mono text-theme-primary font-semibold flex-shrink-0">
                {item.sharePercent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Caption footer */}
      <p className="text-[11px] text-theme-muted italic pt-1">
        Shares are among these factors only. Color shows the direction.
      </p>
    </section>
  );
}
