/**
 * api.js — API client with Bearer auth and 401 redirect to /login
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    const error = new Error("Network error connecting to the service.");
    error.status = 0;
    error.code = "NETWORK_ERROR";
    error.details = [{ message: netErr.message }];
    throw error;
  }

  // Handle 401: Logout and redirect to login
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
      window.location.href = "/login";
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error?.message || `HTTP error ${response.status}`);
    error.status = response.status;
    error.code = data?.error?.code;
    error.details = data?.error?.details || [];
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiRequest("/auth/me", { method: "GET" }),

  // Consent & Predict
  consent: (body) => apiRequest("/consent", { method: "POST", body: JSON.stringify(body) }),
  predict: (body, topN = 5) => apiRequest(`/predict?top_n=${topN}`, { method: "POST", body: JSON.stringify(body) }),
  whatif: (body) => apiRequest("/whatif", { method: "POST", body: JSON.stringify(body) }),

  // Explanation & Chat (v1.1 & v1.2)
  explain: (body) => apiRequest("/explain", { method: "POST", body: JSON.stringify(body) }),
  chat: (body) => apiRequest("/chat", { method: "POST", body: JSON.stringify(body) }),

  // History
  getHistory: (limit = 20, offset = 0) => apiRequest(`/history?limit=${limit}&offset=${offset}`, { method: "GET" }),
  getHistoryItem: (requestId) => apiRequest(`/history/${requestId}`, { method: "GET" }),

  // Metrics
  getMetrics: () => apiRequest("/model-metrics", { method: "GET" }),

  // Admin
  getAdminStats: () => apiRequest("/admin/stats", { method: "GET" }),
  getAdminPredictions: (limit = 20, offset = 0, riskBand = "") => {
    const query = new URLSearchParams({ limit, offset });
    if (riskBand) query.append("risk_band", riskBand);
    return apiRequest(`/admin/predictions?${query.toString()}`, { method: "GET" });
  },
  getAdminUsers: () => apiRequest("/admin/users", { method: "GET" }),
  getAdminFairness: () => apiRequest("/admin/fairness", { method: "GET" }),
};
