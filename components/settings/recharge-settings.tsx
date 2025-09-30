"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUserInfo } from "@/lib/user-info-context";
import { useAuth } from "@/components/auth/auth-context";
import { createPaymentChannel, DEVNET_SCRIPTS, jsonStr } from "@/lib/ckb";
import { ccc } from "@ckb-ccc/core";
import { executePayNow } from "@/lib/payment-utils";

interface RefundTransaction {
  inputs?: Array<{
    previousOutput?: {
      txHash?: string;
    };
  }>;
  outputs?: Array<{
    lock?: {
      codeHash?: string;
      hashType?: string;
      args?: string;
    };
  }>;
}

interface PaymentChannelData {
  channelId: string;
  status: number;
  statusText: string;
  sellerSignature: string;
  refundTx: RefundTransaction;
  fundingTx: Record<string, unknown>; // Add fundingTx to the interface
  amount: number;
  duration: number;
  createdAt: string;
}

export const RechargeSettings: React.FC = () => {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000); // Default to 1000 CKB
  const [selectedDuration, setSelectedDuration] = useState<number>(1); // Default to 1 day
  const [isCreating, setIsCreating] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentChannelData | null>(
    null,
  );
  const { userInfo } = useUserInfo();
  const { user } = useAuth();

  const amounts = [
    { value: 1000, label: "1000 CKB" },
    { value: 2000, label: "2000 CKB" },
    { value: 3000, label: "3000 CKB" },
  ];

  const durations = [
    { value: 1, label: "1 day" },
    { value: 3, label: "3 days" },
    { value: 7, label: "7 days" },
  ];

  // Calculate tokens based on pricing: 1000 CKB = 1000 tokens
  const calculateTokens = (ckbAmount: number) => {
    return ckbAmount; // 1:1 ratio
  };

  const tokenAmount = calculateTokens(selectedAmount);

  const handleCreatePaymentChannel = async () => {
    try {
      setIsCreating(true);

      // Get seller public key from user auth data (server's public key)
      const sellerPublicKey = user?.serverPublicKey;
      if (!sellerPublicKey) {
        alert("Server public key not available. Please try refreshing.");
        return;
      }

      // Get buyer private key from localStorage
      const buyerPrivateKey = localStorage.getItem("private_key");
      if (!buyerPrivateKey) {
        alert(
          "Please connect your CKB wallet first in Payment Channel settings.",
        );
        return;
      }

      console.log("Creating payment channel with:", {
        sellerPublicKey,
        buyerPublicKey: userInfo.publicKey, // This is the buyer's public key
        amount: selectedAmount,
        duration: selectedDuration,
        tokens: tokenAmount,
      });

      // Call the createPaymentChannel function
      const result = await createPaymentChannel({
        sellerPublicKey,
        buyerPrivateKey,
        amount: selectedAmount,
        day: selectedDuration,
      });

      // Call the server API to get seller signature
      if (result && result.refundTx) {
        const response = await fetch("/api/channel/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: jsonStr({
            refundTx: result.refundTx,
            fundingTx: result.fundingTx,
            amount: selectedAmount,
            day: selectedDuration,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to create payment channel on server",
          );
        }

        const apiResult = await response.json();
        console.log("Payment channel created successfully:", apiResult);

        // Set payment data to show payment page
        setPaymentData({
          ...apiResult.data,
          refundTx: result.refundTx,
          fundingTx: apiResult.data.fundingTx, // Include fundingTx from API response
        });
      } else {
        alert(
          "Payment channel transaction created, but no refund transaction returned.",
        );
      }
    } catch (error) {
      console.error("Error creating payment channel:", error);
      alert(
        "Failed to create payment channel: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackToRecharge = () => {
    setPaymentData(null);
  };

  const handlePayment = async () => {
    try {
      if (!paymentData) {
        alert("No payment data available");
        return;
      }

      // Use the shared payment utility
      const result = await executePayNow({
        channelId: paymentData.channelId,
        fundingTx: paymentData.fundingTx,
        amount: paymentData.amount,
      });

      if (result.success) {
        alert(
          `Payment successful and channel activated!\n` +
          `Transaction Hash: ${result.txHash}\n` +
          `Channel Status: ${result.channelStatus}`
        );
        
        // Navigate back to channel selection
        setPaymentData(null);
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert(
        "Payment failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  };

  // Extract refund transaction info
  const getRefundTxInfo = (refundTx: RefundTransaction) => {
    try {
      // Get input transaction hash from first input
      const inputTxHash = refundTx.inputs?.[0]?.previousOutput?.txHash || "N/A";

      // Get buyer address from first output lock script
      let buyerAddress = "N/A";
      if (refundTx.outputs?.[0]?.lock) {
        try {
          const lockScript = refundTx.outputs[0].lock;
          // Create a mock client for address conversion
          const cccClient = new ccc.ClientPublicTestnet({
            url: "http://localhost:28114",
            scripts: DEVNET_SCRIPTS,
          });
          const address = ccc.Address.fromScript(
            lockScript as ccc.Script,
            cccClient,
          ).toString();
          buyerAddress = address;
        } catch (addressError) {
          console.error(
            "Error converting lock script to address:",
            addressError,
          );
          // Fallback to lock args or user public key
          buyerAddress =
            refundTx.outputs[0].lock.args || userInfo.publicKey || "N/A";
        }
      } else {
        buyerAddress = userInfo.publicKey || "N/A";
      }

      return {
        inputTxHash,
        buyerAddress,
      };
    } catch (error) {
      console.error("Error parsing refund transaction:", error);
      return {
        inputTxHash: "N/A",
        buyerAddress: userInfo.publicKey || "N/A",
      };
    }
  };

  // If payment data exists, show payment page
  if (paymentData) {
    const refundTxInfo = getRefundTxInfo(paymentData.refundTx);
    const tokenAmount = calculateTokens(paymentData.amount);

    return (
      <div className="flex h-[600px] w-full max-w-none flex-col">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-scroll p-8">
          {/* Header with back button */}
          <div className="mb-6 flex items-center">
            <Button
              variant="ghost"
              onClick={handleBackToRecharge}
              className="mr-4 p-2"
            >
              ← Back
            </Button>
            <h3 className="text-lg font-semibold">Payment Required</h3>
          </div>

          {/* Product Information */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
              Product Information
            </h4>
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {paymentData.amount}
                  </div>
                  <div className="text-sm font-medium tracking-wider text-blue-800 uppercase dark:text-blue-300">
                    CKB
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {tokenAmount.toLocaleString()}
                  </div>
                  <div className="text-sm font-medium tracking-wider text-green-800 uppercase dark:text-green-300">
                    Tokens
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {paymentData.duration}
                  </div>
                  <div className="text-sm font-medium tracking-wider text-purple-800 uppercase dark:text-purple-300">
                    Day{paymentData.duration > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deposit Information */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
              Deposit Information
            </h4>
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">
                  Input Transaction Hash
                </label>
                <div className="rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm break-all dark:border-slate-600 dark:bg-slate-900">
                  {refundTxInfo.inputTxHash}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">
                  output Wallet Address
                </label>
                <div className="rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm break-all dark:border-slate-600 dark:bg-slate-900">
                  {refundTxInfo.buyerAddress}
                </div>
              </div>
            </div>
          </div>

          {/* Seller Signature */}
          <div className="mb-8">
            <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
              Seller Signature
            </h4>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm break-all dark:border-slate-600 dark:bg-slate-900">
                {paymentData.sellerSignature}
              </div>
            </div>
          </div>

          {/* Add bottom padding to prevent content overlap with fixed button */}
          <div className="pb-4">
            {/* Channel Information */}
            <div className="text-center text-sm text-slate-500 dark:text-slate-400">
              <p>Channel ID: {paymentData.channelId}</p>
              <p>Status: {paymentData.statusText}</p>
              <p>Created: {new Date(paymentData.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Fixed Payment Button at bottom */}
        <div className="border-t bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <Button
            onClick={handlePayment}
            className="hover:shadow-3xl w-full bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-6 text-xl font-semibold shadow-2xl transition-all duration-300 hover:scale-102 hover:from-green-700 hover:to-emerald-700"
            size="lg"
          >
            🔒 Pay Now - {paymentData.amount} CKB
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none p-8">
      <h3 className="mb-6 text-lg font-semibold">Recharge</h3>

      {/* Amount Selection */}
      <div className="mb-8">
        <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
          Select Amount
        </h4>
        <div className="flex gap-4">
          {amounts.map((amount) => (
            <Button
              key={amount.value}
              variant={selectedAmount === amount.value ? "default" : "outline"}
              className="min-w-[120px]"
              onClick={() => setSelectedAmount(amount.value)}
            >
              {amount.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Duration Selection */}
      <div className="mb-8">
        <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
          Select Duration
        </h4>
        <div className="flex gap-4">
          {durations.map((duration) => (
            <Button
              key={duration.value}
              variant={
                selectedDuration === duration.value ? "default" : "outline"
              }
              className="min-w-[100px]"
              onClick={() => setSelectedDuration(duration.value)}
            >
              {duration.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Create Payment Channel Button */}
      <div className="mb-8">
        {/* Highlighted Summary */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {selectedAmount}
              </div>
              <div className="text-sm font-medium tracking-wider text-blue-800 uppercase dark:text-blue-300">
                CKB
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {tokenAmount.toLocaleString()}
              </div>
              <div className="text-sm font-medium tracking-wider text-green-800 uppercase dark:text-green-300">
                Tokens
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {selectedDuration}
              </div>
              <div className="text-sm font-medium tracking-wider text-purple-800 uppercase dark:text-purple-300">
                Day{selectedDuration > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Rate: <span className="font-semibold">1 CKB = 1 Token</span>
            </p>
          </div>
        </div>

        <Button
          onClick={handleCreatePaymentChannel}
          disabled={isCreating}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          size="lg"
        >
          {isCreating
            ? "Creating Payment Channel..."
            : "Create Payment Channel"}
        </Button>
      </div>
    </div>
  );
};
