"use client";
"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { PublicKeyDisplay } from "@/components/public-key-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEVNET_SCRIPTS } from "@/lib/ckb";

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const [privateKey, setPrivateKey] = useState("");
  const [ckbAddress, setCkbAddress] = useState("");
  const [balance, setBalance] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInputs, setShowInputs] = useState(true);

  useEffect(() => {
    // Check if private key exists in localStorage
    const storedPrivateKey = localStorage.getItem("private_key");
    if (storedPrivateKey) {
      setPrivateKey(storedPrivateKey);
      setShowInputs(false);
      generateCkbAddress(storedPrivateKey);
    }
  }, []);

  const generateCkbAddress = async (privKey: string) => {
    try {
      setIsLoading(true);

      // Import CKB-CCC dynamically to avoid SSR issues
      const { ccc } = await import("@ckb-ccc/core");

      // Build client and signer
      const client = new ccc.ClientPublicTestnet({
        url: "http://localhost:28114",
        scripts: DEVNET_SCRIPTS,
      });
      const signer = new ccc.SignerCkbPrivateKey(client, privKey);

      // Get recommended address
      const address = await signer.getRecommendedAddress();
      setCkbAddress(address);

      // Get balance
      const addressObj = await ccc.Address.fromString(address, client);
      const script = addressObj.script;
      const balanceBI = await client.getBalance([script]);
      const balanceInCKB = ccc.fixedPointToString(balanceBI);
      setBalance(balanceInCKB);
    } catch (error) {
      console.error("Error generating CKB address:", error);
      // If error occurs, show inputs again
      setShowInputs(true);
      localStorage.removeItem("private_key");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectCkb = async () => {
    if (!privateKey.trim()) {
      alert("Please enter a private key");
      return;
    }

    try {
      // Store private key in localStorage
      localStorage.setItem("private_key", privateKey);
      setShowInputs(false);

      // Generate CKB address
      await generateCkbAddress(privateKey);
    } catch (error) {
      console.error("Error connecting CKB:", error);
      alert("Failed to connect CKB. Please check your private key.");
    }
  };

  return (
    <div className="w-full max-w-none h-[600px] overflow-y-scroll p-8">
      <h3 className="mb-6 text-lg font-semibold">User Info</h3>
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

            {/* Email - only show if user has email (legacy users) */}
            {user.email && (
              <>
                <div className="border-t border-gray-200/70 dark:border-slate-700/60" />
                <div className="flex items-center justify-between p-5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {user.email}
                  </p>
                </div>
              </>
            )}

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

            <div className="border-t border-gray-200/70 dark:border-slate-700/60" />

            {/* User Public Key */}
            <div className="flex items-center justify-between p-5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Public Key
              </label>
              <p className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all max-w-xs text-right">
                {user.public_key || "N/A"}
              </p>
            </div>
          </div>

          {/* CKB Address Section */}
          <h3 className="mb-6 text-lg font-semibold">CKB Address</h3>
          <div className="mb-8 rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
            <div className="p-6">
              {showInputs ? (
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Private Key
                    </label>
                    <Input
                      type="password"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder="Enter your private key"
                      className="w-full"
                    />
                  </div>
                  <Button
                    onClick={handleConnectCkb}
                    disabled={isLoading || !privateKey.trim()}
                    className="mb-0"
                  >
                    {isLoading ? "Connecting..." : "Connect CKB"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {isLoading ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Generating address...
                    </p>
                  ) : ckbAddress ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
                          Address
                        </label>
                        <p className="text-sm font-medium break-all text-slate-700 dark:text-slate-300">
                          {ckbAddress}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
                          Balance
                        </label>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {balance} CKB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Failed to generate address
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Server Information Section */}
          <h3 className="mb-6 text-lg font-semibold">Server Information</h3>
          <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
            <div className="p-5">
              <PublicKeyDisplay />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};