"use client";

import React from "react";
import { useUserInfo } from "@/lib/user-info-context";

export const PublicKeyDisplay: React.FC = () => {
  const { userInfo } = useUserInfo();
  const { publicKey } = userInfo;
  
  const hasPublicKey = !!publicKey;
  const publicKeyShort = publicKey ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}` : null;

  if (!hasPublicKey) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-400">
        No public key available
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
          {publicKey}
        </p>
      </div>
      <div>
        
      </div>
    </div>
  );
};