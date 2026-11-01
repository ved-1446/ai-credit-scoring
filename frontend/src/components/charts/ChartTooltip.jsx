import React from "react";

export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-xs shadow-sm space-y-1">
      {label && (
        <p className="font-medium text-slate-200">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      {payload.map((item, idx) => {
        const val = formatter ? formatter(item.value, item.name, item) : `${item.name}: ${item.value}`;
        return (
          <p key={`tooltip-${idx}`} className="text-slate-300 font-mono" style={{ color: item.color || undefined }}>
            {val}
          </p>
        );
      })}
    </div>
  );
}
