import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { 
  FileText, 
  History, 
  HelpCircle, 
  ShieldCheck, 
  LogOut, 
  User, 
  Menu, 
  X,
  Zap
} from "lucide-react";

export function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if consent has been recorded
  const hasConsent = Boolean(localStorage.getItem("consent_id"));
  const assessmentPath = hasConsent ? "/apply" : "/consent";

  // Normal users: Assessment, History, How reliable?
  // Admins: Admin console only
  const navLinks = isAdmin
    ? [
        { name: "Admin console", path: "/admin", icon: ShieldCheck, key: "admin" },
      ]
    : [
        { name: "Assessment", path: assessmentPath, icon: FileText, key: "assessment" },
        { name: "History", path: "/history", icon: History, key: "history" },
        { name: "How reliable?", path: "/reliability", icon: HelpCircle, key: "reliability" },
      ];

  const isActive = (item) => {
    if (item.key === "admin") return location.pathname.startsWith("/admin");
    if (item.key === "assessment") {
      return (
        location.pathname === "/apply" ||
        location.pathname === "/consent" ||
        location.pathname.startsWith("/result")
      );
    }
    return location.pathname === item.path;
  };

  return (
    <nav className="bg-surface border-b border-theme sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm transition-transform duration-200">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-theme-primary font-display">
                Data Dynamo
              </span>
              <span className="block text-[10px] text-brand-400 font-medium tracking-wider uppercase -mt-1 font-sans">
                AI Credit Scoring
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links with sliding 2px underline */}
          {isAuthenticated ? (
            <div className="hidden md:flex items-center space-x-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link);
                return (
                  <Link
                    key={link.key}
                    to={link.path}
                    className={`relative flex items-center space-x-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "text-brand-400 font-semibold"
                        : "text-theme-secondary hover:text-theme-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.name}</span>
                    {/* 2px sliding bottom underline */}
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand-400 rounded-full transition-all duration-200 ease-out motion-reduce:transition-none" />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {/* Right Section: User Info / Auth buttons / Theme Toggle */}
          <div className="hidden md:flex items-center space-x-4">
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="flex items-center space-x-3 pl-4 border-l border-theme">
                <div className="flex items-center space-x-2 text-sm text-theme-secondary">
                  <div className="h-8 w-8 rounded-full bg-surface-hover border border-theme flex items-center justify-center text-brand-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-xs font-semibold text-theme-primary">{user?.full_name || user?.email}</p>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-hover text-theme-muted">
                      {user?.role}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm text-theme-secondary hover:text-theme-primary rounded-lg hover:bg-surface-hover transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-lg shadow-sm transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-hover transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface border-b border-theme px-4 pt-2 pb-4 space-y-2">
          {isAuthenticated ? (
            <>
              <div className="py-2 border-b border-theme text-xs text-theme-muted">
                Signed in as <span className="text-theme-primary font-medium">{user?.email}</span> ({user?.role})
              </div>
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link);
                return (
                  <Link
                    key={link.key}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active ? "bg-surface-hover text-brand-400 font-semibold" : "text-theme-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 px-4 rounded-lg bg-surface-hover text-theme-primary"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 px-4 rounded-lg bg-brand-600 text-white font-medium"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
