import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function PageTransition({ children }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div
      key={location.pathname}
      className="page-transition-enter"
    >
      {children}
    </div>
  );
}
