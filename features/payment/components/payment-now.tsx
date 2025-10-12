"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { PaymentSummary } from "@/features/payment/components/payment-summary";
import { DataDisplay } from "@/components/shared/data-display";
import { executePayNow, PaymentResult } from "@/lib/shared/ckb";

interface PaymentChannelData {
  channelId: string;
  status: number;
  statusText: string;
  sellerSignature: string;
  refundTx: unknown;
  fundingTx: unknown;
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
  const handlePayment = async () => {
    try {
      // Use the shared payment utility
      const result = await executePayNow({
        channelId: paymentData.channelId,
        fundingTx: paymentData.fundingTx as Record<string, unknown>,
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
          <PaymentSummary
            amount={paymentData.amount}
            duration={paymentData.duration}
            showRate={true}
          />
        </div>

        {/* Refund Transaction */}
        <DataDisplay
          title="Refund Transaction"
          data={paymentData.refundTx}
        />

        {/* Funding Transaction */}
        <DataDisplay
          title="Funding Transaction"
          data={paymentData.fundingTx}
        />

        {/* Seller Signature */}
        <DataDisplay
          title="Seller Signature"
          data={paymentData.sellerSignature}
        />

        {/* Add bottom padding to prevent content overlap with fixed button */}
        <div className="pb-4">
          {/* Channel Information */}
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <p>Channel ID: {paymentData.channelId}</p>
            <p>Status: {paymentData.statusText}</p>
            <p>Created: {new Date(paymentData.createdAt).toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Asia/Shanghai'
            })}</p>
          </div>
        </div>
      </div>

      {/* Fixed Payment Button at bottom */}
      <div className="border-t bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <Button
          onClick={handlePayment}
          className="w-full bg-slate-900 px-8 py-6 text-xl font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
          size="lg"
        >
          🔒 Pay Now - {paymentData.amount} CKB
        </Button>
      </div>
    </div>
  );
};