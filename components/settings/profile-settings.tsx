"use client";
"use client";

import React from "react";
import { useAuth } from "@/components/auth/auth-context";
import { PublicKeyDisplay } from "@/components/public-key-display";
import { UserInfoExample } from "@/components/user-info-example";

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();

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

     

          {/* User Info State Management Example */}
          {/* <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
            <div className="p-5">
              <UserInfoExample />
            </div>
          </div> */}
        </div>
      )}
    </div>
  );
};