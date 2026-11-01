import { useState, useEffect } from "react";

function readRgbVar(varName, fallback = "0, 0, 0") {
  if (typeof window === "undefined") return `rgb(${fallback})`;
  const style = getComputedStyle(document.documentElement);
  const val = style.getPropertyValue(varName).trim();
  return val ? `rgb(${val})` : `rgb(${fallback})`;
}

function getThemeColors() {
  return {
    text: readRgbVar("--slate-100", "233, 235, 228"),
    mutedText: readRgbVar("--slate-400", "150, 157, 150"),
    grid: readRgbVar("--slate-700", "44, 49, 45"),
    axis: readRgbVar("--slate-500", "107, 114, 108"),
    tooltipBg: readRgbVar("--slate-800", "31, 35, 32"),
    tooltipBorder: readRgbVar("--slate-700", "44, 49, 45"),
    tooltipText: readRgbVar("--slate-100", "233, 235, 228"),
    riskLow: readRgbVar("--risk-low-fill", "74, 197, 142"),
    riskMedium: readRgbVar("--risk-medium-fill", "230, 190, 70"),
    riskHigh: readRgbVar("--risk-high-fill", "240, 140, 70"),
    riskVeryHigh: readRgbVar("--risk-very-high-fill", "235, 90, 100"),
    riskLowText: readRgbVar("--risk-low", "74, 222, 128"),
    riskMediumText: readRgbVar("--risk-medium", "250, 204, 21"),
    riskHighText: readRgbVar("--risk-high", "251, 146, 60"),
    riskVeryHighText: readRgbVar("--risk-very-high", "248, 113, 113"),
    riskLowFill: readRgbVar("--risk-low-fill", "74, 197, 142"),
    riskMediumFill: readRgbVar("--risk-medium-fill", "230, 190, 70"),
    riskHighFill: readRgbVar("--risk-high-fill", "240, 140, 70"),
    riskVeryHighFill: readRgbVar("--risk-very-high-fill", "235, 90, 100"),
    up: readRgbVar("--chart-up", "232, 118, 100"),
    down: readRgbVar("--chart-down", "70, 182, 160"),
    neutral: readRgbVar("--chart-neutral", "140, 146, 140"),
    accent: readRgbVar("--accent", "224, 138, 102"),
    brand: readRgbVar("--brand-500", "45, 170, 152"),
  };
}

export function useChartTheme() {
  const [colors, setColors] = useState(getThemeColors);

  useEffect(() => {
    const updateColors = () => {
      setColors(getThemeColors());
    };

    updateColors();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-theme") {
          updateColors();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}
