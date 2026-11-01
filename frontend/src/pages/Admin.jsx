import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { RiskBadge } from "../components/RiskBadge";
import { formatProbability, formatBand, formatMoney } from "../utils/format";
import { exportToCSV } from "../utils/csv";
import { useChartTheme } from "../components/charts/useChartTheme";
import { ChartTooltip } from "../components/charts/ChartTooltip";
import { PageHeader } from "../components/PageHeader";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart,
  Pie,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell 
} from "recharts";
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Scale, 
  Activity,
  ArrowUpRight,
  Download,
  Search,
  ArrowUpDown,
  X,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";

export function Admin({ section: propSection }) {
  const { section: paramSection } = useParams();
  const rawSection = propSection || paramSection || "overview";
  const validSections = ["overview", "predictions", "users", "fairness"];
  const section = validSections.includes(rawSection) ? rawSection : "overview";
  
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const chartColors = useChartTheme();

  // Derive filter state directly from URL searchParams (no setState in effect)
  const predBandFilter = searchParams.get("risk_band") || "";
  const predFlaggedFilter = searchParams.get("flagged") === "true";

  const updateFilterParams = (newParams) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "" || v === false) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    });
    setSearchParams(next);
  };

  // Overview Data
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [modelMetrics, setModelMetrics] = useState(null);

  // Predictions Tab Data
  const [predictions, setPredictions] = useState([]);
  const [predTotal, setPredTotal] = useState(0);
  const predLimit = 20;
  const [predOffset, setPredOffset] = useState(0);
  const [emailSearch, setEmailSearch] = useState("");
  const [predSortBy, setPredSortBy] = useState("date_desc");
  const [predLoading, setPredLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Users Tab Data
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userSortBy, setUserSortBy] = useState("predictions_desc");
  const [usersLoading, setUsersLoading] = useState(false);

  // Fairness Tab Data
  const [fairness, setFairness] = useState(null);
  const [fairnessMode, setFairnessMode] = useState("offline"); // "offline" | "live"
  const [fairnessLoading, setFairnessLoading] = useState(false);

  const [error, setError] = useState(null);

  // Fetch Overview stats & Model metrics
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const [statsData, metricsData] = await Promise.all([
        api.getAdminStats(),
        api.getMetrics().catch(() => null),
      ]);
      setStats(statsData);
      setModelMetrics(metricsData);
    } catch (err) {
      setError(err.message || "Failed to load admin statistics.");
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleCopyId = (e, id) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch Predictions when on predictions section or filters change
  useEffect(() => {
    if (section === "predictions") {
      async function loadPredictions() {
        setPredLoading(true);
        try {
          const res = await api.getAdminPredictions(predLimit, predOffset, predBandFilter);
          setPredictions(res.items || []);
          setPredTotal(res.total || 0);
        } catch (err) {
          setError(err.message || "Failed to load predictions.");
        } finally {
          setPredLoading(false);
        }
      }
      loadPredictions();
    }
  }, [section, predLimit, predOffset, predBandFilter]);

  // Fetch Users when on users section
  useEffect(() => {
    if (section === "users") {
      async function loadUsers() {
        setUsersLoading(true);
        try {
          const res = await api.getAdminUsers();
          setUsers(res.items || []);
        } catch (err) {
          setError(err.message || "Failed to load users.");
        } finally {
          setUsersLoading(false);
        }
      }
      loadUsers();
    }
  }, [section]);

  // Fetch Fairness when on fairness section
  useEffect(() => {
    if (section === "fairness") {
      async function loadFairness() {
        setFairnessLoading(true);
        try {
          const res = await api.getAdminFairness();
          setFairness(res);
        } catch (err) {
          setError(err.message || "Failed to load fairness data.");
        } finally {
          setFairnessLoading(false);
        }
      }
      loadFairness();
    }
  }, [section]);

  // Filter & Sort Predictions client-side (for email search, flagged toggle, and sorting)
  const displayedPredictions = useMemo(() => {
    let rows = [...predictions];
    if (predFlaggedFilter) {
      rows = rows.filter((r) => r.flagged_high_risk);
    }
    if (emailSearch.trim()) {
      const q = emailSearch.toLowerCase().trim();
      rows = rows.filter((r) => (r.user_email || "").toLowerCase().includes(q));
    }
    if (predSortBy === "date_desc") {
      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (predSortBy === "date_asc") {
      rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (predSortBy === "risk_desc") {
      rows.sort((a, b) => b.probability_of_default - a.probability_of_default);
    } else if (predSortBy === "risk_asc") {
      rows.sort((a, b) => a.probability_of_default - b.probability_of_default);
    }
    return rows;
  }, [predictions, predFlaggedFilter, emailSearch, predSortBy]);

  // Filter & Sort Users
  const displayedUsers = useMemo(() => {
    let list = [...users];
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      list = list.filter(
        (u) => (u.email || "").toLowerCase().includes(q) || (u.full_name || "").toLowerCase().includes(q)
      );
    }
    if (userSortBy === "predictions_desc") {
      list.sort((a, b) => (b.prediction_count || 0) - (a.prediction_count || 0));
    } else if (userSortBy === "predictions_asc") {
      list.sort((a, b) => (a.prediction_count || 0) - (b.prediction_count || 0));
    } else if (userSortBy === "email_asc") {
      list.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    }
    return list;
  }, [users, userSearch, userSortBy]);

  // Export predictions view as CSV
  const handleExportCSV = () => {
    const columns = [
      { label: "Request ID", accessor: "request_id" },
      { label: "Date & Time", accessor: (r) => new Date(r.created_at).toISOString() },
      { label: "User Email", accessor: "user_email" },
      { label: "Contract Type", accessor: "name_contract_type" },
      { label: "Credit Amount (INR)", accessor: "amt_credit" },
      { label: "Annual Income (INR)", accessor: "amt_income_total" },
      { label: "Default Risk", accessor: (r) => formatProbability(r.probability_of_default) },
      { label: "Risk Band", accessor: "risk_band" },
      { label: "Flagged High Risk", accessor: (r) => (r.flagged_high_risk ? "YES" : "NO") },
    ];
    exportToCSV("predictions_export", columns, displayedPredictions);
  };

  // Clickable Donut & Overview Card Navigations
  const handleFilterNav = (filterObj) => {
    const params = new URLSearchParams();
    if (filterObj.risk_band) params.set("risk_band", filterObj.risk_band);
    if (filterObj.flagged) params.set("flagged", "true");
    navigate(`/admin/predictions?${params.toString()}`);
  };

  // Donut Data
  const donutData = [
    { name: "Low", key: "LOW", count: stats?.predictions_by_band?.LOW || 0, color: chartColors.riskLow },
    { name: "Medium", key: "MEDIUM", count: stats?.predictions_by_band?.MEDIUM || 0, color: chartColors.riskMedium },
    { name: "High", key: "HIGH", count: stats?.predictions_by_band?.HIGH || 0, color: chartColors.riskHigh },
    { name: "Very high", key: "VERY_HIGH", count: stats?.predictions_by_band?.VERY_HIGH || 0, color: chartColors.riskVeryHigh },
  ];
  const totalDonutCount = donutData.reduce((acc, d) => acc + d.count, 0);

  // Top 10 Feature Importance
  const top10Features = (modelMetrics?.global_feature_importance || []).slice(0, 10).map((f) => ({
    name: f.display_name || f.feature,
    importance: Number((f.mean_abs_shap || 0).toFixed(4)),
  }));

  // Risk Bands Default Rates
  const riskBandsDefaultRates = (modelMetrics?.risk_bands || []).map((b) => {
    let barColor = chartColors.neutral;
    const bandKey = (b.band || "").toUpperCase();
    if (bandKey === "LOW") barColor = chartColors.riskLow;
    else if (bandKey === "MEDIUM") barColor = chartColors.riskMedium;
    else if (bandKey === "HIGH") barColor = chartColors.riskHigh;
    else if (bandKey === "VERY_HIGH") barColor = chartColors.riskVeryHigh;

    return {
      band: b.band,
      label: formatBand(b.band),
      rate: Number(((b.val_default_rate || 0) * 100).toFixed(1)),
      color: barColor,
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Dynamic Page Header */}
      {section === "overview" && (
        <PageHeader
          title="System Overview"
          description="Operational dashboard, inference logs, and model population performance metrics."
          actions={
            <button
              onClick={loadStats}
              disabled={statsLoading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-theme bg-surface hover:bg-surface-hover text-theme-primary text-xs font-medium transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin text-brand-400" : "text-theme-muted"}`} />
              <span>Refresh</span>
            </button>
          }
        />
      )}

      {section === "predictions" && (
        <PageHeader
          title="Inference Logs &amp; Predictions"
          description="Live assessment audit trail with filterable risk categories and exportable dataset records."
          actions={
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface-hover hover:bg-surface-active text-theme-primary border border-theme rounded-lg text-xs font-medium transition-colors"
              title="Export currently loaded view as CSV"
            >
              <Download className="h-3.5 w-3.5 text-brand-400" />
              <span>Export CSV</span>
            </button>
          }
        />
      )}

      {section === "users" && (
        <PageHeader
          title="User Directory"
          description="Registered borrower accounts, authentication logs, and cumulative inference counts."
        />
      )}

      {section === "fairness" && (
        <PageHeader
          title="Demographic Fairness Audit"
          description="Disparate impact analysis across sensitive attributes comparing offline benchmark and live data."
        />
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* ──────────────── TAB: OVERVIEW ──────────────── */}
      {section === "overview" && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="py-20 text-center text-xs text-theme-muted">Loading admin statistics...</div>
          ) : !stats ? (
            <div className="text-xs text-theme-muted">No stats available.</div>
          ) : (
            <>
              {/* Clickable Stat Cards with visible hover state and 3px arrow transition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Registered Users -> /admin/users */}
                <Link
                  to="/admin/users"
                  className="group bg-surface hover:bg-surface-hover p-4 rounded-xl border border-theme hover:border-brand-500/50 transition-all block focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <div className="flex items-center justify-between text-theme-muted group-hover:text-theme-primary transition-colors">
                    <span className="text-[11px] font-mono uppercase tracking-wider">Registered Users</span>
                    <div className="flex items-center space-x-1 text-brand-400">
                      <Users className="h-4 w-4" />
                      <ArrowUpRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-mono text-theme-primary mt-2">{stats.totals.users}</p>
                </Link>

                {/* 2. Total Predictions -> /admin/predictions */}
                <Link
                  to="/admin/predictions"
                  className="group bg-surface hover:bg-surface-hover p-4 rounded-xl border border-theme hover:border-indigo-500/50 transition-all block focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <div className="flex items-center justify-between text-theme-muted group-hover:text-theme-primary transition-colors">
                    <span className="text-[11px] font-mono uppercase tracking-wider">Total Predictions</span>
                    <div className="flex items-center space-x-1 text-indigo-400">
                      <Activity className="h-4 w-4" />
                      <ArrowUpRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-mono text-theme-primary mt-2">{stats.totals.predictions}</p>
                </Link>

                {/* 3. Flagged for Review -> /admin/predictions?flagged=true */}
                <Link
                  to="/admin/predictions?flagged=true"
                  className="group bg-surface hover:bg-surface-hover p-4 rounded-xl border border-theme hover:border-orange-500/50 transition-all block focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <div className="flex items-center justify-between text-theme-muted group-hover:text-theme-primary transition-colors">
                    <span className="text-[11px] font-mono uppercase tracking-wider">Flagged for Review</span>
                    <div className="flex items-center space-x-1 text-orange-400">
                      <AlertTriangle className="h-4 w-4" />
                      <ArrowUpRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-2xl font-bold font-mono text-theme-primary">{stats.totals.flagged}</span>
                    <span className="text-xs text-orange-400 font-mono font-medium">
                      ({formatProbability(stats.flagged_rate)})
                    </span>
                  </div>
                </Link>

                {/* 4. Avg Estimated Risk -> smooth scroll to risk bands section */}
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("admin-risk-bands-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="group text-left bg-surface hover:bg-surface-hover p-4 rounded-xl border border-theme hover:border-emerald-500/50 transition-all block focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                >
                  <div className="flex items-center justify-between text-theme-muted group-hover:text-theme-primary transition-colors">
                    <span className="text-[11px] font-mono uppercase tracking-wider">Avg Estimated Risk</span>
                    <div className="flex items-center space-x-1 text-emerald-400">
                      <TrendingUp className="h-4 w-4" />
                      <ArrowUpRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-mono text-theme-primary mt-2">
                    {formatProbability(stats.avg_probability)}
                  </p>
                </button>
              </div>

              {/* Charts Grid 1: 14-Day Trend & Clickable Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Predictions per Day (Last 14 Days) */}
                <div className="bg-surface p-5 rounded-xl border border-theme space-y-3">
                  <h3 className="text-sm font-semibold text-theme-primary font-display">Daily Inferences (Last 14 Days)</h3>
                  <div className="h-56 w-full">
                    {!stats.predictions_per_day || stats.predictions_per_day.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-theme-muted">
                        Not enough data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.predictions_per_day} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                          <XAxis
                            dataKey="date"
                            stroke={chartColors.axis}
                            tick={{ fill: chartColors.mutedText, fontSize: 10 }}
                            tickFormatter={(val) => {
                              const d = new Date(val);
                              return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
                            }}
                          />
                          <YAxis domain={[0, 'auto']} stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 10 }} allowDecimals={false} />
                          <Tooltip
                            cursor={false}
                            content={<ChartTooltip formatter={(val) => `${val} predictions`} />}
                          />
                          <Line type="linear" dataKey="count" stroke={chartColors.brand} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Clickable Donut of predictions by risk band */}
                <div className="bg-surface p-5 rounded-xl border border-theme space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-theme-primary font-display">Predictions by Risk Band</h3>
                  </div>
                  <div className="h-56 w-full flex items-center justify-center">
                    {totalDonutCount === 0 ? (
                      <div className="text-xs text-theme-muted">Not enough data yet</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full items-center">
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={donutData}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={42}
                                outerRadius={68}
                                paddingAngle={2}
                                onClick={(entry) => handleFilterNav({ risk_band: entry.key })}
                                className="cursor-pointer"
                              >
                                {donutData.map((entry, idx) => (
                                  <Cell key={`donut-${idx}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                cursor={false}
                                content={<ChartTooltip formatter={(val) => `${val} inferences`} />}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {donutData.map((d) => {
                            const pct = totalDonutCount > 0 ? ((d.count / totalDonutCount) * 100).toFixed(1) : "0.0";
                            return (
                              <div
                                key={d.key}
                                onClick={() => handleFilterNav({ risk_band: d.key })}
                                className="flex items-center justify-between text-theme-secondary hover:text-theme-primary cursor-pointer p-1 rounded hover:bg-surface-hover transition-colors"
                              >
                                <span className="flex items-center space-x-2">
                                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                                  <span>{d.name}</span>
                                </span>
                                <span className="font-mono text-theme-muted">
                                  {d.count} ({pct}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Grid 2: Feature Influence & Validation Default Rates */}
              <div id="admin-risk-bands-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-20">
                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/60 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-50 font-display">Average influence of each factor on the score</h3>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    A longer bar means the factor moves scores more on average. It does not say whether it raises or lowers risk.
                  </p>
                  <div className="h-56 w-full pt-2">
                    {top10Features.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        Not enough data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top10Features} layout="vertical" margin={{ top: 5, right: 10, left: 35, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                          <XAxis type="number" stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 10 }} />
                          <YAxis
                            dataKey="name"
                            type="category"
                            stroke={chartColors.axis}
                            tick={{ fill: chartColors.mutedText, fontSize: 10 }}
                            width={80}
                          />
                          <Tooltip
                            content={<ChartTooltip formatter={(val) => `${val} mean impact`} />}
                          />
                          <Bar dataKey="importance" fill={chartColors.accent} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/60 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-50 font-display">Share who really defaulted, by risk level</h3>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Higher levels should have more real defaulters.
                  </p>
                  <div className="h-56 w-full pt-2">
                    {riskBandsDefaultRates.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        Not enough data yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskBandsDefaultRates} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                          <XAxis dataKey="label" stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 11 }} />
                          <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                          <Tooltip
                            content={<ChartTooltip formatter={(val) => `${val}% defaulted`} />}
                          />
                          <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                            {riskBandsDefaultRates.map((entry, idx) => (
                              <Cell key={`bar-${idx}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Predictions Table */}
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700/60">
                  <h3 className="text-sm font-semibold text-slate-50 font-display">Recent Predictions (Up to 10)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/60 font-semibold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3">Applicant Email</th>
                        <th className="px-5 py-3">Requested Credit</th>
                        <th className="px-5 py-3">Probability</th>
                        <th className="px-5 py-3">Risk Band</th>
                        <th className="px-5 py-3">Flag Status</th>
                        <th className="px-5 py-3 text-right">View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {(stats.recent_predictions || []).map((p) => (
                        <tr key={p.request_id} className="hover:bg-slate-700/20">
                          <td className="px-5 py-3 text-slate-200 font-medium">{p.user_email}</td>
                          <td className="px-5 py-3 font-mono text-slate-300">
                            ${Number(p.amt_credit).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-slate-50">
                            {formatProbability(p.probability_of_default)}
                          </td>
                          <td className="px-5 py-3">
                            <RiskBadge band={p.risk_band} />
                          </td>
                          <td className="px-5 py-3">
                            {p.flagged_high_risk ? (
                              <span className="text-orange-400 font-semibold">Flagged</span>
                            ) : (
                              <span className="text-slate-500">Standard</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to={`/result/${p.request_id}`}
                              className="text-brand-400 hover:text-brand-300 font-medium inline-flex items-center space-x-1"
                            >
                              <span>Report</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ──────────────── TAB: PREDICTIONS ──────────────── */}
      {section === "predictions" && (
        <div className="space-y-4">
          {/* Active Filter Chips */}
          {(predBandFilter || predFlaggedFilter) && (
            <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs">
              <span className="text-slate-400 font-medium">Active filters:</span>
              {predBandFilter && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  <span>Band: {predBandFilter}</span>
                  <button
                    onClick={() => {
                      updateFilterParams({ risk_band: "" });
                    }}
                    className="hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {predFlaggedFilter && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  <span>Flagged Only</span>
                  <button
                    onClick={() => {
                      updateFilterParams({ flagged: false });
                    }}
                    className="hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchParams({});
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Interactive Controls Bar */}
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Left: Email Search & Flagged toggle */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Email search (searching this page) */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  placeholder="Search this page by email..."
                  className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-brand-500 w-56"
                />
              </div>

              {/* Band chips */}
              <div className="flex items-center space-x-1">
                {["", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"].map((band) => (
                  <button
                    key={band}
                    onClick={() => {
                      updateFilterParams({ risk_band: band });
                      setPredOffset(0);
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      predBandFilter === band
                        ? "bg-brand-600 text-white"
                        : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/60"
                    }`}
                  >
                    {band === "" ? "All" : band.replace("_", " ")}
                  </button>
                ))}
              </div>

              {/* Flagged Toggle */}
              <button
                type="button"
                onClick={() => updateFilterParams({ flagged: !predFlaggedFilter })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  predFlaggedFilter
                    ? "bg-orange-500/20 text-orange-300 border-orange-500/40 font-semibold"
                    : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
                }`}
              >
                Flagged only
              </button>
            </div>

            {/* Right: Sort & CSV Export */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={predSortBy}
                  onChange={(e) => setPredSortBy(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                  <option value="risk_desc">Highest risk first</option>
                  <option value="risk_asc">Lowest risk first</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                title="Export currently loaded view as CSV"
              >
                <Download className="h-3.5 w-3.5 text-brand-400" />
                <span>Export this view as CSV</span>
              </button>
            </div>
          </div>

          {/* Predictions Table */}
          <div className="bg-surface rounded-xl border border-theme overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-theme-secondary">
                <thead className="bg-surface-hover font-semibold text-theme-muted uppercase tracking-wider border-b border-theme">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">User Email</th>
                    <th className="px-5 py-3">Contract</th>
                    <th className="px-5 py-3">Loan</th>
                    <th className="px-5 py-3">Income</th>
                    <th className="px-5 py-3">Probability</th>
                    <th className="px-5 py-3">Risk Band</th>
                    <th className="px-5 py-3">Flagged</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {predLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-theme-muted">
                        Loading predictions...
                      </td>
                    </tr>
                  ) : displayedPredictions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-theme-muted">
                        No predictions matching criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedPredictions.map((p) => (
                      <tr
                        key={p.request_id}
                        tabIndex={0}
                        role="button"
                        onClick={() => navigate(`/result/${p.request_id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/result/${p.request_id}`);
                          }
                        }}
                        className="hover:bg-surface-hover cursor-pointer transition-colors focus:outline-none focus:bg-surface-hover focus:ring-1 focus:ring-brand-500"
                      >
                        <td className="px-5 py-3 text-theme-muted whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-theme-primary font-medium">{p.user_email}</td>
                        <td className="px-5 py-3 text-theme-secondary">{p.name_contract_type}</td>
                        <td className="px-5 py-3 font-mono text-theme-primary">
                          {formatMoney(p.amt_credit)}
                        </td>
                        <td className="px-5 py-3 font-mono text-theme-muted">
                          {formatMoney(p.amt_income_total)}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-theme-primary">
                          {formatProbability(p.probability_of_default)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <RiskBadge band={p.risk_band} />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {p.flagged_high_risk ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-hover text-theme-muted">
                              Standard
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(e, p.request_id)}
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-theme-muted hover:text-theme-primary transition-colors text-[11px]"
                              title="Copy request UUID"
                            >
                              {copiedId === p.request_id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>ID</span>
                                </>
                              )}
                            </button>
                            <span className="text-brand-400 hover:text-brand-300 font-medium inline-flex items-center space-x-0.5">
                              <span>Inspect</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 bg-slate-900/60 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing {predOffset + 1} to {Math.min(predOffset + predLimit, predTotal)} of {predTotal}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPredOffset(Math.max(0, predOffset - predLimit))}
                  disabled={predOffset === 0}
                  className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPredOffset(predOffset + predLimit)}
                  disabled={predOffset + predLimit >= predTotal}
                  className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB: USERS ──────────────── */}
      {section === "users" && (
        <div className="space-y-4">
          {/* User Search and Sort controls */}
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name or email..."
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-brand-500 w-64"
              />
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400">Sort:</span>
                <select
                  value={userSortBy}
                  onChange={(e) => setUserSortBy(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="predictions_desc">Most predictions first</option>
                  <option value="predictions_asc">Fewest predictions first</option>
                  <option value="email_asc">Email (A-Z)</option>
                </select>
              </div>
              <span className="text-slate-400">Total: {displayedUsers.length}</span>
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Full Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Created Date</th>
                    <th className="px-5 py-3">Total Predictions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Loading users...
                      </td>
                    </tr>
                  ) : displayedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No users match search query.
                      </td>
                    </tr>
                  ) : (
                    displayedUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-700/20">
                        <td className="px-5 py-3 text-slate-50 font-semibold">{u.full_name}</td>
                        <td className="px-5 py-3 text-slate-300 font-mono">{u.email}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                              u.role === "admin"
                                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-slate-50">
                          {u.prediction_count}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB: FAIRNESS ──────────────── */}
      {section === "fairness" && (
        <div className="space-y-6">
          {fairnessLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">Loading fairness audits...</div>
          ) : !fairness ? (
            <div className="text-xs text-slate-400">No fairness metrics available.</div>
          ) : (
            <>
              {/* Policy Note Callout */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs flex items-start space-x-3">
                <Scale className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-50 font-display">Demographic Parity &amp; Fairness Governance</h4>
                  <p className="text-slate-400 leading-relaxed">{fairness.note}</p>
                </div>
              </div>

              {/* Offline Test vs Live Stream Segmented Control Toggle */}
              <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/60">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setFairnessMode("offline")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      fairnessMode === "offline"
                        ? "bg-brand-600 text-white font-semibold shadow-sm"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Offline Benchmark Test (1,350 Validation Rows)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFairnessMode("live")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      fairnessMode === "live"
                        ? "bg-brand-600 text-white font-semibold shadow-sm"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Live Production Stream ({fairness.live?.total_predictions || 0} Inferences)
                  </button>
                </div>
              </div>

              {/* View 1: Offline Test Mode */}
              {fairnessMode === "offline" && (
                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/60 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-50 font-display">Offline Validation Benchmark</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Measured on the held-out validation set of 1,350 applications.
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">1,350 records</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Gender Flagged Rate Ratio:</span>
                      <span className="text-sm font-mono font-bold text-brand-400">
                        {fairness.offline?.gender_flagged_rate_ratio !== undefined && fairness.offline?.gender_flagged_rate_ratio !== null
                          ? fairness.offline.gender_flagged_rate_ratio.toFixed(3)
                          : "N/A"}
                      </span>
                    </div>

                    {/* Status Chip */}
                    <div>
                      {(fairness.offline?.gender_flagged_rate_ratio ?? 1.0) < 0.8 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Below the common 0.8 rule of thumb - review needed (rule of thumb, not legal test)
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Within the common 0.8 to 1.25 range (rule of thumb, not legal test)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grouped Bars: Gender Flagged Rates */}
                  <div className="pt-2">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Flagged Rate by Gender (Offline)
                    </h4>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(fairness.offline?.by_gender || []).map((g) => ({
                            group: g.group === "F" ? "Female" : "Male",
                            flaggedRate: Number(((g.flagged_rate || 0) * 100).toFixed(1)),
                            defaultRate: Number(((g.observed_default_rate || 0) * 100).toFixed(1)),
                          }))}
                          margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                          <XAxis dataKey="group" stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 11 }} />
                          <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                          <Tooltip content={<ChartTooltip formatter={(v, name) => `${v}% ${name}`} />} />
                          <Bar dataKey="flaggedRate" name="Flagged Rate" fill={chartColors.accent} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="defaultRate" name="Observed Default Rate" fill={chartColors.neutral} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Grouped Bars: Age Band */}
                  <div className="pt-2">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Flagged Rate by Age Band (Offline)
                    </h4>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(fairness.offline?.by_age_band || []).map((a) => ({
                            group: a.group,
                            flaggedRate: Number(((a.flagged_rate || 0) * 100).toFixed(1)),
                            defaultRate: Number(((a.observed_default_rate || 0) * 100).toFixed(1)),
                          }))}
                          margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                          <XAxis dataKey="group" stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 10 }} />
                          <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                          <Tooltip content={<ChartTooltip formatter={(v, name) => `${v}% ${name}`} />} />
                          <Bar dataKey="flaggedRate" name="Flagged Rate" fill={chartColors.brand} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="defaultRate" name="Observed Default" fill={chartColors.neutral} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* View 2: Live Production Stream Mode */}
              {fairnessMode === "live" && (
                <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/60 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-50 font-display">Live Production Stream</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Real-time assessment results recorded dynamically from active user submissions.
                      </p>
                    </div>
                    <span className="text-[11px] text-brand-400 font-mono">
                      {fairness.live?.total_predictions || 0} Total Inferences
                    </span>
                  </div>

                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900/60 text-slate-400 uppercase">
                        <tr>
                          <th className="px-4 py-3">Demographic Group</th>
                          <th className="px-4 py-3">Live Inferences (N)</th>
                          <th className="px-4 py-3">Flagged Rate</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {(fairness.live?.by_gender || []).map((g) => (
                          <tr key={g.group}>
                            <td className="px-4 py-3 font-bold text-slate-50">
                              {g.group === "F" ? "Female" : "Male"}
                            </td>
                            <td className="px-4 py-3 font-mono">{g.n}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-orange-400">
                              {formatProbability(g.flagged_rate)}
                            </td>
                            <td className="px-4 py-3">
                              {g.n > 0 ? (
                                <span className="text-emerald-400 flex items-center space-x-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Monitored</span>
                                </span>
                              ) : (
                                <span className="text-slate-500">No samples yet</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
