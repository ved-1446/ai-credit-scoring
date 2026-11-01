import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/useChat";
import { ROUTE_TOPICS } from "../../constants/chatTopics";
import { X, Send, HelpCircle, Info } from "lucide-react";

export function ChatWidget({ predictionId: propPredictionId }) {
  const { isAdmin } = useAuth();
  const { isOpen, setIsOpen, prefilled, setPrefilled, history, addMessage } = useChat();
  const location = useLocation();

  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [suggestedFollowups, setSuggestedFollowups] = useState([]);
  const [showAboutPopover, setShowAboutPopover] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState(null);
  const [revealedWordCount, setRevealedWordCount] = useState(999);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const revealTimerRef = useRef(null);
  const MAX_CHARS = 300;

  // Determine which route name we are on for suggested questions
  const getRouteKey = () => {
    const path = location.pathname;
    if (path.startsWith("/admin")) return "Admin";
    if (path.startsWith("/result")) return "Result";
    if (path === "/apply") return "Apply";
    if (path === "/consent") return "Consent";
    if (path === "/history") return "History";
    if (path === "/reliability") return "Reliability";
    return null;
  };

  const currentRouteKey = getRouteKey();
  const routeQuestions = currentRouteKey ? (ROUTE_TOPICS[currentRouteKey] || []) : [];

  // Determine prediction_id to send: only on /result/:id or when explicitly passed (e.g. Lab)
  const getActivePredictionId = () => {
    if (propPredictionId) return propPredictionId;
    const match = location.pathname.match(/^\/result\/([a-f0-9-]+)/i);
    return match ? match[1] : null;
  };

  // Helper to measure elapsed time outside render
  const measureElapsed = (start) => Math.round(performance.now() - start);

  // Sync prefilled state when opened without setState inside effect warning
  const [lastPrefilled, setLastPrefilled] = useState(null);
  if (isOpen && prefilled?.question && prefilled !== lastPrefilled) {
    setLastPrefilled(prefilled);
    setMessage(prefilled.question);
    setSelectedTopic(prefilled.topic || null);
    setPrefilled({ question: "", topic: null });
  }

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, isOpen, revealedWordCount]);

  // Keyboard accessibility: ESC key closes widget or popover
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        if (showAboutPopover) {
          setShowAboutPopover(false);
        } else {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showAboutPopover, setIsOpen]);

  // Word-by-word reveal effect for latest bot message
  const startWordReveal = (totalWords, msgIndex) => {
    let current = 0;
    setRevealingIndex(msgIndex);
    setRevealedWordCount(0);

    clearInterval(revealTimerRef.current);
    // 20ms per word, capped at 1.5s (75 iterations)
    const intervalMs = Math.max(15, Math.min(25, 1500 / Math.max(totalWords, 1)));

    revealTimerRef.current = setInterval(() => {
      current++;
      setRevealedWordCount(current);
      if (current >= totalWords) {
        clearInterval(revealTimerRef.current);
        setRevealingIndex(null);
      }
    }, intervalMs);
  };

  const handleSkipReveal = () => {
    clearInterval(revealTimerRef.current);
    setRevealingIndex(null);
    setRevealedWordCount(9999);
  };

  const handleSend = async (questionText = null, topicId = null) => {
    const query = (questionText || message).trim();
    if (!query || loading) return;

    const topicToSend = topicId || selectedTopic || null;
    const predictionIdToSend = getActivePredictionId();
    const sentTime = Number(new Date());
    const startTime = performance.now();

    const userMsg = {
      sender: "user",
      text: query,
      timestamp: sentTime,
    };
    addMessage(userMsg);
    setMessage("");
    setSelectedTopic(null);
    setLoading(true);

    try {
      const payload = {
        message: query.slice(0, MAX_CHARS),
        language,
        prediction_id: predictionIdToSend,
        topic: topicToSend,
      };

      const res = await api.chat(payload);
      const elapsedMs = measureElapsed(startTime);

      const botMsg = {
        sender: "bot",
        text: res.answer,
        source: res.source, // 'gemini' | 'notes' | 'fixed'
        language: res.language,
        language_fallback: res.language_fallback,
        note_ids: res.note_ids || [],
        suggested_topics: res.suggested_topics || [],
        disclaimer: res.disclaimer,
        responseTimeMs: elapsedMs,
      };

      addMessage(botMsg);
      if (res.suggested_topics && res.suggested_topics.length > 0) {
        setSuggestedFollowups(res.suggested_topics);
      }

      // Start reveal animation for new bot message
      const words = (res.answer || "").split(/\s+/).length;
      startWordReveal(words, history.length + 1);
    } catch (err) {
      const elapsedMs = measureElapsed(startTime);
      let errorText = "Could not get an answer right now.";
      if (err.status === 429 || err.code === "RATE_LIMIT_EXCEEDED") {
        errorText = err.message || "You have reached the hourly question limit. Please try again later.";
      }
      addMessage({
        sender: "bot",
        text: errorText,
        source: "error",
        responseTimeMs: elapsedMs,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (item) => {
    setMessage(item.text);
    setSelectedTopic(item.topic || null);
    textareaRef.current?.focus();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating "Ask for help" Pill Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Ask for help"
          className="flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-full shadow-md text-xs font-semibold tracking-wide transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Ask for help</span>
        </button>
      )}

      {/* Floating Chat Panel (440px wide on desktop, full width bottom sheet on phones, max-h 72vh) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ask for help"
          className="w-full sm:w-[440px] max-w-[100vw] h-[520px] max-h-[72vh] fixed bottom-0 right-0 sm:bottom-6 sm:right-6 bg-slate-900 border border-slate-700/80 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[15px] leading-[1.6] animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-[18px] font-bold text-slate-100 font-display leading-tight">
                Ask for help
              </h3>
              <p className="text-xs text-slate-400">Plain answers about this page</p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Language Switcher */}
              <div className="flex items-center space-x-0.5 bg-slate-800 p-0.5 rounded-md border border-slate-700/60 text-xs">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-2 py-0.5 rounded ${language === "en" ? "bg-brand-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("hi")}
                  className={`px-2 py-0.5 rounded ${language === "hi" ? "bg-brand-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"}`}
                >
                  HI
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("mr")}
                  className={`px-2 py-0.5 rounded ${language === "mr" ? "bg-brand-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200"}`}
                >
                  MR
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat window"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Conversation Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[15px]">
            {history.length === 0 ? (
              <div className="py-2 space-y-3">
                <p className="text-slate-300 font-medium text-xs">Suggested questions for this page:</p>
                <div className="flex flex-wrap gap-1.5">
                  {routeQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChipClick(q)}
                      style={{ animationDelay: `${idx * 30}ms` }}
                      className="text-left text-[14px] px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white transition-colors animate-in fade-in"
                    >
                      {q.text}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-slate-400 italic pt-2">
                  Each question is answered on its own.
                </p>
              </div>
            ) : (
              history.map((msg, idx) => {
                const isRevealing = revealingIndex === idx;
                let displayText = msg.text;
                if (isRevealing && msg.sender === "bot") {
                  const words = msg.text.split(/\s+/);
                  displayText = words.slice(0, revealedWordCount).join(" ");
                }

                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {msg.sender === "user" ? (
                      <div className="max-w-[85%] p-2.5 rounded-xl bg-slate-800 text-slate-100 text-[14px] border border-slate-700/60">
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ) : (
                      <div
                        onClick={isRevealing ? handleSkipReveal : undefined}
                        className={`w-full pl-3.5 py-1 border-l-2 text-slate-200 space-y-1.5 ${
                          msg.source === "error"
                            ? "border-rose-500/60 text-rose-300"
                            : "border-brand-500/60"
                        } ${isRevealing ? "cursor-pointer" : ""}`}
                        title={isRevealing ? "Click to skip reveal" : undefined}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>

                        {/* Language Fallback Notice */}
                        {msg.language_fallback && (
                          <p className="text-[12px] text-amber-300/80 italic pt-1">
                            Shown in English because this language is not available for this text.
                          </p>
                        )}

                        {/* Source Note Titles */}
                        {msg.note_ids && msg.note_ids.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1.5 items-center text-[13px] text-slate-400">
                            <span className="font-medium">Sources:</span>
                            {msg.note_ids.map((nid, i) => (
                              <span
                                key={i}
                                className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                              >
                                {nid}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Admin Test Details Line */}
                        {isAdmin && (
                          <div className="pt-1 text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-3 border-t border-slate-800/80">
                            <span>source: <strong className="text-brand-300">{msg.source}</strong></span>
                            <span>latency: {msg.responseTimeMs} ms</span>
                            {msg.language_fallback !== undefined && (
                              <span>fallback: {String(msg.language_fallback)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-2 pl-3.5 border-l-2 border-brand-500/40">
                <span className="inline-block w-2 h-2 rounded-full bg-brand-400 animate-ping" />
                <span className="inline-block w-2 h-2 rounded-full bg-brand-400 animate-ping delay-100" />
                <span className="inline-block w-2 h-2 rounded-full bg-brand-400 animate-ping delay-200" />
                <span className="text-xs text-slate-400 ml-1">Writing answer...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Follow-up / Suggested Topics */}
          {suggestedFollowups.length > 0 && !loading && (
            <div className="px-4 py-1.5 bg-slate-950/60 border-t border-slate-800/60 flex items-center space-x-1.5 overflow-x-auto text-xs no-scrollbar flex-shrink-0">
              <span className="text-slate-400 whitespace-nowrap">Suggested:</span>
              {suggestedFollowups.map((topId, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(null, topId)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-brand-300 font-mono text-xs border border-slate-700 whitespace-nowrap transition-colors"
                >
                  {topId}
                </button>
              ))}
            </div>
          )}

          {/* Input Box & Action */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2 flex-shrink-0">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                placeholder="Ask about your evaluation or factors..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[15px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">
                {message.length} / {MAX_CHARS}
              </span>
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !message.trim()}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-xs transition-colors"
              >
                <span>Send</span>
                <Send className="h-3 w-3" />
              </button>
            </div>

            {/* Quieter Notice in footer with About popover */}
            <div className="relative pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="pr-2 leading-tight">
                Answers are written by AI from this site's help notes and can be wrong.
              </span>
              <button
                type="button"
                onClick={() => setShowAboutPopover(!showAboutPopover)}
                className="text-brand-400 hover:text-brand-300 font-medium underline flex-shrink-0"
              >
                About
              </button>

              {/* Popover */}
              {showAboutPopover && (
                <div className="absolute bottom-6 right-0 w-72 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-200 z-50 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-700 pb-1">
                    <span className="font-semibold text-slate-100 flex items-center space-x-1">
                      <Info className="h-3.5 w-3.5 text-brand-400" />
                      <span>About Help Assistant</span>
                    </span>
                    <button
                      onClick={() => setShowAboutPopover(false)}
                      className="text-slate-400 hover:text-slate-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-300">
                    Questions you type here are processed by an external AI service to write the answer. This app does not save your chat. Answers may contain mistakes.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
