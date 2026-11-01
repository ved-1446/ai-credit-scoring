import React from "react";

export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-theme pb-4 mb-6">
      <div className="space-y-1">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary tracking-tight font-display">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>
        {description && (
          <p className="text-xs text-theme-muted max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center space-x-2 flex-shrink-0 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
