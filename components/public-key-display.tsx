"use client";

import React from "react";
import { useAuth } from "@/components/auth/auth-context";

export const PublicKeyDisplay: React.FC = () => {
  const { user } = useAuth();
  const serverPublicKey = user?.serverPublicKey;
  
  const hasServerPublicKey = !!serverPublicKey;

  if (!hasServerPublicKey) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-400">
        No server public key available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          Server Public Key
        </label>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 break-all">
          {serverPublicKey}
        </p>
      </div>
      <div>
        
      </div>
    </div>
  );
};