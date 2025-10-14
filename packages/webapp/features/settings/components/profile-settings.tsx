"use client";

import React from "react";
import { useAuth } from "@/features/auth/components/auth-context";
import { InfoCard } from "@/components/shared/info-card";

export const ProfileSettings: React.FC = () => {
  const { user, ckbAddress, ckbBalance, isCkbLoading } = useAuth();

  return (
    <div className="w-full max-w-none h-[600px] overflow-y-scroll p-8">
      {user && (
        <div className="space-y-6">
          {/* User Info Box */}
          <InfoCard
            title="User Info"
            items={[
              {
                label: "Username",
                value: user.username
              },
              {
                label: "Account Created",
                value: new Date(user.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "Asia/Shanghai"
                })
              },
              {
                label: "Account Status",
                value: (
                  <div className="flex items-center space-x-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full shadow-sm ${
                        user.is_active
                          ? "bg-emerald-500 shadow-emerald-500/30"
                          : "bg-red-500 shadow-red-500/30"
                      }`}
                    ></div>
                    <span>{user.is_active ? "Active" : "Inactive"}</span>
                  </div>
                )
              },
              {
                label: "Public Key",
                value: user.public_key || "N/A",
                className: "font-mono break-all max-w-xs text-right"
              }
            ]}
          />

          {/* CKB Address Section */}
          <InfoCard
            title="CKB Address"
            items={[
              {
                label: "Address", 
                value: ckbAddress || (isCkbLoading ? "Loading..." : "No address available"),
                className: "font-medium break-all max-w-xs text-right"
              },
              {
                label: "Balance",
                value: `${ckbBalance || "0"} CKB`,
                className: "font-semibold"
              }
            ]}
          />

          {/* Server Information Section */}
          <InfoCard
            title="Server Information"
            items={[
              {
                label: "Server Public Key",
                value: user?.serverPublicKey || "No server public key available",
                className: "font-medium break-all max-w-xs text-right"
              }
            ]}
          />
        </div>
      )}
    </div>
  );
};