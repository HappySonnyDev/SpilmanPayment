"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ccc, hexFrom, WitnessArgs } from "@ckb-ccc/core";
import {
  buildClient,
  executePayNow,
  executeRefund,
  PaymentResult,
} from "@/lib/shared/ckb";
import { channel } from "@/lib/client/api";
import { DataDisplay } from "@/components/shared/data-display";
import {
  usePaymentChannels,
  PaymentChannel,
} from "@/features/payment/hooks/use-payment-channels";
import { formatDbTimeToLocal } from "@/lib/shared/date-utils";
import dayjs from 'dayjs';

import { ChevronDown } from "lucide-react";
import { useAuth } from "@/features/auth/components/auth-context";

export const PaymentChannelSettings: React.FC = () => {
  const { channels, isLoading, refetch } = usePaymentChannels();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(
    new Set(),
  );
  const { user } = useAuth();

  // Extract transaction information from refund transaction data
  // Note: This function is kept for potential future use but currently unused
  // since we now display the full transaction data using DataDisplay component

  const toggleChannelExpansion = (channelId: string) => {
    const newExpanded = new Set(expandedChannels);
    if (newExpanded.has(channelId)) {
      newExpanded.delete(channelId);
    } else {
      newExpanded.add(channelId);
    }
    setExpandedChannels(newExpanded);
  };

  const handlePayNow = async (channel: PaymentChannel) => {
    try {
      setActionLoading(channel.channelId);

      // Check if funding transaction data exists
      if (!channel.fundingTxData) {
        alert("No funding transaction data available for this channel.");
        return;
      }

      // Use the shared payment utility
      const result = await executePayNow({
        channelId: channel.channelId,
        fundingTx: JSON.parse(channel.fundingTxData),
        amount: channel.amount,
      });

      if (result.success) {
        alert(
          `Payment successful and channel activated!\n` +
            `Transaction Hash: ${result.txHash}\n` +
            `Channel Status: ${result.channelStatus}`,
        );

        // Refresh the channels list to show updated status
        await refetch();
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert(
        "Payment failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleChannelAction = async (
    channelId: string,
    action: "activate" | "settle",
  ) => {
    try {
      setActionLoading(channelId);

      if (action === "settle") {
        // Call the settlement API using the shared API function
        const result = await channel.settle({
          channelId,
        });

        alert(
          `Channel settled successfully!\n` +
            `Transaction Hash: ${result.txHash}\n` +
            `Channel Status: ${result.channelStatus}`,
        );

        // Refresh the channels list
        await refetch();
      }
    } catch (error) {
      console.error(`Error ${action}ing channel:`, error);
      alert(
        `Failed to ${action} channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (channelId: string) => {
    try {
      setActionLoading(channelId);

      const result = await channel.setDefault({
        channelId,
      });

      alert(`Channel set as default successfully!`);

      // Refresh the channels list
      await refetch();
      
      // Emit event to notify Payment Status and Payment History
      const defaultChannelChangedEvent = new CustomEvent('defaultChannelChanged', {
        detail: { channelId }
      });
      window.dispatchEvent(defaultChannelChangedEvent);
    } catch (error) {
      console.error("Error setting default channel:", error);
      alert(
        "Failed to set as default: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdrawDeposit = async (channel: PaymentChannel) => {
    try {
      setActionLoading(channel.channelId);

      // Check if refund transaction data and seller signature exist
      if (!channel.refundTxData || !channel.sellerSignature) {
        alert(
          "No refund transaction data or seller signature available for this channel.",
        );
        return;
      }

      // Use the shared refund utility
      const result = await executeRefund({
        refundTxData: channel.refundTxData,
        sellerSignature: channel.sellerSignature,
        durationSeconds: channel.durationSeconds,
        durationDays: channel.durationDays,
      });

      if (result.success) {
        alert(
          `Deposit withdrawn successfully!\n` +
            `Transaction Hash: ${result.txHash}\n` +
            `You can check the transaction status on CKB Explorer.`,
        );
      } else {
        alert(`Deposit withdrawal failed: ${result.error}`);
      }

      // Refresh the channels list
      await refetch();
    } catch (error) {
      console.error("Deposit withdrawal error:", error);

      // Provide more specific error messages
      let errorMessage = "Failed to withdraw deposit: ";
      if (error instanceof Error) {
        if (error.message.includes("time")) {
          errorMessage +=
            "Channel timelock may not have expired yet. Please wait for the timelock period to complete.";
        } else if (error.message.includes("signature")) {
          errorMessage +=
            "Signature validation failed. Please check your private key and seller signature.";
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += "Unknown error";
      }

      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: number, statusText: string) => {
    const baseClasses =
      "inline-flex rounded-full px-3 py-1 text-xs font-medium";

    switch (status) {
      case 1: // Inactive
        return (
          <span
            className={`${baseClasses} bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300`}
          >
            {statusText}
          </span>
        );
      case 2: // Active
        return (
          <span
            className={`${baseClasses} bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300`}
          >
            {statusText}
          </span>
        );
      case 3: // Invalid
        return (
          <span
            className={`${baseClasses} bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300`}
          >
            {statusText}
          </span>
        );
      case 4: // Settled
        return (
          <span
            className={`${baseClasses} bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300`}
          >
            {statusText}
          </span>
        );
      case 5: // Expired
        return (
          <span
            className={`${baseClasses} bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300`}
          >
            {statusText}
          </span>
        );
      default:
        return (
          <span
            className={`${baseClasses} bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300`}
          >
            {statusText}
          </span>
        );
    }
  };

  const getPeriodRange = (
    createdAt: string,
    verifiedAt: string | undefined,
    durationDays: number,
    durationSeconds?: number,
  ) => {
    // Use verifiedAt for active channels, createdAt for inactive channels
    const startDateStr = verifiedAt && verifiedAt !== null ? verifiedAt : createdAt;
    // Use duration in seconds if available, otherwise convert days to seconds
    const durationInSeconds = durationSeconds || durationDays * 24 * 60 * 60;
    
    try {
      // Parse UTC time using dayjs and calculate end time
      const startUtc = dayjs.utc(startDateStr);
      const endUtc = startUtc.add(durationInSeconds, 'seconds');
      
      // Format both dates using the utility function
      const startFormatted = formatDbTimeToLocal(startDateStr, 'MM/DD/YYYY HH:mm:ss');
      const endFormatted = formatDbTimeToLocal(endUtc.toISOString(), 'MM/DD/YYYY HH:mm:ss');

      return `${startFormatted} - ${endFormatted}`;
    } catch (error) {
      console.error('Error parsing date in getPeriodRange:', error, { startDateStr, durationInSeconds });
      // Fallback to basic string formatting
      return `${startDateStr} - (Duration: ${durationDays} days)`;
    }
  };

  const getActionButton = (channel: PaymentChannel) => {
    const isLoading = actionLoading === channel.channelId;

    if (channel.status === 1) {
      // Inactive - Show PayNow
      return (
        <Button
          onClick={() => handlePayNow(channel)}
          disabled={isLoading}
          className="hover:bg.gray-800 bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black dark:hover:bg-gray-200"
          size="sm"
        >
          {isLoading ? "Processing..." : "Pay Now"}
        </Button>
      );
    } else if (channel.status === 2) {
      // Active - Show Manage dropdown
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={isLoading}
              className="bg.black px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              size="sm"
            >
              {isLoading ? (
                "Processing..."
              ) : (
                <>
                  Manage
                  <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleSetDefault(channel.channelId)}
              disabled={isLoading || channel.isDefault}
            >
              {channel.isDefault ? "✓ Already Default" : "Set as Default"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleChannelAction(channel.channelId, "settle")}
              disabled={isLoading}
              className="text-gray-800 focus:text-gray-800 dark:text-gray-200 dark:focus:text-gray-200"
            >
              Settle Channel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else if (channel.status === 5) {
      // Expired - Show Withdraw Deposit
      return (
        <Button
          onClick={() => handleWithdrawDeposit(channel)}
          disabled={isLoading}
          className="bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          size="sm"
        >
          {isLoading ? "Processing..." : "Withdraw Deposit"}
        </Button>
      );
    } else {
      // Invalid or Settled - No actions available
      return (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {/* No actions available */}
        </span>
      );
    }
  };

  return (
    <TooltipProvider>
      <div className="h-[600px] w-full max-w-none overflow-y-scroll p-8">
        <h3 className="mb-6 text-lg font-semibold">Payment Channels</h3>

        {isLoading ? (
          <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
            <div className="p-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Loading payment channels...
              </p>
            </div>
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
            <div className="p-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No payment channels found. Create your first payment channel
                using the Recharge tab.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={`rounded-lg border shadow-sm ${
                  channel.isDefault
                    ? "border-gray-300 bg-gray-100/50 dark:border-gray-600/40 dark:bg-gray-800/20"
                    : "border-gray-100/30 bg-slate-50/50 dark:border-slate-700/40 dark:bg-slate-800"
                }`}
              >
                {/* Accordion Header */}
                <div
                  className="cursor-pointer p-4 transition-colors hover:bg-transparent dark:hover:bg-transparent"
                  onClick={() => toggleChannelExpansion(channel.channelId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="font-mono text-xs text-slate-600 dark:text-slate-400">
                            ...{channel.channelId.slice(-6)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono text-xs">
                            {channel.channelId}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {channel.amount.toLocaleString()} CKB /{" "}
                        {(channel.amount * 0.01).toLocaleString()} Token
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {getPeriodRange(
                          channel.createdAt,
                          channel.verifiedAt,
                          channel.durationDays,
                          channel.durationSeconds,
                        )}
                      </div>
                      <div>
                        {getStatusBadge(channel.status, channel.statusText)}
                      </div>
                      {channel.isDefault && (
                        <div className="inline-flex rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700/30 dark:text-gray-300">
                          Default
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      {getActionButton(channel)}
                      <div className="text-slate-400 dark:text-slate-500">
                        {expandedChannels.has(channel.channelId) ? "▼" : "▶"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Accordion Content */}
                {expandedChannels.has(channel.channelId) && (
                  <div className="border-t border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                    {/* Funding Transaction */}
                    {channel.fundingTxData && (
                      <DataDisplay
                        title="Funding Transaction"
                        data={JSON.parse(channel.fundingTxData)}
                      />
                    )}
                    {/* Refund Transaction */}
                    {channel.refundTxData && (
                      <DataDisplay
                        title="Refund Transaction"
                        data={JSON.parse(channel.refundTxData)}
                      />
                    )}

                    {/* Seller Signature */}
                    <DataDisplay
                      title="Seller Signature"
                      subtitle="If you haven't consumed any tokens, you can use this seller signature with the Refund Transaction to get a refund after the payment channel expires."
                      data={channel.sellerSignature || "No signature available"}
                    />
                    {/* Settlement Transaction */}
                    {channel.settleTxData && (
                      <DataDisplay
                        title="Settlement Transaction"
                        data={JSON.parse(channel.settleTxData)}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
