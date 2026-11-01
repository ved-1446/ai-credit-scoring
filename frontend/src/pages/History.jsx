import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { RiskBadge } from "../components/RiskBadge";
import { formatProbability, formatMoney } from "../utils/format";
import { useChartTheme } from "../components/charts/useChartTheme";
import { ChartTooltip } from "../components/charts/ChartTooltip";
import { StateView } from "../components/StateView";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { 
  History as HistoryIcon, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  Clock,
  Filter,
  TrendingUp,
  ArrowUpDown,
  Plus
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from "recharts";

export function History() {
  useDocumentTitle("My History");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bandFilter, setBandFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date_desc");
  const navigate = useNavigate();
  const chartColors = useChartTheme();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getHistory(limit, offset);
      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(typeof res?.total === "number" ? res.total : (res?.items?.length || 0));
    } catch (err) {
      setError(err?.message || "Failed to load prediction history.");
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Client-side filtering and sorting for loaded items (defensive checks)
  const filteredAndSortedItems = useMemo(() => {
    let result = Array.isArray(items) ? [...items] : [];
    if (bandFilter !== "ALL") {
      result = result.filter((item) => (item?.risk_band || "").toUpperCase() === bandFilter);
    }
    if (sortBy === "date_desc") {
      result.sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
    } else if (sortBy === "date_asc") {
      result.sort((a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0));
    } else if (sortBy === "risk_desc") {
      result.sort((a, b) => (b?.probability_of_default ?? 0) - (a?.probability_of_default ?? 0));
    } else if (sortBy === "risk_asc") {
      result.sort((a, b) => (a?.probability_of_default ?? 0) - (b?.probability_of_default ?? 0));
    }
    return result;
  }, [items, bandFilter, sortBy]);

  // Sparkline/trend data formatted chronologically (oldest to newest)
  const trendData = useMemo(() => {
    if (!Array.isArray(items) || items.length < 2) return [];
    return [...items]
      .filter((item) => item && typeof item.probability_of_default === "number")
      .reverse()
      .map((item, idx) => {
        let dateStr = "—";
        try {
          if (item?.created_at) {
            dateStr = new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" });
          }
        } catch {
          dateStr = "—";
        }
        return {
          index: idx + 1,
          date: dateStr,
          risk: Math.max(0, item?.probability_of_default || 0),
          riskPercent: ((item?.probability_of_default || 0) * 100).toFixed(1),
          band: item?.risk_band || "UNKNOWN",
        };
      });
  }, [items]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      const datePart = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
      return `${datePart}, ${timePart}`;
    } catch {
      return "—";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-32 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary tracking-tight flex items-center space-x-3 font-display">
            <HistoryIcon className="h-7 w-7 text-brand-400" />
            <span>My Evaluation History</span>
          </h1>
          <p className="text-sm text-theme-muted mt-1">
            Review past credit risk evaluations, risk levels, and risk progression over time.
          </p>
        </div>
      </div>

      {error && (
        <StateView
          state="error"
          title="Could not load history"
          error={error}
          onRetry={loadHistory}
        />
      )}

      {/* Default Risk Trend Over Time */}
      {!loading && trendData.length >= 2 && (
        <div className="bg-surface rounded-2xl border border-theme p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-theme-primary font-display">
              <TrendingUp className="h-4 w-4 text-brand-400" />
              <span>Default Risk Trend Over Time</span>
            </div>
            <span className="text-[11px] text-theme-muted font-mono">
              Showing {trendData.length} evaluations
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke={chartColors.axis} tick={{ fill: chartColors.mutedText, fontSize: 10 }} />
                <YAxis
                  domain={[0, 'auto']}
                  stroke={chartColors.axis}
                  tick={{ fill: chartColors.mutedText, fontSize: 10 }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <ChartTooltip
                        title={`Evaluation #${data.index} (${data.date})`}
                        items={[
                          { label: "Risk score", value: `${data.riskPercent}%`, mono: true },
                          { label: "Risk Level", value: data.band, bold: true },
                        ]}
                      />
                    );
                  }}
                />
                <Line
                  type="linear"
                  dataKey="risk"
                  stroke={chartColors.brand}
                  strokeWidth={2}
                  dot={{ fill: chartColors.brand, r: 3.5 }}
                  activeDot={{ r: 5, fill: chartColors.brand }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter and Sort Controls */}
      {!loading && items.length > 0 && (
        <div className="bg-surface rounded-xl border border-theme p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-theme-muted font-medium mr-1 flex items-center space-x-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Risk Level:</span>
            </span>
            {["ALL", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"].map((band) => (
              <button
                key={band}
                type="button"
                onClick={() => setBandFilter(band)}
                className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                  bandFilter === band
                    ? "bg-brand-600 text-white font-semibold"
                    : "bg-surface-hover text-theme-secondary hover:text-theme-primary border border-theme"
                }`}
              >
                {band === "ALL" ? "All Levels" : band.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-theme-muted flex items-center space-x-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-surface-hover border border-theme text-theme-primary text-xs focus:outline-none focus:border-brand-500"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="risk_desc">Highest risk first</option>
              <option value="risk_asc">Lowest risk first</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <StateView state="loading" />
      ) : filteredAndSortedItems.length === 0 ? (
        <StateView
          state="empty"
          title="No evaluations found"
          description={
            bandFilter !== "ALL"
              ? `No assessments found with risk level ${bandFilter}.`
              : "You haven't submitted any credit scoring applications under this account yet."
          }
          action={
            bandFilter !== "ALL" ? (
              <button
                type="button"
                onClick={() => setBandFilter("ALL")}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-theme-primary border border-theme rounded-xl text-xs font-medium transition-colors"
              >
                Clear Filter
              </button>
            ) : (
              <Link
                to="/apply"
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Start assessment</span>
              </Link>
            )
          }
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-theme shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-theme-secondary">
              <thead className="bg-surface-hover text-xs font-semibold text-theme-muted uppercase tracking-wider border-b border-theme">
                <tr>
                  <th scope="col" className="px-6 py-4">Date &amp; Time</th>
                  <th scope="col" className="px-6 py-4">Contract</th>
                  <th scope="col" className="px-6 py-4">Requested Credit</th>
                  <th scope="col" className="px-6 py-4">Annual Income</th>
                  <th scope="col" className="px-6 py-4">Risk Score</th>
                  <th scope="col" className="px-6 py-4">Risk Level</th>
                  <th scope="col" className="px-6 py-4">Flag</th>
                  <th scope="col" className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {filteredAndSortedItems.map((item, idx) => (
                  <tr
                    key={item?.request_id || `history-item-${idx}`}
                    tabIndex={0}
                    role="button"
                    onClick={() => item?.request_id && navigate(`/result/${item.request_id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (item?.request_id) navigate(`/result/${item.request_id}`);
                      }
                    }}
                    className="hover:bg-surface-hover cursor-pointer transition-colors focus:outline-none focus:bg-surface-hover focus:ring-1 focus:ring-brand-500"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-theme-primary font-medium">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="h-3.5 w-3.5 text-theme-muted" />
                        <span>{formatDateTime(item?.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-theme-secondary">
                      {item?.name_contract_type || "Cash loans"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-theme-primary">
                      {formatMoney(item?.amt_credit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-theme-secondary">
                      {formatMoney(item?.amt_income_total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-theme-primary">
                      {formatProbability(item?.probability_of_default)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RiskBadge band={item?.risk_band} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item?.flagged_high_risk ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Flagged
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-hover text-theme-muted">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-xs text-brand-400 hover:text-brand-300 font-medium inline-flex items-center space-x-1">
                        <span>Open result</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-surface-hover border-t border-theme flex items-center justify-between">
            <span className="text-xs text-theme-muted">
              Showing <span className="font-semibold text-theme-primary">{offset + 1}</span> to{" "}
              <span className="font-semibold text-theme-primary">{Math.min(offset + limit, total)}</span> of{" "}
              <span className="font-semibold text-theme-primary">{total}</span> records
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="p-2 rounded-lg border border-theme text-theme-secondary hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-theme-muted">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={offset + limit >= total}
                className="p-2 rounded-lg border border-theme text-theme-secondary hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
