"use client";

import React from "react";

export const UsageSettings: React.FC = () => {
  return (
    <div className="w-full max-w-none p-8">
      <h3 className="mb-6 text-lg font-semibold">Usage</h3>

      {/* Token Credits Box */}
      <div className="mb-8 rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
        <div className="p-6">
          <h4 className="mb-2 text-base font-semibold text-slate-700 dark:text-slate-300">
            Token Credits
          </h4>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Available token quota from January 1st to January 31st
          </p>

          {/* Usage Statistics */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">
              7,500 / 10,000
            </span>
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">
              75%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-slate-600">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: "75%" }}
            ></div>
          </div>
        </div>
      </div>

      {/* Credits Log Section */}
      <div className="space-y-4">
        {/* Future implementation for credits log */}
        {/* Commented out table code can be implemented here when needed */}
      </div>
    </div>
  );
};