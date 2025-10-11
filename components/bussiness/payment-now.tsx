"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { PaymentSummary } from "@/components/bussiness/payment-summary";
import { DataDisplay } from "@/components/bussiness/data-display";
import { buildClientAndSigner } from "@/lib/ckb";
import { ccc } from "@ckb-ccc/core";
import { channel } from "@/lib/api";

interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  channelStatus?: string;
}

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
  /**
   * Executes the PayNow payment flow - sends funding transaction and confirms payment
   */
  const executePayNow = async (paymentData: {
    channelId: string;
    fundingTx: Record<string, unknown>;
    amount: number;
  }): Promise<PaymentResult> => {
    try {
      // Get buyer private key from localStorage
      const buyerPrivateKey = localStorage.getItem("private_key");

      if (!buyerPrivateKey) {
        throw new Error("Please connect your CKB wallet first in Profile settings.");
      }

      // Convert fundingTx to CCC transaction
      const fundingTx = ccc.Transaction.from(paymentData.fundingTx);

      // Create CKB client and buyer signer
      const { client: cccClient, signer: buyerSigner } = buildClientAndSigner(buyerPrivateKey);

      console.log("Sending funding transaction:", fundingTx);

      // Send the funding transaction
      const txHash = await buyerSigner.sendTransaction(fundingTx);

      console.log("Funding transaction sent successfully:", txHash);
      
      // Call confirm-funding API to verify transaction and activate channel
      try {
        const confirmResult = await channel.confirmFunding({
          txHash: txHash,
          channelId: paymentData.channelId,
        });
        console.log('Payment confirmed and channel activated:', confirmResult);
        
        return {
          success: true,
          txHash,
          channelStatus: (confirmResult as { data?: { statusText?: string } }).data?.statusText,
        };
        
      } catch (confirmError) {
        console.error('Error confirming payment:', confirmError);
        return {
          success: false,
          txHash,
          error: `Payment sent successfully but could not verify channel activation. Transaction Hash: ${txHash}. Please contact support if needed.`,
        };
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown payment error',
      };
    }
  };

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
            <p>Created: {new Date(paymentData.createdAt).toLocaleString()}</p>
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