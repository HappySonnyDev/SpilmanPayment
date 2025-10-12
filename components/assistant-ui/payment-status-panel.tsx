import React from "react";
import { Coins, Check, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentChannelInfo, PaymentRecord } from "./payment-types";

interface PaymentStatusPanelProps {
  paymentChannelInfo: PaymentChannelInfo | null;
  paymentRecords: PaymentRecord[];
  isProcessing: boolean;
  isStreamingActive: boolean;
  autoPayUserSetting: boolean;
  onAutoPayChange: (checked: boolean) => void;
  onPayChunk: (chunkId: string) => void;
  onShowDetails: (record: PaymentRecord) => void;
}

export const PaymentStatusPanel: React.FC<PaymentStatusPanelProps> = ({
  paymentChannelInfo,
  paymentRecords,
  isProcessing,
  isStreamingActive,
  autoPayUserSetting,
  onAutoPayChange,
  onPayChunk,
  onShowDetails,
}) => {
  return (
    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Coins className="h-4 w-4" />
          <span className="text-sm font-medium">Payment Status</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Display cumulative and remaining tokens from latest chunk data */}
          {paymentRecords.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <span>
                Cumulative: {Math.floor((paymentRecords[0].consumedTokens || 0)).toLocaleString()} Tokens
              </span>
              <span>
                Remaining: {Math.floor((paymentRecords[0].remainingTokens || 0)).toLocaleString()} Tokens
              </span>
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  paymentChannelInfo && paymentRecords[0].remainingTokens
                    ? paymentRecords[0].remainingTokens < paymentChannelInfo.channelTotalTokens * 0.1
                      ? "bg-red-500"
                      : paymentRecords[0].remainingTokens < paymentChannelInfo.channelTotalTokens * 0.3
                      ? "bg-gray-400"
                      : "bg-gray-600"
                    : "bg-gray-500"
                }`}
              />
              <span>
                {paymentChannelInfo && paymentRecords[0].remainingTokens
                  ? Math.max(0, (paymentRecords[0].remainingTokens / paymentChannelInfo.channelTotalTokens * 100)).toFixed(1)
                  : "0.0"}
                % remaining
              </span>
            </div>
          )}

          {/* Fallback to channel info if no payment records */}
          {paymentRecords.length === 0 && paymentChannelInfo && (
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <span>Cumulative: {paymentChannelInfo.consumedTokens.toLocaleString()} Tokens</span>
              <span>Remaining: {paymentChannelInfo.remainingTokens.toLocaleString()} Tokens</span>
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  paymentChannelInfo.remainingTokens < paymentChannelInfo.channelTotalTokens * 0.1
                    ? "bg-red-500"
                    : paymentChannelInfo.remainingTokens < paymentChannelInfo.channelTotalTokens * 0.3
                    ? "bg-gray-400"
                    : "bg-gray-600"
                }`}
              />
              <span>
                {Math.max(0, (paymentChannelInfo.remainingTokens / paymentChannelInfo.channelTotalTokens * 100)).toFixed(1)}% remaining
              </span>
            </div>
          )}

          {/* Auto Pay Toggle Switch */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPayUserSetting}
                onChange={(e) => onAutoPayChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 focus:ring-2"
                disabled={isStreamingActive}
              />
              <span className="font-medium">Auto Pay</span>
            </label>
          </div>
        </div>
      </div>

      {/* Payment Records List */}
      {paymentRecords.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Payment History:</div>
          {paymentRecords.map((record, index) => (
            <div
              key={`${record.chunkId}-${index}`}
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded px-3 py-2 text-xs border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-gray-600 dark:text-gray-400">{record.chunkId.slice(-8)}...</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{record.tokens} tokens</span>
                <span className="text-gray-700 dark:text-gray-300">Cumulative: {record.consumedTokens.toLocaleString()} Tokens</span>
                <span className="text-gray-600 dark:text-gray-400">Remaining: {record.remainingTokens.toLocaleString()} Tokens</span>
                {record.isPaying && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Paying...
                  </span>
                )}
                {!record.isPaying && record.isPaid === false && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Unpaid
                  </span>
                )}
                {!record.isPaying && record.isPaid === true && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <Check className="h-3 w-3 mr-1" />
                    Paid
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-500">{new Date(record.timestamp).toLocaleTimeString()}</span>

                {/* Show Pay button for unpaid records */}
                {!record.isPaying && record.isPaid === false && (
                  <Button
                    onClick={() => onPayChunk(record.chunkId)}
                    size="sm"
                    variant="default"
                    className="h-6 px-2 text-xs bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black"
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pay"}
                  </Button>
                )}

                {/* Show transaction details button for all records */}
                <Button
                  onClick={() => onShowDetails(record)}
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0 border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center py-4">
          New chunk payments will appear here during chat interactions.
        </div>
      )}
    </div>
  );
};
