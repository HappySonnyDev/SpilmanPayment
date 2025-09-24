"use client";

import React from "react";

export const PaymentChannelSettings: React.FC = () => {
  return (
    <div className="w-full max-w-none p-8">
      <h3 className="mb-6 text-lg font-semibold">Payment Channel</h3>

      {/* Subscription Box */}
      <div className="mb-8 rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="mb-2 text-base font-semibold text-slate-700 dark:text-slate-300">
                ckb1qyqvsv5240xeh85wvnau2eky8pwrhh4jr8ts8vyj37
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                January 1st - January 31st, 2024
              </p>
            </div>
            <button className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none">
              Unsubscribe
            </button>
          </div>
        </div>
      </div>

      {/* Invoices Section */}
      <div className="space-y-4">
        <h3 className="mb-6 text-lg font-semibold">Invoices</h3>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
          <table className="w-full">
            <thead className="bg-gray-100/50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                  CKB Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50 dark:divide-slate-700/50">
              <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                  ckb1qyqvsv5240xeh85...
                </td>
                <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                  2024.01.05 - 2024-02.05
                </td>
                <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                  10,000
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Paid
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};