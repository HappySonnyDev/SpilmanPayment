"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/context/auth-context";
import { DEVNET_SCRIPTS } from "@/lib/ckb";
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
  fundingTx: Record<string, unknown>;
  amount: number;
  duration: number;
  createdAt: string;
}

interface PaymentNowProps {
  paymentData: PaymentChannelData;
  onBack: () => void;
  onPaymentComplete: () => void;
}

export const PaymentNow: React.FC<PaymentNowProps> = ({
  paymentData,
  onBack,
  onPaymentComplete,
}) => {
  const { user } = useAuth();

  // Calculate tokens based on pricing: 1 CKB = 0.01 Token
  const calculateTokens = (ckbAmount: number) => {
    return ckbAmount * 0.01;
  };

  const handlePayment = async () => {
    try {
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
            `Channel Status: ${result.channelStatus}`,
        );

        onPaymentComplete();
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
            refundTx.outputs[0].lock.args || user?.public_key || "N/A";
        }
      } else {
        buyerAddress = user?.public_key || "N/A";
      }

      return {
        inputTxHash,
        buyerAddress,
      };
    } catch (error) {
      console.error("Error parsing refund transaction:", error);
      return {
        inputTxHash: "N/A",
        buyerAddress: user?.public_key || "N/A",
      };
    }
  };

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
            onClick={onBack}
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
                  {paymentData.duration >= 86400
                    ? `${Math.floor(paymentData.duration / 86400)}`
                    : `${paymentData.duration}s`}
                </div>
                <div className="text-sm font-medium tracking-wider text-purple-800 uppercase dark:text-purple-300">
                  {paymentData.duration >= 86400
                    ? Math.floor(paymentData.duration / 86400) > 1
                      ? "Days"
                      : "Day"
                    : "Seconds"}
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
};