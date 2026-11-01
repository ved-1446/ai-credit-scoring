import React from "react";
import { Skeleton } from "./ui/Skeleton";
import { AlertCircle, RefreshCw, Inbox } from "lucide-react";

export function StateView({
  state = "empty", // "loading" | "empty" | "error"
  title,
  description,
  error,
  onRetry,
  action,
  icon: CustomIcon,
  className = "",
}) {
  if (state === "loading") {
    return (
      <div className={`space-y-4 py-8 ${className}`}>
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={`p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-3 ${className}`}>
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1 min-w-0">
            <h4 className="font-semibold text-rose-200 text-sm font-display">
              {title || "Failed to load data"}
            </h4>
            <p className="text-rose-300/90 leading-relaxed">
              {error || description || "An unexpected error occurred while communicating with the server."}
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface-hover hover:bg-surface-active text-theme-primary rounded-lg text-xs font-medium border border-theme transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // state === "empty"
  const IconComponent = CustomIcon || Inbox;

  return (
    <div className={`bg-surface rounded-2xl border border-theme p-10 sm:p-12 text-center space-y-4 shadow-sm ${className}`}>
      <div className="mx-auto h-12 w-12 rounded-xl bg-surface-hover border border-theme flex items-center justify-center text-theme-muted">
        <IconComponent className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-semibold text-theme-primary font-display">
          {title || "No data available"}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-theme-muted max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  );
}
