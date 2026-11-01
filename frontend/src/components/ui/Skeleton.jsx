import React from "react";

export function Skeleton({ className = "", width, height, rounded = "rounded-lg" }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      style={style}
      className={`bg-slate-800/70 dark:bg-slate-800/80 animate-pulse motion-reduce:animate-none ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}
