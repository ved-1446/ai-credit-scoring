import React from "react";
import { formatThreshold, formatProbability } from "../../utils/format";

export function RiskScale({ probability, threshold, riskBands }) {
  if (!riskBands || !riskBands.length || threshold === null || threshold === undefined) {
    return null;
  }

  // Sizing segments based on max boundary
  // Max scale span typically up to 3*threshold or 1.0
  const maxScale = Math.max(0.40, threshold * 2.5);

  const bands = [
    { key: "LOW", label: "Low", min: 0, max: 0.5 * threshold, cssVar: "--risk-low-fill" },
    { key: "MEDIUM", label: "Medium", min: 0.5 * threshold, max: threshold, cssVar: "--risk-medium-fill" },
    { key: "HIGH", label: "High", min: threshold, max: 2 * threshold, cssVar: "--risk-high-fill" },
    { key: "VERY_HIGH", label: "Very high", min: 2 * threshold, max: maxScale, cssVar: "--risk-very-high-fill" },
  ];

  const clampedProb = Math.max(0, Math.min(probability, maxScale));
  const probPositionPercent = (clampedProb / maxScale) * 100;
  const thresholdPositionPercent = (threshold / maxScale) * 100;

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono text-[11px] uppercase tracking-wider">Risk continuum</span>
        <span className="font-mono text-[11px]">
          Review cut-off: <strong className="text-slate-200">{formatThreshold(threshold)}</strong>
        </span>
      </div>

      {/* Horizontal Bar with Segments */}
      <div className="relative pt-6 pb-2">
        {/* Probability Marker */}
        <div
          className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center transition-all duration-500 ease-out pointer-events-none z-10"
          style={{ left: `${probPositionPercent}%` }}
        >
          <span className="text-[10px] font-mono font-bold text-theme-primary bg-surface border border-theme px-1.5 py-0.5 rounded shadow-sm">
            {formatProbability(probability)}
          </span>
          <div className="w-0.5 h-2.5 bg-theme-primary mt-0.5" />
        </div>

        {/* The Track */}
        <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-800">
          {bands.map((b) => {
            const widthPct = ((b.max - b.min) / maxScale) * 100;
            return (
              <div
                key={b.key}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: `rgb(var(${b.cssVar}))`,
                  opacity: 0.85,
                }}
                title={`${b.label}: ${formatProbability(b.min)} to ${formatProbability(b.max)}`}
              />
            );
          })}
        </div>

        {/* Threshold Cut-off Tick Line */}
        <div
          className="absolute top-5 bottom-1 transform -translate-x-1/2 pointer-events-none z-10"
          style={{ left: `${thresholdPositionPercent}%` }}
        >
          <div className="w-0.5 h-full bg-slate-50 border border-slate-900 shadow-sm" />
        </div>
      </div>

      {/* Scale Legend */}
      <div className="flex justify-between text-[10px] font-mono text-slate-400">
        <span>0%</span>
        <span className="text-center">Cut-off ({formatThreshold(threshold)})</span>
        <span>{formatProbability(maxScale)}</span>
      </div>
    </div>
  );
}
