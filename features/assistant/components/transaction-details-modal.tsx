import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, Loader2, Check } from "lucide-react";
import { PaymentRecord } from "./payment-types";
import { DataDisplay } from "@/components/shared/data-display";

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
              <DataDisplay
                title="Chunk ID"
                data={selectedRecord.chunkId}
                className="mb-0"
              />
            </div>
            <div>
              <DataDisplay
                title="Tokens Consumed"
                data={`${selectedRecord.tokens} tokens`}
                className="mb-0"
              />
            </div>
            <div>
              <DataDisplay
                title="Payment Status"
                data={selectedRecord.isPaid === true ? "✓ Paid" : selectedRecord.isPaid === false ? "Unpaid" : "Status unknown"}
                className="mb-0"
              />
            </div>
            <div>
              <DataDisplay
                title="Timestamp"
                data={new Date(selectedRecord.timestamp).toLocaleString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZoneName: "short",
                })}
                className="mb-0"
              />
            </div>
          </div>

          {selectedRecord.transactionData && (
            <DataDisplay
              title="Transaction Data"
              data={selectedRecord.transactionData}
            />
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
