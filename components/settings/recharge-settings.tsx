"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUserInfo } from "@/lib/user-info-context";
import { createPaymentChannel, jsonStr } from "@/lib/ckb";

export const RechargeSettings: React.FC = () => {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000); // Default to 1000 CKB
  const [selectedDuration, setSelectedDuration] = useState<number>(1); // Default to 1 day
  const [isCreating, setIsCreating] = useState(false);
  const { userInfo } = useUserInfo();

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
      
      // Get seller public key from state management
      const sellerPublicKey = userInfo.publicKey;
      if (!sellerPublicKey) {
        alert("Seller public key not available. Please try refreshing.");
        return;
      }
      
      // Get buyer private key from localStorage
      const buyerPrivateKey = localStorage.getItem("private_key");
      if (!buyerPrivateKey) {
        alert("Please connect your CKB wallet first in Payment Channel settings.");
        return;
      }
      
      console.log("Creating payment channel with:", {
        sellerPublicKey,
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
        const response = await fetch('/api/channel/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: jsonStr({
            refundTx: result.refundTx,
            amount: selectedAmount,
            day: selectedDuration,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create payment channel on server');
        }
        
        const apiResult = await response.json();
        console.log('Payment channel created successfully:', apiResult);
        alert(`Payment channel created successfully!\nChannel ID: ${apiResult.data.channelId}`);
      } else {
        alert('Payment channel transaction created, but no refund transaction returned.');
      }
    } catch (error) {
      console.error("Error creating payment channel:", error);
      alert("Failed to create payment channel: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsCreating(false);
    }
  };

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
              variant={selectedDuration === duration.value ? "default" : "outline"}
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
        <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {selectedAmount}
              </div>
              <div className="text-sm font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                CKB
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {tokenAmount.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-green-800 dark:text-green-300 uppercase tracking-wider">
                Tokens
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {selectedDuration}
              </div>
              <div className="text-sm font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wider">
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
          className="w-full px-8 py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          size="lg"
        >
          {isCreating ? "Creating Payment Channel..." : "Create Payment Channel"}
        </Button>
      </div>
    </div>
  );
};