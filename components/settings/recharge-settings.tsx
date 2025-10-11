"use client";

import React, { useState } from "react";
import { CreatePaymentChannel } from "@/components/bussiness/create-payment-channel";
import { PaymentNow } from "@/components/bussiness/payment-now";

interface PaymentChannelData {
  channelId: string;
  status: number;
  statusText: string;
  sellerSignature: string;
  refundTx: Record<string, unknown>;
  fundingTx: Record<string, unknown>;
  amount: number;
  duration: number;
  createdAt: string;
}

export const RechargeSettings: React.FC = () => {
  const [paymentData, setPaymentData] = useState<PaymentChannelData | null>(null);

  const handleChannelCreated = (data: PaymentChannelData) => {
    setPaymentData(data);
  };

  const handleBackToRecharge = () => {
    setPaymentData(null);
  };

  const handlePaymentComplete = () => {
    setPaymentData(null);
  };

  // If payment data exists, show payment page
  if (paymentData) {
    return (
      <PaymentNow
        paymentData={paymentData}
        onBack={handleBackToRecharge}
        onPaymentComplete={handlePaymentComplete}
      />
    );
  }

  // Otherwise, show channel creation page
  return (
    <CreatePaymentChannel onChannelCreated={handleChannelCreated} />
  );
};
