import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChatProvider } from "./context/ChatContext";
import { Navbar } from "./components/Navbar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/AdminLayout";
import { ChatWidget } from "./components/chat/ChatWidget";
import { PageTransition } from "./components/PageTransition";
import { ErrorBoundary } from "./components/ErrorBoundary";

import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Consent } from "./pages/Consent";
import { Apply } from "./pages/Apply";
import { Result } from "./pages/Result";
import { History } from "./pages/History";
import { Reliability } from "./pages/Reliability";
import { Metrics } from "./pages/Metrics";
import { Admin } from "./pages/Admin";
import { AdminLab } from "./pages/AdminLab";
import { NotFound } from "./pages/NotFound";

function HistoryRouteWrapper() {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/admin/predictions" replace />;
  }
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <History />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}

function ReliabilityRouteWrapper() {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/admin/model" replace />;
  }
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <Reliability />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}

function MetricsRedirect() {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? "/admin/model" : "/reliability"} replace />;
}

function UserLayout({ children }) {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <footer className="border-t border-theme py-6 text-center text-xs text-slate-400">
        <p>Data Dynamo &copy; 2026 — Educational Credit Risk Machine Learning Demonstration</p>
      </footer>
      {isAuthenticated && <ChatWidget />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <BrowserRouter>
          <Routes>
            {/* Admin Nested Routes with custom AdminLayout Shell */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <ErrorBoundary>
                    <AdminLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/overview" replace />} />
              <Route path="overview" element={<Admin section="overview" />} />
              <Route path="predictions" element={<Admin section="predictions" />} />
              <Route path="users" element={<Admin section="users" />} />
              <Route path="fairness" element={<Admin section="fairness" />} />
              <Route path="model" element={<Metrics />} />
              <Route path="lab" element={<AdminLab />} />
              <Route path="*" element={<Navigate to="/admin/overview" replace />} />
            </Route>

            {/* User & Public Routes inside UserLayout */}
            <Route
              path="/*"
              element={
                <UserLayout>
                  <Routes>
                    {/* Public Landing & Auth */}
                    <Route
                      path="/"
                      element={
                        <ErrorBoundary>
                          <Landing />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/login"
                      element={
                        <ErrorBoundary>
                          <Login />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        <ErrorBoundary>
                          <Register />
                        </ErrorBoundary>
                      }
                    />

                    {/* User Protected Routes */}
                    <Route
                      path="/consent"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary>
                            <Consent />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/apply"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary>
                            <Apply />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/result/:id"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary>
                            <Result />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/history"
                      element={<HistoryRouteWrapper />}
                    />
                    <Route
                      path="/reliability"
                      element={<ReliabilityRouteWrapper />}
                    />

                    {/* Backward-compatible /metrics redirect */}
                    <Route
                      path="/metrics"
                      element={<MetricsRedirect />}
                    />

                    {/* Catch-all Not Found */}
                    <Route
                      path="*"
                      element={
                        <ErrorBoundary>
                          <NotFound />
                        </ErrorBoundary>
                      }
                    />
                  </Routes>
                </UserLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </ChatProvider>
    </AuthProvider>
  );
}
