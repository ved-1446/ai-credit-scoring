import React, { useState, useEffect } from "react";
import { api } from "../api";
import { RiskBadge } from "../components/RiskBadge";
import { formatProbability, formatMoney } from "../utils/format";
import { RiskScale } from "../components/result/RiskScale";
import { FactorChart } from "../components/result/FactorChart";
import { ExplanationPanel } from "../components/result/ExplanationPanel";
import { LAB_SAVING_NOTICE } from "../constants/text";
import { 
  FlaskConical, 
  Play, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  Clock, 
  Info,
  AlertCircle
} from "lucide-react";

import { SAMPLE_PROFILES } from "../constants/samples";

import { PageHeader } from "../components/PageHeader";

export function AdminLab() {
  const [activeProfileKey, setActiveProfileKey] = useState("salaried");
  const [inputs, setInputs] = useState(SAMPLE_PROFILES.salaried.values);
  const [showAllValues, setShowAllValues] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);

  // In-memory list of last 5 runs
  const [recentRuns, setRecentRuns] = useState([]);

  // Load metrics for risk scale
  useEffect(() => {
    api.getMetrics().then(setMetrics).catch(() => null);
  }, []);

  // Handle profile switch
  const handleSelectProfile = (key) => {
    setActiveProfileKey(key);
    setInputs(SAMPLE_PROFILES[key].values);
  };

  const handleSliderChange = (field, val) => {
    setInputs((prev) => ({ ...prev, [field]: Number(val) }));
  };

  const handleRunScoring = async () => {
    setLoading(true);
    setError(null);

    try {
      // Admin consent: get consent or generate one
      let consentId = localStorage.getItem("consent_id");
      if (!consentId) {
        const consentData = await api.consent({ policy_version: "v1", accepted: true });
        consentId = consentData.consent_id;
        localStorage.setItem("consent_id", consentId);
      }

      const cleanInputs = {
        age_years: Number(inputs.age_years),
        gender: inputs.gender,
        amt_income_total: Number(inputs.amt_income_total),
        amt_credit: Number(inputs.amt_credit),
        amt_annuity: Number(inputs.amt_annuity),
        amt_goods_price: inputs.amt_goods_price ? Number(inputs.amt_goods_price) : null,
        years_employed: inputs.years_employed !== "" && inputs.years_employed !== null ? Number(inputs.years_employed) : null,
        name_contract_type: inputs.name_contract_type,
        name_income_type: inputs.name_income_type,
        name_education_type: inputs.name_education_type,
        name_family_status: inputs.name_family_status,
        name_housing_type: inputs.name_housing_type,
        organization_type: inputs.organization_type,
        occupation_type: inputs.occupation_type || null,
        name_type_suite: inputs.name_type_suite || null,
        flag_own_car: Boolean(inputs.flag_own_car),
        flag_own_realty: Boolean(inputs.flag_own_realty),
        cnt_children: Number(inputs.cnt_children),
        cnt_fam_members: Number(inputs.cnt_fam_members),
        region_rating_client: inputs.region_rating_client ? Number(inputs.region_rating_client) : null,
        ext_source_1: inputs.ext_source_1 !== "" && inputs.ext_source_1 !== null ? Number(inputs.ext_source_1) : null,
        ext_source_2: inputs.ext_source_2 !== "" && inputs.ext_source_2 !== null ? Number(inputs.ext_source_2) : null,
        ext_source_3: inputs.ext_source_3 !== "" && inputs.ext_source_3 !== null ? Number(inputs.ext_source_3) : null,
        amt_req_credit_bureau_year: inputs.amt_req_credit_bureau_year !== "" && inputs.amt_req_credit_bureau_year !== null ? Number(inputs.amt_req_credit_bureau_year) : null,
        emergency_state_mode: inputs.emergency_state_mode || null,
      };

      const res = await api.predict({
        consent_id: consentId,
        inputs: cleanInputs,
      });

      setResult(res);

      // Add to recent runs (keep max 5)
      const newRun = {
        id: res.request_id,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        probability: res.probability_of_default,
        band: res.risk_band,
        flagged: res.flagged_high_risk,
        inputsSnapshot: { ...inputs },
      };

      setRecentRuns((prev) => [newRun, ...prev].slice(0, 5));
    } catch (err) {
      setError(err.message || "Failed to execute scoring simulation in lab.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreRun = (run) => {
    setInputs(run.inputsSnapshot);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-28">
      {/* Header */}
      <PageHeader
        title="Interactive Model Test Lab"
        description="Evaluate arbitrary borrower profiles and test model sensitivity across continuous parameters."
      />

      {/* Mandatory Saving Notice Banner */}
      <div className="p-3.5 bg-surface border border-theme rounded-xl text-xs text-theme-muted flex items-start space-x-2.5">
        <Info className="h-4 w-4 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">{LAB_SAVING_NOTICE}</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Two-Column Layout on Wide Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sample Profiles + Sliders + Run Button */}
        <div className="lg:col-span-5 space-y-5">
          {/* Profile Selector */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
            <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider block">
              Choose Sample Profile
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(SAMPLE_PROFILES).map(([key, profile]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectProfile(key)}
                  className={`p-2 rounded-lg text-left transition-all text-xs border ${
                    activeProfileKey === key
                      ? "bg-brand-600 text-white border-brand-500 font-semibold shadow-sm"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  <p className="font-medium truncate">{profile.name}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 italic leading-tight">
              {SAMPLE_PROFILES[activeProfileKey].desc}
            </p>
          </div>

          {/* Sliders & Number Inputs for Key Fields */}
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-700/60 text-xs font-semibold text-slate-200">
              <Sliders className="h-4 w-4 text-brand-400" />
              <span>Key Parameters Tuning</span>
            </div>

            {/* Income */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Annual Income:</span>
                <span className="font-mono text-slate-100 font-semibold">{formatMoney(inputs.amt_income_total)}</span>
              </div>
              <input
                type="range"
                min="20000"
                max="1000000"
                step="10000"
                value={inputs.amt_income_total}
                onChange={(e) => handleSliderChange("amt_income_total", e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Credit Amount */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Credit Amount:</span>
                <span className="font-mono text-slate-100 font-semibold">{formatMoney(inputs.amt_credit)}</span>
              </div>
              <input
                type="range"
                min="40000"
                max="2000000"
                step="10000"
                value={inputs.amt_credit}
                onChange={(e) => handleSliderChange("amt_credit", e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Annuity */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Annuity Payment:</span>
                <span className="font-mono text-slate-100 font-semibold">{formatMoney(inputs.amt_annuity)}</span>
              </div>
              <input
                type="range"
                min="2000"
                max="100000"
                step="1000"
                value={inputs.amt_annuity}
                onChange={(e) => handleSliderChange("amt_annuity", e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Age */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Age (Years):</span>
                <span className="font-mono text-slate-100 font-semibold">{inputs.age_years} yrs</span>
              </div>
              <input
                type="range"
                min="18"
                max="75"
                step="1"
                value={inputs.age_years}
                onChange={(e) => handleSliderChange("age_years", e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Years Employed */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Years Employed:</span>
                <span className="font-mono text-slate-100 font-semibold">{inputs.years_employed ?? 0} yrs</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                step="0.5"
                value={inputs.years_employed ?? 0}
                onChange={(e) => handleSliderChange("years_employed", e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* External Score 2 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>External Score 2 (EXT_SOURCE_2):</span>
                <span className="font-mono text-slate-100 font-semibold">{inputs.ext_source_2 ?? "N/A"}</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.99"
                step="0.01"
                value={inputs.ext_source_2 ?? 0.5}
                onChange={(e) => handleSliderChange("ext_source_2", e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* External Score 3 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>External Score 3 (EXT_SOURCE_3):</span>
                <span className="font-mono text-slate-100 font-semibold">{inputs.ext_source_3 ?? "N/A"}</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.99"
                step="0.01"
                value={inputs.ext_source_3 ?? 0.5}
                onChange={(e) => handleSliderChange("ext_source_3", e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Collapsed All Values Table */}
            <div className="pt-2 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => setShowAllValues(!showAllValues)}
                className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-200 py-1"
              >
                <span>All profile inputs ({Object.keys(inputs).length} fields)</span>
                {showAllValues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showAllValues && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/60 p-2.5 text-[11px] font-mono">
                  <table className="w-full text-left">
                    <tbody>
                      {Object.entries(inputs).map(([k, v]) => (
                        <tr key={k} className="border-b border-slate-800/50">
                          <td className="text-slate-400 py-0.5">{k}:</td>
                          <td className="text-slate-200 text-right py-0.5">{String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Run Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunScoring}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-lg shadow-brand-600/20"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Running Inference...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    <span>Run scoring</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recent Runs Table (last 5 in-memory) */}
          {recentRuns.length > 0 && (
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-semibold pb-1 border-b border-slate-700/60">
                <span className="flex items-center space-x-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Recent Lab Runs (Last 5)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Click to restore</span>
              </div>
              <div className="space-y-1.5">
                {recentRuns.map((run, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleRestoreRun(run)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-400">{run.time}</span>
                      <span className="font-mono font-bold text-slate-100">{formatProbability(run.probability)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RiskBadge band={run.band} />
                      <RotateCcw className="h-3 w-3 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Scoring Results */}
        <div className="lg:col-span-7 space-y-5">
          {!result ? (
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700/60 p-12 text-center space-y-3">
              <FlaskConical className="h-8 w-8 text-brand-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-100 font-display">Ready for Test Scoring</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Adjust the profile parameters on the left and click <strong>"Run scoring"</strong> to compute real-time default risk, SHAP factors, and AI explanation.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Verdict Summary Card */}
              <div className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                      Estimated Default Risk
                    </span>
                    <div className="text-3xl font-bold font-mono text-slate-50 mt-1">
                      {formatProbability(result.probability_of_default)}
                    </div>
                  </div>
                  <div>
                    <RiskBadge band={result.risk_band} size="lg" />
                  </div>
                </div>

                {/* Risk Scale */}
                {metrics && (
                  <div className="pt-2">
                    <RiskScale
                      probability={result.probability_of_default}
                      decisionThreshold={result.decision_threshold}
                      metrics={metrics}
                    />
                  </div>
                )}
              </div>

              {/* Factor Chart */}
              <FactorChart factors={result.explanation?.top_factors || []} />

              {/* Explanation Panel */}
              <ExplanationPanel
                predictionId={result.request_id}
                fallbackHeadline={`Application assessed as ${result.risk_band} risk.`}
                topFactors={result.explanation?.top_factors || []}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
