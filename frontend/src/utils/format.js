/**
 * format.js — Formatting helpers for probabilities, thresholds, risk bands, and INR currency
 */
import { getRiskBandInfo } from "../constants/risk";

export function formatProbability(p) {
  if (p === null || p === undefined || isNaN(Number(p))) {
    return "N/A";
  }
  const num = Number(p);
  const percent = num <= 1.0 ? num * 100 : num;
  return `${percent.toFixed(1)}%`;
}

export function formatThreshold(t) {
  if (t === null || t === undefined || isNaN(Number(t))) {
    return "N/A";
  }
  const num = Number(t);
  const percent = num <= 1.0 ? num * 100 : num;
  return `${percent.toFixed(2)}%`;
}

export function formatBand(key) {
  if (!key) return "N/A";
  const info = getRiskBandInfo(key);
  return info.label;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatMoney(value) {
  if (value === null || value === undefined || value === "" || isNaN(Number(value))) {
    return "N/A";
  }
  return inrFormatter.format(Number(value));
}

// Keep formatCurrency as alias for backward safety if needed
export function formatCurrency(amount) {
  return formatMoney(amount);
}

export function isSensitiveField(sourceField, featureName = "") {
  if (!sourceField && !featureName) return false;
  const s = String(sourceField || "").toLowerCase();
  const f = String(featureName || "").toLowerCase();
  return (
    s === "gender" ||
    s === "code_gender" ||
    s === "age_years" ||
    s === "days_birth" ||
    f.includes("gender") ||
    f.includes("age_years") ||
    f.includes("days_birth")
  );
}

export function getFactorStrength(absShap, maxAbsShap) {
  if (!maxAbsShap || maxAbsShap <= 0) return "Slight";
  const ratio = absShap / maxAbsShap;
  if (ratio >= 0.66) return "Strong";
  if (ratio >= 0.33) return "Moderate";
  return "Slight";
}
