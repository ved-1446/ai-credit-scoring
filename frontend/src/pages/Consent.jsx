import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useChat } from "../context/useChat";
import { ShieldCheck, CheckSquare, Square, ArrowRight, AlertCircle, Info, HelpCircle } from "lucide-react";

export function Consent() {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { openChat } = useChat();

  const handleContinue = async () => {
    if (!accepted) {
      setError("You must accept the terms to proceed with credit scoring.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const data = await api.consent({ policy_version: "v1", accepted: true });
      localStorage.setItem("consent_id", data.consent_id);
      navigate("/apply");
    } catch (err) {
      setError(err.message || "Failed to record consent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAskPrivacy = () => {
    openChat({
      question: "How is my privacy and consent data handled?",
      topic: "privacy_and_consent",
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 pb-24">
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-8 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 text-brand-400">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-50 font-display">Data Consent & Privacy Agreement</h1>
              <p className="text-xs text-slate-400 mt-0.5">Policy Version 1.0 (v1)</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAskPrivacy}
            className="inline-flex items-center space-x-1.5 text-xs text-brand-400 hover:text-brand-300 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Have a question about this? Ask</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-6 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400">
            This is a demo. Please use made-up details, not your real personal or financial information.
          </p>
          <p>
            Before submitting your application for automated credit risk assessment, please review and acknowledge how your data will be processed:
          </p>
          <ul className="space-y-3 list-disc list-inside text-slate-300">
            <li>
              <strong className="text-slate-50">Educational & Simulation Purpose:</strong> This application provides an educational credit risk simulation. Risk levels are simulated estimates for demonstration purposes, not real-world financial credit approvals or denials.
            </li>
            <li>
              <strong className="text-slate-50">Input Processing:</strong> Information you submit (including income, employment duration, loan amount, and demographic factors) will be used to calculate an estimated default risk and explain which main factors affected the score.
            </li>
            <li>
              <strong className="text-slate-50">Fairness & Demographic Tracking:</strong> The system monitors consistency across demographic groups to ensure transparent and reliable evaluation.
            </li>
            <li>
              <strong className="text-slate-50">Storage & Retention:</strong> Your submitted information and assessment results are securely stored to let you review past evaluations and test different financial scenarios.
            </li>
            <li>
              <strong className="text-slate-50">Optional Help Assistant:</strong> Questions you type are processed by an external AI service.
            </li>
          </ul>
        </div>

        <div className="pt-2">
          <label
            onClick={() => setAccepted(!accepted)}
            className="flex items-start space-x-3 p-4 rounded-xl border border-slate-700 bg-slate-900/40 hover:bg-slate-900/80 cursor-pointer transition-colors"
          >
            <button
              type="button"
              className="mt-0.5 text-brand-400 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                setAccepted(!accepted);
              }}
            >
              {accepted ? (
                <CheckSquare className="h-5 w-5 text-brand-500" />
              ) : (
                <Square className="h-5 w-5 text-slate-500" />
              )}
            </button>
            <span className="text-sm font-medium text-slate-200 select-none">
              I have read, understood, and accept the automated credit assessment policy (v1) and consent to the processing of my application data.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <div className="flex items-center text-xs text-slate-400 space-x-1.5">
            <Info className="h-4 w-4 text-slate-500" />
            <span>Consent is recorded with your secure account ID</span>
          </div>

          <button
            onClick={handleContinue}
            disabled={!accepted || loading}
            className="flex items-center space-x-2 py-2.5 px-6 bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-brand-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Continue to Application</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

