import React from "react";
import { Link } from "react-router-dom";
import { Compass, Home, ArrowLeft } from "lucide-react";

export function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-surface-hover border border-theme flex items-center justify-center text-brand-400">
        <Compass className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-accent">
          404 Error
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary font-display">
          Page not found
        </h1>
        <p className="text-sm text-theme-muted max-w-sm mx-auto">
          The page you requested does not exist or has been moved to another location.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Go to home</span>
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-surface-hover hover:bg-surface-active text-theme-primary border border-theme rounded-xl text-xs font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Go back</span>
        </button>
      </div>
    </div>
  );
}
