import React from "react";
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.toString() || "Unknown error";
      const stack = this.state.errorInfo?.componentStack || this.state.error?.stack || "";

      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="bg-surface rounded-2xl border border-theme p-8 sm:p-10 shadow-xl space-y-6">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertCircle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-theme-primary font-display">
                Something went wrong on this page
              </h1>
              <p className="text-sm text-theme-muted max-w-md mx-auto">
                An unexpected rendering error occurred. You can retry loading the page or return to the home screen.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try again</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-surface-hover hover:bg-surface-active text-theme-primary border border-theme rounded-xl text-xs font-medium transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Go to home</span>
              </button>
            </div>

            {/* Collapsible Technical Details */}
            <div className="pt-4 border-t border-theme text-left">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="w-full flex items-center justify-between text-xs text-theme-muted hover:text-theme-primary font-mono py-1 transition-colors"
              >
                <span>Technical details</span>
                {this.state.showDetails ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-theme font-mono text-[11px] text-rose-300 space-y-2 overflow-x-auto select-all max-h-60 overflow-y-auto">
                  <p className="font-semibold text-rose-400">{errorMsg}</p>
                  {stack && (
                    <pre className="text-theme-muted text-[10px] whitespace-pre-wrap leading-relaxed">
                      {stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
