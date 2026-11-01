import React, { useState, useCallback } from "react";
import { ChatContext } from "./chatContextDef";

export { ChatContext };

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefilled, setPrefilled] = useState({ question: "", topic: null });
  const [history, setHistory] = useState([]); // In-memory last 10 Q&A items

  const openChat = useCallback(({ question = "", topic = null } = {}) => {
    setPrefilled({ question, topic });
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const addMessage = useCallback((msg) => {
    setHistory((prev) => {
      const next = [...prev, msg];
      return next.slice(-10); // keep last 10 messages only
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        setIsOpen,
        openChat,
        closeChat,
        prefilled,
        setPrefilled,
        history,
        addMessage,
        clearHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
