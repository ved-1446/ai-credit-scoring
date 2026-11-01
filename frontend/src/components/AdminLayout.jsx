import React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { ChatWidget } from "./chat/ChatWidget";
import { 
  BarChart3, 
  Users, 
  Scale, 
  Cpu, 
  Activity, 
  FlaskConical, 
  LogOut,
  Zap,
  ArrowUpRight,
  ChevronRight
} from "lucide-react";

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Overview", path: "/admin/overview", icon: Activity },
    { name: "Predictions", path: "/admin/predictions", icon: BarChart3 },
    { name: "Users", path: "/admin/users", icon: Users },
    { name: "Fairness", path: "/admin/fairness", icon: Scale },
    { name: "Model details", path: "/admin/model", icon: Cpu },
    { name: "Test lab", path: "/admin/lab", icon: FlaskConical },
  ];

  // Derive current page title for breadcrumb
  const getBreadcrumbTitle = () => {
    const current = navItems.find((item) => location.pathname.startsWith(item.path));
    return current ? current.name : "Console";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans relative">
      {/* Slim Top Header Bar */}
      <header className="h-12 bg-slate-950 border-b border-theme flex items-center justify-between px-4 sm:px-6 z-30 flex-shrink-0">
        <div className="flex items-center space-x-2 text-xs font-mono">
          <Link to="/admin/overview" className="text-theme-muted hover:text-theme-primary font-medium">
            Admin console
          </Link>
          <ChevronRight className="h-3 w-3 text-theme-muted" />
          <span className="text-brand-400 font-semibold">{getBreadcrumbTitle()}</span>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <Link
            to="/"
            className="inline-flex items-center space-x-1.5 text-theme-secondary hover:text-theme-primary transition-colors font-medium"
          >
            <span>View user site</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-theme-muted" />
          </Link>

          <div className="h-3.5 w-px bg-theme" />

          <ThemeToggle />

          <div className="h-3.5 w-px bg-theme" />

          <span className="hidden sm:inline font-mono text-[11px] text-theme-muted truncate max-w-[140px]">
            {user?.email}
          </span>

          <button
            type="button"
            onClick={handleLogout}
            className="text-rose-400 hover:text-rose-300 font-medium inline-flex items-center space-x-1 transition-colors"
            title="Sign out of admin session"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Shell: Sidebar + Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-56 bg-slate-950/80 border-b md:border-b-0 md:border-r border-theme flex flex-col justify-between flex-shrink-0">
          <div>
            {/* Brand in Sidebar */}
            <div className="p-4 border-b border-theme flex items-center space-x-2.5">
              <div className="h-7 w-7 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="overflow-hidden">
                <span className="text-sm font-bold tracking-tight text-theme-primary font-display block truncate">
                  Data Dynamo
                </span>
                <span className="inline-block text-[9px] font-mono uppercase tracking-widest text-accent font-semibold -mt-0.5">
                  Admin Console
                </span>
              </div>
            </div>

            {/* Navigation links with soft teal tint background (14% in dark, 10% in light), 2px teal bar on left */}
            <nav className="p-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/admin/overview"}
                    className={({ isActive }) =>
                      `relative flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-brand-500/15 text-brand-400 font-semibold border-l-2 border-brand-400 pl-2.5"
                          : "text-theme-muted hover:text-theme-primary hover:bg-surface-hover"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-10 bg-slate-900">
          <Outlet />
        </main>
      </div>

      {/* Admin Global Chat Widget */}
      <ChatWidget />
    </div>
  );
}
