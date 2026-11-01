/**
 * risk.js — Shared risk band constants, labels, descriptions, and CSS variable color mappings
 */
import { RISK_BAND_DESCRIPTIONS } from "./text";

export const RISK_BANDS = [
  {
    key: "LOW",
    label: "Low",
    cssVar: "--risk-low",
    cssFillVar: "--risk-low-fill",
    description: RISK_BAND_DESCRIPTIONS.LOW,
  },
  {
    key: "MEDIUM",
    label: "Medium",
    cssVar: "--risk-medium",
    cssFillVar: "--risk-medium-fill",
    description: RISK_BAND_DESCRIPTIONS.MEDIUM,
  },
  {
    key: "HIGH",
    label: "High",
    cssVar: "--risk-high",
    cssFillVar: "--risk-high-fill",
    description: RISK_BAND_DESCRIPTIONS.HIGH,
  },
  {
    key: "VERY_HIGH",
    label: "Very high",
    cssVar: "--risk-very-high",
    cssFillVar: "--risk-very-high-fill",
    description: RISK_BAND_DESCRIPTIONS.VERY_HIGH,
  },
];

export const RISK_BAND_MAP = RISK_BANDS.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});

export function getRiskBandInfo(key) {
  if (!key) {
    return {
      key: "UNKNOWN",
      label: "Unknown",
      cssVar: "--slate-500",
      description: "",
    };
  }
  const normalized = String(key).toUpperCase();
  return (
    RISK_BAND_MAP[normalized] || {
      key: normalized,
      label: normalized,
      cssVar: "--slate-500",
      description: "",
    }
  );
}
