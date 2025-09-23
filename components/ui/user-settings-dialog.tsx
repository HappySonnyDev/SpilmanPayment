"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, BarChart3, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-context";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "profile" | "usage" | "billing";
}

export const UserSettingsDialog: React.FC<UserSettingsDialogProps> = ({
  open,
  onOpenChange,
  defaultTab = "profile",
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { user } = useAuth();

  // Update activeTab when defaultTab changes
  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, open]);

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "usage", label: "Usage", icon: BarChart3 },
    { id: "billing", label: "Payment Channel", icon: CreditCard },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="w-full max-w-none p-8">
            <h3 className="mb-6 text-lg font-semibold">Profile Settings</h3>
            {user && (
              <div className="space-y-6">
                {/* User Info Box */}
                <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
                  {/* Username */}
                  <div className="flex items-center justify-between p-5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Username
                    </label>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {user.username}
                    </p>
                  </div>

                  <div className="border-t border-gray-200/70 dark:border-slate-700/60" />

                  {/* Email */}
                  <div className="flex items-center justify-between p-5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Email Address
                    </label>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {user.email}
                    </p>
                  </div>

                  <div className="border-t border-gray-200/70 dark:border-slate-700/60" />

                  {/* Account Created */}
                  <div className="flex items-center justify-between p-5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Account Created
                    </label>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="border-t border-gray-200/70 dark:border-slate-700/60" />

                  {/* Account Status */}
                  <div className="flex items-center justify-between p-5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Account Status
                    </label>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full shadow-sm ${
                          user.is_active
                            ? "bg-emerald-500 shadow-emerald-500/30"
                            : "bg-red-500 shadow-red-500/30"
                        }`}
                      ></div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {user.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "usage":
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
              {/* <h3 className="mb-6 text-lg font-semibold">Credits Log</h3> */}

              {/* Table */}
              {/* <div className="overflow-hidden rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
                <table className="w-full">
                  <thead className="bg-gray-100/50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                        Acquired On
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                        Expires On
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">
                        Token
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/50 dark:divide-slate-700/50">
                    <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        2024-01-01
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        2024-01-31
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        10,000
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        2024-02-01
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        2024-02-29
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        15,000
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        2024-03-01
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        2024-03-31
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-slate-600 dark:text-slate-400">
                        12,500
                      </td>
                    </tr>
                 
                  </tbody>
                </table>
              </div> */}
            </div>
          </div>
        );
      case "billing":
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
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[600px] w-[1000px] max-w-[1000px] overflow-hidden p-0"
        style={{ width: "1000px", maxWidth: "1000px" }}
      >
        <div className="flex h-full w-full">
          {/* Left Sidebar */}
          <div className="w-56 flex-shrink-0 border-r bg-muted/30 p-4">
            <DialogHeader className="mb-6">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>

            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      activeTab === tab.id &&
                        "bg-primary text-primary-foreground",
                    )}
                    onClick={() =>
                      setActiveTab(tab.id as "profile" | "usage" | "billing")
                    }
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Right Content */}
          <div className="min-w-0 flex-1 overflow-auto">{renderContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
