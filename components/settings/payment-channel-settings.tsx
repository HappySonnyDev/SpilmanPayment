"use client";
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEVNET_SCRIPTS } from "@/lib/ckb";
import { PublicKeyDisplay } from "../public-key-display";

export const PaymentChannelSettings: React.FC = () => {
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
    <div className="w-full max-w-none p-8">
      <h3 className="mb-6 text-lg font-semibold">CKB Address</h3>
      {/* CKB Address Section */}
      <div className="mb-8 rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
        <div className="p-6">
          {/* <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            CKB Address
          </h4> */}

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
      <h3 className="mb-6 text-lg font-semibold"> Server Information</h3>
      {/* Server Public Key Section */}
      <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
        <div className="p-5">
          {/* <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            Server Information
          </h4> */}
          <PublicKeyDisplay />
        </div>
      </div>
      {/* <h3 className="mb-6 text-lg font-semibold">Payment Channel</h3> */}
      {/* <div className="mb-8 rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
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
      </div> */}
      {/* Invoices Section */}
      {/* <div className="space-y-4"> */}
        {/* <h3 className="mb-6 text-lg font-semibold">Invoices</h3> */}

        {/* Table */}
        {/* <div className="overflow-hidden rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
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
        </div> */}
      {/* </div> */}
    </div>
  );
};
