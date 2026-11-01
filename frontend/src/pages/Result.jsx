import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { RiskBadge } from "../components/RiskBadge";
import { formatProbability, formatThreshold, formatMoney } from "../utils/format";
import { RISK_BAND_DESCRIPTIONS, VALIDATION_BAND_DEFAULT_RATES } from "../constants/text";
import { RiskScale } from "../components/result/RiskScale";
import { ExplanationPanel } from "../components/result/ExplanationPanel";
import { FactorChart } from "../components/result/FactorChart";
import { OtherFactorsPie } from "../components/result/OtherFactorsPie";
import { StateView } from "../components/StateView";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import jsPDF from "jspdf";
import { 
  Download, 
  RefreshCw, 
  ArrowLeft, 
  Sliders, 
  AlertCircle,
  Clock,
  Plus
} from "lucide-react";

function useCountUp(targetVal, durationMs = 700) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (typeof targetVal !== "number" || isNaN(targetVal) || targetVal === 0) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setVal(targetVal);
      return;
    }

    let start = null;
    let frameId;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / durationMs, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setVal(targetVal * easeProgress);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setVal(targetVal);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [targetVal, durationMs]);

  return typeof targetVal !== "number" || isNaN(targetVal) ? 0 : val;
}

export function Result() {
  const { id } = useParams();
  useDocumentTitle(id ? `Evaluation ${id.slice(0, 8)}` : "Evaluation Result");

  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const displayProb = useCountUp(data?.probability_of_default ?? 0, 700);

  // What-if state
  const [whatIfInputs, setWhatIfInputs] = useState({
    amt_credit: "",
    amt_annuity: "",
    amt_income_total: "",
    amt_goods_price: "",
    years_employed: "",
  });
  const [whatIfResult, setWhatIfResult] = useState(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfError, setWhatIfError] = useState(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, metricsRes] = await Promise.all([
        api.getHistoryItem(id),
        api.getMetrics().catch(() => null),
      ]);
      setData(res);
      setMetrics(metricsRes);

      // Prepopulate what-if form with baseline values if present
      if (res?.inputs_used) {
        setWhatIfInputs({
          amt_credit: res.inputs_used.amt_credit ?? "",
          amt_annuity: res.inputs_used.amt_annuity ?? "",
          amt_income_total: res.inputs_used.amt_income_total ?? "",
          amt_goods_price: res.inputs_used.amt_goods_price ?? "",
          years_employed: res.inputs_used.years_employed ?? "",
        });
      }
    } catch (err) {
      setError(err?.message || "Failed to load evaluation result.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWhatIfSubmit = async (e) => {
    e.preventDefault();
    setWhatIfLoading(true);
    setWhatIfError(null);

    const changes = {};
    if (whatIfInputs.amt_credit !== "") changes.amt_credit = Number(whatIfInputs.amt_credit);
    if (whatIfInputs.amt_annuity !== "") changes.amt_annuity = Number(whatIfInputs.amt_annuity);
    if (whatIfInputs.amt_income_total !== "") changes.amt_income_total = Number(whatIfInputs.amt_income_total);
    if (whatIfInputs.amt_goods_price !== "") {
      changes.amt_goods_price = Number(whatIfInputs.amt_goods_price);
    }
    if (whatIfInputs.years_employed !== "") {
      changes.years_employed = Number(whatIfInputs.years_employed);
    }

    try {
      const res = await api.whatif({
        request_id: id,
        changes,
      });
      setWhatIfResult(res);
    } catch (err) {
      setWhatIfError(err?.message || "What-if simulation failed.");
    } finally {
      setWhatIfLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!data) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("DATA DYNAMO — Credit Risk Assessment", 14, 20);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184); // slate-400
      const dateStr = data.created_at ? new Date(data.created_at).toLocaleString() : "N/A";
      doc.text(`Model Version: ${data.model_version || "1.0"}  |  Generated: ${dateStr}`, 14, 28);

      // Body Summary
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Assessment Summary", 14, 48);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Request ID: ${data.request_id || "N/A"}`, 14, 56);
      doc.text(`Risk Level: ${data.risk_band || "N/A"}`, 14, 63);
      doc.text(`Risk Score: ${formatProbability(data.probability_of_default)}`, 14, 70);
      doc.text(`Review Cut-off: ${formatThreshold(data.decision_threshold)}`, 14, 77);
      doc.text(
        `Status: ${data.flagged_high_risk ? "Flagged for Closer Review" : "Standard Review"}`,
        14,
        84
      );

      // Factors Table (plain terms without SHAP)
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Key Risk Factors", 14, 100);

      let y = 110;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Factor", 14, y);
      doc.text("Observed Value", 110, y);
      doc.text("Impact Score", 150, y);
      doc.text("Direction", 175, y);

      doc.setDrawColor(203, 213, 225);
      doc.line(14, y + 2, pageWidth - 14, y + 2);
      y += 8;

      doc.setFont("helvetica", "normal");
      const factors = data.explanation?.top_factors || [];
      factors.forEach((f) => {
        const name = (f.display_name || f.feature || "Factor").substring(0, 48);
        doc.text(name, 14, y);
        const valStr = ["amt_credit", "amt_income_total", "amt_annuity", "amt_goods_price"].includes(f.source_field || f.feature) && typeof f.value === "number"
          ? formatMoney(f.value)
          : String(f.value ?? "N/A");
        doc.text(valStr, 110, y);
        doc.text(typeof f.shap_value === "number" ? f.shap_value.toFixed(4) : "0.0000", 150, y);
        doc.text(f.direction === "increases_risk" ? "+ Risk" : "- Risk", 175, y);
        y += 7;
      });

      // Warnings
      if (data.warnings && data.warnings.length > 0) {
        y += 8;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Data Notices & Warnings", 14, y);
        y += 6;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        data.warnings.forEach((w) => {
          doc.text(`• ${w}`, 16, y);
          y += 5.5;
        });
      }

      // Disclaimer footer
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Notice: Educational demo, not for real lending decisions.",
        14,
        280
      );
      doc.text(`Page 1 of 1`, pageWidth - 30, 280);

      const fileId = data.request_id ? data.request_id.slice(0, 8) : "record";
      doc.save(`credit_risk_report_${fileId}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 pb-32">
        <StateView state="loading" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 pb-32 text-center space-y-4">
        <StateView
          state="error"
          title="Result Not Found"
          description={error || "The requested prediction record could not be found or you do not have permission to view it."}
          onRetry={loadData}
          action={
            <div className="flex items-center gap-3">
              <Link
                to="/history"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-theme-primary border border-theme text-xs font-medium rounded-xl transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Go to History</span>
              </Link>
              <Link
                to="/apply"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Assessment</span>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const bandDescription = RISK_BAND_DESCRIPTIONS[data.risk_band] || "";
  const allFactors = Array.isArray(data.explanation?.top_factors) ? data.explanation.top_factors : [];
  const primaryFactors = allFactors.slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 pb-32 space-y-10">
      {/* 1. Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-theme">
        <div>
          <div className="flex items-center space-x-3">
            <Link to="/history" className="text-theme-muted hover:text-theme-primary p-1 rounded-lg hover:bg-surface-hover transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-display font-normal text-theme-primary tracking-tight">
              Evaluation Report
            </h1>
          </div>
          <p className="text-xs text-theme-muted mt-1 pl-7 flex items-center space-x-2 font-mono">
            <span>ID: <code className="text-theme-primary">{data.request_id}</code></span>
            <span>•</span>
            <Clock className="h-3 w-3 inline" />
            <span>{data.created_at ? new Date(data.created_at).toLocaleString() : "—"}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadPDF}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-surface-hover hover:bg-surface-active text-theme-primary rounded-xl border border-theme font-medium text-xs transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-brand-400" />
          <span>Download PDF Report</span>
        </button>
      </div>

      {/* 2. Verdict Card */}
      <div className="bg-surface rounded-2xl border border-theme p-6 space-y-6 shadow-sm">
        <div className="space-y-3">
          <span className="text-[11px] font-mono uppercase tracking-widest text-theme-muted">
            Risk Score
          </span>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="text-4xl sm:text-5xl font-mono font-bold text-theme-primary tracking-tight">
              {formatProbability(displayProb)}
            </span>
            <RiskBadge band={data.risk_band} className="text-xs px-3 py-1" />
          </div>

          <p className="text-xs text-theme-secondary max-w-2xl leading-relaxed">
            This is a risk score from the model, not an exact chance that you will default. In our sample data, about {(() => {
              const userBandKey = (data?.risk_band || "").toUpperCase();
              const matchedBand = (metrics?.risk_bands || []).find(
                (b) => (b.band || "").toUpperCase() === userBandKey
              );
              return matchedBand?.val_default_rate != null
                ? `${(matchedBand.val_default_rate * 100).toFixed(2)}%`
                : (VALIDATION_BAND_DEFAULT_RATES[userBandKey] || "—");
            })()} of people in this group did not repay.
          </p>

          {bandDescription && (
            <p className="text-xs text-theme-secondary max-w-2xl leading-relaxed">
              {bandDescription}
            </p>
          )}
        </div>

        {/* RiskScale Component */}
        {metrics?.risk_bands && (
          <RiskScale
            probability={data.probability_of_default}
            threshold={data.decision_threshold}
            riskBands={metrics.risk_bands}
          />
        )}
      </div>

      {/* 3. Explanation Panel */}
      <ExplanationPanel
        predictionId={data.request_id}
        fallbackHeadline={`Risk score: ${formatProbability(data.probability_of_default)}`}
      />

      {/* 4. Factor Ladder (Top 5 factors) */}
      <FactorChart factors={primaryFactors} />

      {/* 5. Secondary Factors Donut */}
      <OtherFactorsPie factors={allFactors} />

      {/* 6. Data Notes & Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <section className="p-4 rounded-xl bg-surface border border-theme space-y-2 text-xs">
          <div className="flex items-center space-x-2 text-amber-400 font-semibold">
            <AlertCircle className="h-4 w-4" />
            <span>Data Notices</span>
          </div>
          <ul className="space-y-1 list-disc list-inside text-theme-secondary">
            {data.warnings.map((w, idx) => (
              <li key={`warn-${idx}`}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 7. What-If Simulation */}
      <section className="bg-surface rounded-2xl border border-theme p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-theme">
          <Sliders className="h-4 w-4 text-brand-400" />
          <div>
            <h2 className="text-base font-semibold text-theme-primary font-display">Interactive What-If Simulation</h2>
            <p className="text-xs text-theme-muted mt-0.5">
              Adjust loan conditions or income to simulate how adjustments change your estimated default risk (simulations are not saved).
            </p>
          </div>
        </div>

        {whatIfError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span>{whatIfError}</span>
          </div>
        )}

        <form onSubmit={handleWhatIfSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div>
              <label className="block text-xs text-theme-secondary mb-1 font-mono">Loan Amount (₹)</label>
              <input
                type="number"
                value={whatIfInputs.amt_credit}
                onChange={(e) => setWhatIfInputs({ ...whatIfInputs, amt_credit: e.target.value })}
                className="w-full px-3 py-1.5 bg-surface-hover border border-theme rounded-lg text-theme-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-theme-secondary mb-1 font-mono">Annual Repayment (₹)</label>
              <input
                type="number"
                value={whatIfInputs.amt_annuity}
                onChange={(e) => setWhatIfInputs({ ...whatIfInputs, amt_annuity: e.target.value })}
                className="w-full px-3 py-1.5 bg-surface-hover border border-theme rounded-lg text-theme-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-theme-secondary mb-1 font-mono">Annual Income (₹)</label>
              <input
                type="number"
                value={whatIfInputs.amt_income_total}
                onChange={(e) => setWhatIfInputs({ ...whatIfInputs, amt_income_total: e.target.value })}
                className="w-full px-3 py-1.5 bg-surface-hover border border-theme rounded-lg text-theme-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-theme-secondary mb-1 font-mono">Goods Price (₹)</label>
              <input
                type="number"
                value={whatIfInputs.amt_goods_price}
                onChange={(e) => setWhatIfInputs({ ...whatIfInputs, amt_goods_price: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-1.5 bg-surface-hover border border-theme rounded-lg text-theme-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-theme-secondary mb-1 font-mono">Years Employed</label>
              <input
                type="number"
                value={whatIfInputs.years_employed}
                onChange={(e) => setWhatIfInputs({ ...whatIfInputs, years_employed: e.target.value })}
                step="0.5"
                placeholder="Optional"
                className="w-full px-3 py-1.5 bg-surface-hover border border-theme rounded-lg text-theme-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={whatIfLoading}
              className="flex items-center space-x-2 py-2 px-5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              {whatIfLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Recalculate Simulation</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Simulation Output Card */}
        {whatIfResult && (
          <div className="mt-4 p-4 rounded-xl bg-surface-hover border border-theme space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-brand-400 uppercase font-mono tracking-wider">
                Simulation Outcome
              </span>
              <span className="text-theme-muted font-mono">
                Baseline: {formatProbability(whatIfResult.baseline?.probability_of_default)} ({whatIfResult.baseline?.risk_band})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-surface p-3 rounded-xl border border-theme">
                <span className="text-[11px] text-theme-muted font-mono uppercase">New Estimated Risk</span>
                <p className="text-2xl font-bold font-mono text-theme-primary mt-1">
                  {formatProbability(whatIfResult.probability_of_default)}
                </p>
                <div className="mt-1">
                  <RiskBadge band={whatIfResult.risk_band} />
                </div>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-theme">
                <span className="text-[11px] text-theme-muted font-mono uppercase">Delta Risk</span>
                <p
                  className={`text-2xl font-bold font-mono mt-1 ${
                    whatIfResult.delta_probability < 0
                      ? "text-emerald-400"
                      : whatIfResult.delta_probability > 0
                      ? "text-rose-400"
                      : "text-theme-secondary"
                  }`}
                >
                  {whatIfResult.delta_probability > 0 ? "+" : ""}
                  {(whatIfResult.delta_probability * 100).toFixed(2)}%
                </p>
                <p className="text-[10px] text-theme-muted mt-1">
                  {whatIfResult.delta_probability < 0
                    ? "Risk reduced from baseline"
                    : whatIfResult.delta_probability > 0
                    ? "Risk increased from baseline"
                    : "No net risk change"}
                </p>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-theme">
                <span className="text-[11px] text-theme-muted font-mono uppercase">Review Status</span>
                <p className="text-sm font-semibold text-theme-primary mt-1">
                  {whatIfResult.flagged_high_risk ? "Flagged for Review" : "Standard Review"}
                </p>
                <p className="text-[10px] text-theme-muted mt-1 font-mono">
                  Cut-off: {formatThreshold(whatIfResult.decision_threshold)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
