"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectionGroup } from "@/components/bussiness/selection-group";
import { useAuth } from "@/app/context/auth-context";
import { createPaymentChannel, jsonStr } from "@/lib/ckb";
import { channel } from "@/lib/api";

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

interface CreatePaymentChannelProps {
  onChannelCreated: (paymentData: PaymentChannelData) => void;
}

const amounts = [
  { value: 100000, label: "100000 CKB" },
  { value: 200000, label: "200000 CKB" },
  { value: 300000, label: "300000 CKB" },
];

const durations = [
  { value: 30, label: "30s" },
  { value: 86400, label: "1 day" },
  { value: 259200, label: "3 days" },
  { value: 604800, label: "7 days" },
];

// Calculate tokens based on pricing: 1 CKB = 0.01 Token
const calculateTokens = (ckbAmount: number) => {
  return ckbAmount * 0.01;
};

export const CreatePaymentChannel: React.FC<CreatePaymentChannelProps> = ({
  onChannelCreated,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(100000);
  const [selectedDuration, setSelectedDuration] = useState<number>(86400);
  const [isCreating, setIsCreating] = useState(false);
  const { user, privateKey } = useAuth();

  const tokenAmount = calculateTokens(selectedAmount);

  const handleCreatePaymentChannel = async () => {
    try {
      setIsCreating(true);

      // Get seller public key from user auth data (server's public key)
      const sellerPublicKey = user?.serverPublicKey;

      // Call the createPaymentChannel function
      const result = await createPaymentChannel({
        sellerPublicKey: sellerPublicKey!,
        buyerPrivateKey: privateKey!,
        amount: selectedAmount,
        seconds: selectedDuration,
      });

      // Call the server API to get seller signature
      const apiResult = await channel.create({
        refundTx: result.refundTx,
        fundingTx: result.fundingTx,
        amount: selectedAmount,
        seconds: selectedDuration,
      });

      console.log("Payment channel created successfully:", apiResult);

      // Pass payment data to parent component
      onChannelCreated({
        ...apiResult.data,
        refundTx: result.refundTx,
        fundingTx: apiResult.data.fundingTx,
      });
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

  return (
    <div className="w-full max-w-none p-8">
      <h3 className="mb-6 text-lg font-semibold">Recharge</h3>

      {/* Amount Selection */}
      <SelectionGroup
        title="Select Amount"
        options={amounts}
        selectedValue={selectedAmount}
        onValueChange={setSelectedAmount}
      />

      {/* Duration Selection */}
      <SelectionGroup
        title="Select Duration"
        options={durations}
        selectedValue={selectedDuration}
        onValueChange={setSelectedDuration}
        buttonClassName="min-w-[100px]"
      />

      {/* Create Payment Channel Button */}
      <div className="mb-8">
        {/* Highlighted Summary */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {selectedAmount}
              </div>
              <div className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
                CKB
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {tokenAmount.toLocaleString()}
              </div>
              <div className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
                Tokens
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">
                {selectedDuration >= 86400
                  ? Math.floor(selectedDuration / 86400)
                  : `${selectedDuration}s`}
              </div>
              <div className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
                {selectedDuration >= 86400
                  ? Math.floor(selectedDuration / 86400) > 1
                    ? "Days"
                    : "Day"
                  : "Seconds"}
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Rate:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                1 CKB = 0.01 Token
              </span>
            </p>
          </div>
        </div>

        <Button
          onClick={handleCreatePaymentChannel}
          disabled={isCreating}
          className="w-full bg-slate-900 px-8 py-6 text-xl font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
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
