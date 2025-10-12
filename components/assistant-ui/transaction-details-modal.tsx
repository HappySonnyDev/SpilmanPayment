import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, Loader2, Check } from "lucide-react";
import { PaymentRecord } from "./payment-types";

interface TransactionDetailsModalProps {
  selectedRecord: PaymentRecord | null;
  isProcessing: boolean;
  showPaymentModal: boolean;
  onClose: () => void;
  onPayNow: (chunkId: string) => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  selectedRecord,
  isProcessing,
  showPaymentModal,
  onClose,
  onPayNow,
}) => {
  if (!selectedRecord) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {showPaymentModal ? "Payment Required" : "Transaction Details"}
          </h3>
          <Button onClick={onClose} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Payment required message for pre-send check */}
        {showPaymentModal && selectedRecord.isPaid === false && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              You must pay for the latest chunk before starting a new conversation.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chunk ID</label>
              <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">{selectedRecord.chunkId}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tokens Consumed</label>
              <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">{selectedRecord.tokens} tokens</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Status</label>
              <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                {selectedRecord.isPaid === true && (
                  <span className="inline-flex items-center text-gray-600 dark:text-gray-400">
                    <Check className="h-4 w-4 mr-1" />
                    Paid
                  </span>
                )}
                {selectedRecord.isPaid === false && <span className="text-orange-600">Unpaid</span>}
                {selectedRecord.isPaid === undefined && <span className="text-gray-500">Status unknown</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timestamp</label>
              <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                {new Date(selectedRecord.timestamp).toLocaleString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZoneName: "short",
                })}
              </p>
            </div>
          </div>

          {selectedRecord.transactionData && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transaction Data</label>
              <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(selectedRecord.transactionData, null, 2)}
              </pre>
            </div>
          )}

          {/* Payment action buttons for unpaid chunks */}
          {selectedRecord.isPaid === false && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <Button onClick={onClose} variant="outline" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => onPayNow(selectedRecord.chunkId)}
                size="sm"
                className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black"
                disabled={isProcessing || selectedRecord.isPaying}
              >
                {isProcessing || selectedRecord.isPaying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Paying...
                  </>
                ) : (
                  "Pay Now"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
