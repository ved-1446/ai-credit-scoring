import React from "react";
import { getRiskBandInfo } from "../constants/risk";

export function RiskBadge({ band, className = "" }) {
  const info = getRiskBandInfo(band);
  const fillVar = info.cssFillVar || info.cssVar;

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border shadow-sm ${className}`}
      style={{
        backgroundColor: `rgb(var(${fillVar}) / 0.15)`,
        color: `rgb(var(${info.cssVar}))`,
        borderColor: `rgb(var(${fillVar}) / 0.35)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `rgb(var(${fillVar}))` }}
      />
      <span>{band}</span>
    </span>
  );
}
