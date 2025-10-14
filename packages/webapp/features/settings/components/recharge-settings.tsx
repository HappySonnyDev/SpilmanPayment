"use client";

import React, { useState } from "react";
import { CreatePaymentChannel } from "@/features/payment/components/create-payment-channel";
import { PaymentNow } from "@/features/payment/components/payment-now";

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

interface RechargeSettingsProps {
  onNavigateToChannels?: () => void;
}

export const RechargeSettings: React.FC<RechargeSettingsProps> = ({ onNavigateToChannels }) => {
  const [paymentData, setPaymentData] = useState<PaymentChannelData | null>(null);

  const handleChannelCreated = (data: PaymentChannelData) => {
    setPaymentData(data);
  };

  const handleBackToRecharge = () => {
    setPaymentData(null);
  };

  const handlePaymentComplete = () => {
    setPaymentData(null);
    // Navigate to Payment Channel panel after payment completion
    if (onNavigateToChannels) {
      onNavigateToChannels();
    }
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
