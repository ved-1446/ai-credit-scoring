import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useChat } from "../context/useChat";
import { SAMPLE_PROFILES } from "../constants/samples";
import { 
  GENDER_OPTIONS, 
  NAME_CONTRACT_TYPE_OPTIONS, 
  NAME_INCOME_TYPE_OPTIONS, 
  NAME_EDUCATION_TYPE_OPTIONS, 
  NAME_FAMILY_STATUS_OPTIONS, 
  NAME_HOUSING_TYPE_OPTIONS, 
  OCCUPATION_TYPE_OPTIONS, 
  ORGANIZATION_TYPE_OPTIONS, 
  NAME_TYPE_SUITE_OPTIONS, 
  EMERGENCY_STATE_MODE_OPTIONS 
} from "../constants/enums";
import { 
  User, 
  Briefcase, 
  Home, 
  TrendingUp, 
  Sliders, 
  AlertCircle, 
  ArrowRight,
  Info,
  HelpCircle,
  CheckCircle2
} from "lucide-react";

export function Apply() {
  const navigate = useNavigate();
  const { openChat } = useChat();

  // Load consent_id from localStorage
  const [consentId] = useState(() => localStorage.getItem("consent_id"));

  const [formData, setFormData] = useState({
    // About you
    age_years: 34,
    gender: "F",
    name_family_status: "Married",
    cnt_children: 1,
    cnt_fam_members: 3,

    // Money
    amt_income_total: 180000,
    amt_credit: 450000,
    amt_annuity: 22500,
    amt_goods_price: 450000,

    // Work
    years_employed: 6.5,
    name_contract_type: "Cash loans",
    name_income_type: "Working",
    name_education_type: "Higher education",
    organization_type: "Services",
    occupation_type: "Core staff",

    // Home and family
    name_housing_type: "House / apartment",
    name_type_suite: "Unaccompanied",
    flag_own_car: false,
    flag_own_realty: true,
    region_rating_client: 2,

    // Credit scores
    ext_source_1: "",
    ext_source_2: 0.58,
    ext_source_3: 0.42,
    amt_req_credit_bureau_year: 1,

    // Extra
    emergency_state_mode: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (!consentId) {
      navigate("/consent", { replace: true });
    }
  }, [consentId, navigate]);

  // Count required fields filled (12 required fields)
  const REQUIRED_FIELDS = [
    "age_years",
    "gender",
    "amt_income_total",
    "amt_credit",
    "amt_annuity",
    "name_contract_type",
    "name_income_type",
    "name_education_type",
    "name_family_status",
    "name_housing_type",
    "organization_type",
    "cnt_fam_members",
  ];

  const filledCount = REQUIRED_FIELDS.filter((f) => {
    const val = formData[f];
    return val !== "" && val !== null && val !== undefined;
  }).length;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errs = {};

    // Age
    const age = Number(formData.age_years);
    if (!formData.age_years || isNaN(age) || age < 18 || age > 75) {
      errs.age_years = "Age must be between 18 and 75.";
    }

    // Money
    if (!formData.amt_income_total || Number(formData.amt_income_total) <= 0) {
      errs.amt_income_total = "Annual income must be greater than 0.";
    }
    if (!formData.amt_credit || Number(formData.amt_credit) <= 0) {
      errs.amt_credit = "Loan amount must be greater than 0.";
    }
    if (!formData.amt_annuity || Number(formData.amt_annuity) <= 0) {
      errs.amt_annuity = "Annuity repayment must be greater than 0.";
    }
    if (formData.amt_goods_price !== "" && Number(formData.amt_goods_price) <= 0) {
      errs.amt_goods_price = "Goods price must be greater than 0.";
    }

    // Employment
    if (formData.years_employed !== "" && Number(formData.years_employed) < 0) {
      errs.years_employed = "Years employed cannot be negative.";
    }

    // Family
    const children = Number(formData.cnt_children);
    const members = Number(formData.cnt_fam_members);
    if (isNaN(children) || children < 0 || children > 20) {
      errs.cnt_children = "Children count must be 0–20.";
    }
    if (isNaN(members) || members < 1 || members > 21) {
      errs.cnt_fam_members = "Family members must be 1–21.";
    }
    if (members < children + 1) {
      errs.cnt_fam_members = `Family members (${members}) must be at least children count (${children}) + 1.`;
    }

    // External scores (0 - 1)
    ["ext_source_1", "ext_source_2", "ext_source_3"].forEach((field) => {
      const val = formData[field];
      if (val !== "" && val !== null && val !== undefined) {
        const num = Number(val);
        if (isNaN(num) || num < 0 || num > 1) {
          errs[field] = "Score must be a decimal between 0.0 and 1.0.";
        }
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);

    try {
      const cleanInputs = {
        age_years: Number(formData.age_years),
        gender: formData.gender,
        amt_income_total: Number(formData.amt_income_total),
        amt_credit: Number(formData.amt_credit),
        amt_annuity: Number(formData.amt_annuity),
        amt_goods_price: formData.amt_goods_price !== "" ? Number(formData.amt_goods_price) : null,
        years_employed: formData.years_employed !== "" ? Number(formData.years_employed) : null,
        name_contract_type: formData.name_contract_type,
        name_income_type: formData.name_income_type,
        name_education_type: formData.name_education_type,
        name_family_status: formData.name_family_status,
        name_housing_type: formData.name_housing_type,
        organization_type: formData.organization_type,
        occupation_type: formData.occupation_type || null,
        name_type_suite: formData.name_type_suite || null,
        flag_own_car: Boolean(formData.flag_own_car),
        flag_own_realty: Boolean(formData.flag_own_realty),
        cnt_children: Number(formData.cnt_children),
        cnt_fam_members: Number(formData.cnt_fam_members),
        region_rating_client: formData.region_rating_client ? Number(formData.region_rating_client) : null,
        ext_source_1: formData.ext_source_1 !== "" ? Number(formData.ext_source_1) : null,
        ext_source_2: formData.ext_source_2 !== "" ? Number(formData.ext_source_2) : null,
        ext_source_3: formData.ext_source_3 !== "" ? Number(formData.ext_source_3) : null,
        amt_req_credit_bureau_year: formData.amt_req_credit_bureau_year !== "" ? Number(formData.amt_req_credit_bureau_year) : null,
        emergency_state_mode: formData.emergency_state_mode || null,
      };

      const result = await api.predict({
        consent_id: consentId,
        inputs: cleanInputs,
      }, 10);

      navigate(`/result/${result.request_id}`);
    } catch (err) {
      if (err.code === "CONSENT_REQUIRED") {
        localStorage.removeItem("consent_id");
        navigate("/consent");
      } else {
        setServerError(err.message || "Prediction request failed.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setLoading(false);
    }
  };

  const [sampleNotice, setSampleNotice] = useState(false);

  const handleFillSample = (profileKey) => {
    if (SAMPLE_PROFILES[profileKey]) {
      setFormData({ ...SAMPLE_PROFILES[profileKey].values });
      setErrors({});
      setSampleNotice(true);
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    }
  };

  const handleFormKeyDown = (e) => {
    // Only intercept when key is Enter
    if (e.key !== "Enter") return;

    const target = e.target;
    // Keep standard Enter behavior for buttons and textarea
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") {
      return;
    }

    // Prevent default submission
    e.preventDefault();

    const form = target.form;
    if (!form) return;

    // Get all valid focusable fields in DOM order (inputs, selects, submit button)
    const elements = Array.from(
      form.querySelectorAll("input:not([disabled]):not([type=hidden]):not([readonly]), select:not([disabled]):not([readonly]), button[type=submit]:not([disabled])")
    );

    const currentIndex = elements.indexOf(target);
    if (currentIndex === -1) return;

    if (e.shiftKey) {
      // Shift+Enter: move to previous field
      if (currentIndex > 0) {
        const prevElement = elements[currentIndex - 1];
        prevElement.focus();
        // Check if previous element is in another section
        const parentSection = prevElement.closest("section");
        if (parentSection && parentSection.id) {
          scrollToSection(parentSection.id);
        }
      }
    } else {
      // Enter: move to next field
      if (currentIndex < elements.length - 1) {
        const nextElement = elements[currentIndex + 1];
        nextElement.focus();
        
        // If the next element is inside a new category section, scroll it into view
        const currentSection = target.closest("section");
        const nextSection = nextElement.closest("section");
        if (nextSection && currentSection !== nextSection && nextSection.id) {
          scrollToSection(nextSection.id);
        }
      } else {
        // Last element: focus submit button
        const submitBtn = form.querySelector("button[type=submit]");
        if (submitBtn) {
          submitBtn.focus();
        }
      }
    }
  };

  const handleAskSection = (sectionTitle, topicId) => {
    openChat({
      question: `What should I know about the ${sectionTitle} section?`,
      topic: topicId,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-28">
      {/* Sticky Progress & Section Navigation Bar */}
      <div className="sticky top-16 z-30 bg-surface border border-theme rounded-xl p-3 mb-6 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 text-brand-400" />
          <span className="font-medium text-theme-primary">
            <strong className="text-brand-300 font-mono">{filledCount}</strong> of{" "}
            <span className="font-mono text-theme-muted">{REQUIRED_FIELDS.length}</span> required fields filled
          </span>
        </div>

        {/* Section Jump Links */}
        <div className="flex items-center space-x-1 sm:space-x-2 text-[11px] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => scrollToSection("sec-about")}
            className="px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-theme-secondary hover:text-theme-primary transition-colors"
          >
            1. About You
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("sec-financial")}
            className="px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-theme-secondary hover:text-theme-primary transition-colors"
          >
            2. Financial
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("sec-work")}
            className="px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-theme-secondary hover:text-theme-primary transition-colors"
          >
            3. Employment
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("sec-home")}
            className="px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-theme-secondary hover:text-theme-primary transition-colors"
          >
            4. Home &amp; Assets
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("sec-scores")}
            className="px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-theme-secondary hover:text-theme-primary transition-colors"
          >
            5. Scores
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-theme-primary tracking-tight font-display">Credit Application Evaluation</h1>
          <p className="text-sm text-theme-muted mt-1">
            Complete the borrower profile below to compute your estimated default risk, risk level, and main factors.
          </p>
        </div>

        {/* Sample Profile Selector */}
        <div className="flex flex-col items-start md:items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-theme-muted">Fill with a sample applicant:</span>
            <div className="inline-flex rounded-lg border border-theme bg-surface p-0.5">
              {Object.entries(SAMPLE_PROFILES).map(([key, prof]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleFillSample(key)}
                  className="px-2.5 py-1 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:bg-surface-hover rounded transition-colors"
                  title={prof.desc}
                >
                  {prof.name}
                </button>
              ))}
            </div>
          </div>
          {sampleNotice && (
            <p className="text-[11px] text-theme-muted italic">
              Sample values — change anything you like.
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Submission Error</p>
            <p className="text-xs text-rose-400/90 mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-8">
        <p className="text-xs text-slate-400">
          This is a demo. Please use made-up details, not your real personal or financial information.
        </p>

        {/* 1. About You */}
        <section id="sec-about" className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6 backdrop-blur-xl shadow-xl scroll-mt-36">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-3 text-brand-400">
              <User className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-slate-50 font-display">1. About You</h2>
            </div>
            <button
              type="button"
              onClick={() => handleAskSection("About You", "employment_and_age")}
              className="inline-flex items-center space-x-1.5 text-xs text-brand-400 hover:text-brand-300 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Ask about this section</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Age in Years <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                value={formData.age_years}
                onChange={(e) => handleChange("age_years", e.target.value)}
                min="18"
                max="75"
                className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.age_years ? "border-rose-500" : "border-slate-700"
                }`}
              />
              {errors.age_years && <p className="text-rose-400 text-xs mt-1">{errors.age_years}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Gender <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Family Status <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.name_family_status}
                onChange={(e) => handleChange("name_family_status", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {NAME_FAMILY_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Number of Children <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                value={formData.cnt_children}
                onChange={(e) => handleChange("cnt_children", e.target.value)}
                min="0"
                max="20"
                className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.cnt_children ? "border-rose-500" : "border-slate-700"
                }`}
              />
              {errors.cnt_children && <p className="text-rose-400 text-xs mt-1">{errors.cnt_children}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Total Family Members <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                value={formData.cnt_fam_members}
                onChange={(e) => handleChange("cnt_fam_members", e.target.value)}
                min="1"
                max="21"
                className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.cnt_fam_members ? "border-rose-500" : "border-slate-700"
                }`}
              />
              {errors.cnt_fam_members && <p className="text-rose-400 text-xs mt-1">{errors.cnt_fam_members}</p>}
            </div>
          </div>
        </section>

        {/* 2. Financial Information (Rupees) */}
        <section id="sec-financial" className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6 backdrop-blur-xl shadow-xl scroll-mt-36">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-3 text-brand-400">
              <TrendingUp className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-slate-50 font-display">2. Financial Information</h2>
            </div>
            <button
              type="button"
              onClick={() => handleAskSection("Financial Information", "income_and_loan")}
              className="inline-flex items-center space-x-1.5 text-xs text-brand-400 hover:text-brand-300 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Ask about this section</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-5 italic">
            Amounts are in Indian rupees (₹). They are used as entered, with no currency conversion.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Annual Income (Total) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">₹</span>
                <input
                  type="number"
                  value={formData.amt_income_total}
                  onChange={(e) => handleChange("amt_income_total", e.target.value)}
                  step="1000"
                  className={`w-full pl-8 pr-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.amt_income_total ? "border-rose-500" : "border-slate-700"
                  }`}
                />
              </div>
              {errors.amt_income_total && <p className="text-rose-400 text-xs mt-1">{errors.amt_income_total}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Requested Credit Amount <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">₹</span>
                <input
                  type="number"
                  value={formData.amt_credit}
                  onChange={(e) => handleChange("amt_credit", e.target.value)}
                  step="1000"
                  className={`w-full pl-8 pr-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.amt_credit ? "border-rose-500" : "border-slate-700"
                  }`}
                />
              </div>
              {errors.amt_credit && <p className="text-rose-400 text-xs mt-1">{errors.amt_credit}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Yearly Annuity Payment <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">₹</span>
                <input
                  type="number"
                  value={formData.amt_annuity}
                  onChange={(e) => handleChange("amt_annuity", e.target.value)}
                  step="500"
                  className={`w-full pl-8 pr-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.amt_annuity ? "border-rose-500" : "border-slate-700"
                  }`}
                />
              </div>
              {errors.amt_annuity && <p className="text-rose-400 text-xs mt-1">{errors.amt_annuity}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Goods Price (Optional)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">₹</span>
                <input
                  type="number"
                  value={formData.amt_goods_price}
                  onChange={(e) => handleChange("amt_goods_price", e.target.value)}
                  placeholder="Optional"
                  className={`w-full pl-8 pr-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.amt_goods_price ? "border-rose-500" : "border-slate-700"
                  }`}
                />
              </div>
              {errors.amt_goods_price && <p className="text-rose-400 text-xs mt-1">{errors.amt_goods_price}</p>}
            </div>
          </div>
        </section>

        {/* 3. Work */}
        <section id="sec-work" className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6 backdrop-blur-xl shadow-xl scroll-mt-36">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-3 text-brand-400">
              <Briefcase className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-slate-50 font-display">3. Employment & Education</h2>
            </div>
            <button
              type="button"
              onClick={() => handleAskSection("Employment and Education", "employment_and_age")}
              className="inline-flex items-center space-x-1.5 text-xs text-brand-400 hover:text-brand-300 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Ask about this section</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Years Employed (leave blank if unemployed/pensioner)
              </label>
              <input
                type="number"
                value={formData.years_employed}
                onChange={(e) => handleChange("years_employed", e.target.value)}
                step="0.5"
                min="0"
                placeholder="e.g. 6.5"
                className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.years_employed ? "border-rose-500" : "border-slate-700"
                }`}
              />
              {errors.years_employed && <p className="text-rose-400 text-xs mt-1">{errors.years_employed}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contract Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.name_contract_type}
                onChange={(e) => handleChange("name_contract_type", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {NAME_CONTRACT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Income Source Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.name_income_type}
                onChange={(e) => handleChange("name_income_type", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {NAME_INCOME_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Education Level <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.name_education_type}
                onChange={(e) => handleChange("name_education_type", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {NAME_EDUCATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Organization Industry Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.organization_type}
                onChange={(e) => handleChange("organization_type", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {ORGANIZATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Occupation Title (Optional)
              </label>
              <select
                value={formData.occupation_type}
                onChange={(e) => handleChange("occupation_type", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">(Not provided)</option>
                {OCCUPATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 4. Home and Family */}
        <section id="sec-home" className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6 backdrop-blur-xl shadow-xl scroll-mt-36">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-3 text-brand-400">
              <Home className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-slate-50 font-display">4. Home and Assets</h2>
            </div>
            <button
              type="button"
              onClick={() => handleAskSection("Home and Assets", "family_and_home")}
              className="inline-flex items-center space-x-1.5 text-xs text-brand-400 hover:text-brand-300 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Ask about this section</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Housing Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.name_housing_type}
                onChange={(e) => handleChange("name_housing_type", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {NAME_HOUSING_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Accompaniment Suite (Optional)
              </label>
              <select
                value={formData.name_type_suite}
                onChange={(e) => handleChange("name_type_suite", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">(Not provided)</option>
                {NAME_TYPE_SUITE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Region Rating (1: Best, 3: Worst)
              </label>
              <select
                value={formData.region_rating_client}
                onChange={(e) => handleChange("region_rating_client", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value={1}>1 - High socioeconomic</option>
                <option value={2}>2 - Standard socioeconomic</option>
                <option value={3}>3 - Low socioeconomic</option>
              </select>
            </div>

            <div className="flex items-center space-x-6 pt-3 sm:col-span-2">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.flag_own_car}
                  onChange={(e) => handleChange("flag_own_car", e.target.checked)}
                  className="rounded border-slate-700 text-brand-500 focus:ring-brand-500 bg-slate-900 h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-200">Owns a Car</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.flag_own_realty}
                  onChange={(e) => handleChange("flag_own_realty", e.target.checked)}
                  className="rounded border-slate-700 text-brand-500 focus:ring-brand-500 bg-slate-900 h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-200">Owns Real Estate / House</span>
              </label>
            </div>
          </div>
        </section>

        {/* 5. Credit Scores */}
        <section id="sec-scores" className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6 backdrop-blur-xl shadow-xl scroll-mt-36">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-3 text-brand-400">
              <TrendingUp className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-slate-50 font-display">5. External Credit Scores</h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleAskSection("External Credit Scores", "external_credit_scores")}
                className="inline-flex items-center space-x-1.5 text-xs text-brand-400 hover:text-brand-300 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Ask about this section</span>
              </button>
              <span className="text-xs text-brand-400 font-medium px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20">
                Optional / Recommended
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs mb-5 flex items-start space-x-2.5">
            <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Strongly Recommended:</strong> External credit scores (EXT_SOURCE_2 &amp; EXT_SOURCE_3) are the strongest individual predictors in the model. Leaving them blank causes median imputation and reduces evaluation accuracy.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                External Score 1 (0.0–1.0)
              </label>
              <input
                type="number"
                value={formData.ext_source_1}
                onChange={(e) => handleChange("ext_source_1", e.target.value)}
                step="0.01"
                min="0"
                max="1"
                placeholder="e.g. 0.65"
                className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.ext_source_1 ? "border-rose-500" : "border-slate-700"
                }`}
              />
              {errors.ext_source_1 && <p className="text-rose-400 text-xs mt-1">{errors.ext_source_1}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  External Score 2 (0.0–1.0)
                </label>
                <span className="text-[10px] text-amber-400 font-medium">Strongly Recommended</span>
              </div>
              <input
                type="number"
                value={formData.ext_source_2}
                onChange={(e) => handleChange("ext_source_2", e.target.value)}
                step="0.01"
                min="0"
                max="1"
                placeholder="e.g. 0.58"
                className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.ext_source_2 ? "border-rose-500" : "border-slate-700"
                }`}
              />
              {errors.ext_source_2 && <p className="text-rose-400 text-xs mt-1">{errors.ext_source_2}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  External Score 3 (0.0–1.0)
                </label>
                <span className="text-[10px] text-amber-400 font-medium">Strongly Recommended</span>
              </div>
              <input
                type="number"
                value={formData.ext_source_3}
                onChange={(e) => handleChange("ext_source_3", e.target.value)}
                step="0.01"
                min="0"
                max="1"
                placeholder="e.g. 0.42"
                className={`w-full px-3.5 py-2 bg-slate-900/80 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.ext_source_3 ? "border-rose-500" : "border-slate-700"
                }`}
              />
              {errors.ext_source_3 && <p className="text-rose-400 text-xs mt-1">{errors.ext_source_3}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Credit Bureau Inquiries / Year
              </label>
              <input
                type="number"
                value={formData.amt_req_credit_bureau_year}
                onChange={(e) => handleChange("amt_req_credit_bureau_year", e.target.value)}
                min="0"
                placeholder="e.g. 1"
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </section>

        {/* 6. Extra */}
        <section className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6 backdrop-blur-xl shadow-xl">
          <div className="flex items-center space-x-3 text-brand-400 mb-6 pb-3 border-b border-slate-700/60">
            <Sliders className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-slate-50 font-display">6. Additional Information (Optional)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Emergency State Mode (Housing Survey)
              </label>
              <select
                value={formData.emergency_state_mode}
                onChange={(e) => handleChange("emergency_state_mode", e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">(Not provided)</option>
                {EMERGENCY_STATE_MODE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-3 py-3 px-8 bg-brand-600 hover:bg-brand-500 text-white font-medium text-base rounded-xl shadow-xl shadow-brand-500/25 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Evaluating Risk Profile...</span>
              </>
            ) : (
              <>
                <span>Submit &amp; Evaluate Risk</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
