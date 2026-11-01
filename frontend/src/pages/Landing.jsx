import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { APP_NAME, DEMO_DISCLAIMER } from "../constants/text";
import { RISK_BANDS } from "../constants/risk";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function Landing() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const fullTitle = "AI CREDIT SCORING SYSTEM";

  // Check consent status to target either /apply or /consent
  const hasConsent = Boolean(localStorage.getItem("consent_id"));
  const assessmentPath = hasConsent ? "/apply" : "/consent";

  const [typedTitle, setTypedTitle] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let isReduced = false;
    try {
      isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      isReduced = false;
    }
    setReducedMotion(isReduced);

    if (isReduced) {
      setTypedTitle(fullTitle);
      return;
    }

    let isCancelled = false;
    let timerId = null;
    let phase = "typing"; // "typing" | "hold" | "erasing" | "pause"
    let charIndex = 0;

    const runLoop = () => {
      if (isCancelled || document.hidden) return;

      if (phase === "typing") {
        if (charIndex < fullTitle.length) {
          charIndex++;
          setTypedTitle(fullTitle.slice(0, charIndex));
          timerId = setTimeout(runLoop, 70);
        } else {
          phase = "hold";
          timerId = setTimeout(runLoop, 2500);
        }
      } else if (phase === "hold") {
        phase = "erasing";
        timerId = setTimeout(runLoop, 35);
      } else if (phase === "erasing") {
        if (charIndex > 0) {
          charIndex--;
          setTypedTitle(fullTitle.slice(0, charIndex));
          timerId = setTimeout(runLoop, 35);
        } else {
          phase = "pause";
          timerId = setTimeout(runLoop, 600);
        }
      } else if (phase === "pause") {
        phase = "typing";
        charIndex = 0;
        timerId = setTimeout(runLoop, 70);
      }
    };

    // Handle tab visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden && !isCancelled && !isReduced) {
        clearTimeout(timerId);
        runLoop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    runLoop();

    return () => {
      isCancelled = true;
      clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16 space-y-16">
      {/* Editorial Header */}
      <div className="space-y-6 max-w-3xl">
        <div className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-brand-400">
          <span>{APP_NAME}</span>
          <span>/</span>
          <span>Simulation Engine</span>
        </div>

        {/* Layout-stable typing header with invisible text underneath */}
        <div className="relative text-4xl sm:text-6xl font-display font-normal text-slate-50 tracking-tight leading-tight">
          {/* Invisible placeholder reserving height/width */}
          <span className="invisible select-none" aria-hidden="true">
            {fullTitle}
          </span>
          {/* Active overlay typing string */}
          <h1 className="absolute inset-0 top-0 left-0 text-slate-50">
            {reducedMotion ? fullTitle : typedTitle}
            {!reducedMotion && (
              <span className="inline-block w-[3px] h-[0.85em] ml-1 bg-brand-400 animate-pulse align-middle" />
            )}
          </h1>
        </div>

        <p className="text-lg sm:text-xl text-slate-300 font-sans leading-relaxed">
          Transparent, machine-learning powered credit risk evaluation designed to calculate a risk score and clearly communicate key risk factors.
        </p>

        <div className="pt-2 text-xs font-mono text-slate-400 border-l-2 border-slate-700 pl-3">
          {DEMO_DISCLAIMER}
        </div>

        {/* Action CTAs: EXACTLY ONE primary button for authenticated user / admin */}
        <div className="flex flex-wrap items-center gap-4 pt-4">
          {loading ? (
            <div className="h-10 w-32 bg-slate-800 rounded-lg animate-pulse" />
          ) : isAuthenticated ? (
            isAdmin ? (
              <Link
                to="/admin/overview"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <ShieldCheck className="h-4 w-4 text-white" />
                <span>Open admin console</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to={assessmentPath}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <span>Start assessment</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/register"
                className="px-5 py-3 text-slate-300 hover:text-slate-100 text-sm font-medium transition-colors"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* Numbered Steps */}
      <div className="space-y-6">
        <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400">
          How it works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div className="space-y-2 border-t border-slate-700 pt-4">
            <span className="font-mono text-xs text-brand-400 font-bold">01</span>
            <h3 className="text-base font-semibold text-slate-50 font-display">Agree to data use</h3>
            <p className="text-slate-400 leading-relaxed text-xs">
              Review and consent to how your profile parameters are processed for automated credit risk scoring.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-700 pt-4">
            <span className="font-mono text-xs text-brand-400 font-bold">02</span>
            <h3 className="text-base font-semibold text-slate-50 font-display">Fill in application</h3>
            <p className="text-slate-400 leading-relaxed text-xs">
              Provide income, loan requested, employment history, and external credit benchmarks.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-700 pt-4">
            <span className="font-mono text-xs text-brand-400 font-bold">03</span>
            <h3 className="text-base font-semibold text-slate-50 font-display">See factors &amp; risk</h3>
            <p className="text-slate-400 leading-relaxed text-xs">
              Inspect your estimated default risk, risk level, and a breakdown of which factors impacted your score.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* Risk Levels Strip */}
      <div className="space-y-6">
        <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400">
          Risk levels
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RISK_BANDS.map((band) => (
            <div
              key={band.key}
              className="p-5 rounded-lg border border-theme bg-surface space-y-2"
              style={{
                borderTopColor: `rgb(var(${band.cssFillVar || band.cssVar}))`,
                borderTopWidth: "3px",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-bold text-sm tracking-wide"
                  style={{ color: `rgb(var(${band.cssVar}))` }}
                >
                  {band.label}
                </span>
                <span className="text-[10px] font-mono text-theme-muted uppercase">Level</span>
              </div>
              <p className="text-xs text-theme-secondary leading-relaxed">
                {band.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
