"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectionGroup } from "@/components/bussiness/selection-group";
import { useAuth } from "@/app/context/auth-context";
import { createPaymentChannel, jsonStr } from "@/lib/ckb";
import { channel } from "@/lib/api";
import { PaymentSummary } from "@/components/bussiness/payment-summary";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

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
  { value: 120, label: "120s" },
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
        // The API returns the corrected refund transaction with fees deducted
        // No need to override refundTx since apiResult.data already contains the correct one
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
    <TooltipProvider>
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
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Select Duration
            </h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="right">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">30s:</span> Go to admin panel and run <code className="rounded  px-1 text-xs">check-expired-channels</code> to reclaim deposit.
                  </div>
                  <div>
                    <span className="font-medium">120s:</span> Make off-chain transaction, then run <code className="rounded  px-1 text-xs ">auto-settle-expiring</code> for auto-settlement.
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <SelectionGroup
            title=""
            options={durations}
            selectedValue={selectedDuration}
            onValueChange={setSelectedDuration}
            buttonClassName="min-w-[100px]"
          />
        </div>

      {/* Create Payment Channel Button */}
      <div className="mb-8">
        {/* Highlighted Summary */}
        <div className="mb-6">
          <PaymentSummary
            amount={selectedAmount}
            duration={selectedDuration}
            showRate={true}
          />
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
  </TooltipProvider>
);
};
