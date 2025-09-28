import React, { useState, useEffect } from "react";
import {
  ComposerPrimitive,
  ThreadPrimitive,
  useComposerRuntime,
} from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  ComposerAddAttachment,
  ComposerAttachments,
} from "@/components/assistant-ui/attachment";
import { useAuth } from "@/components/auth/auth-context";
import { useChunkPayment } from "@/hooks/use-chunk-payment";
import {
  AlertTriangle,
  Coins,
  X,
  ArrowUpIcon,
  Square,
  Check,
  Loader2,
} from "lucide-react";

interface TokenAwareComposerProps {
  onAuthRequired: () => void;
  pendingMessage: string;
  setPendingMessage: (message: string) => void;
  onNewQuestion: () => string;
}

interface UnpaidChunksData {
  unpaidChunks: number;
  unpaidTokens: number;
  canProceed: boolean;
  defaultChannel: {
    channelId: string;
    remainingTokens: number;
  } | null;
}

export const TokenAwareComposer: React.FC<TokenAwareComposerProps> = ({
  onAuthRequired,
  pendingMessage,
  setPendingMessage,
  onNewQuestion,
}) => {
  const { user } = useAuth();
  const composerRuntime = useComposerRuntime();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [unpaidData, setUnpaidData] = useState<UnpaidChunksData | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const checkUnpaidChunks = async (): Promise<boolean> => {
    if (!user) return true; // Will be handled by auth

    try {
      setIsCheckingPayment(true);
      // Check all unpaid chunks for this user (across all sessions)
      const response = await fetch(`/api/chunks/check-all`);

      if (!response.ok) {
        throw new Error("Failed to check payment status");
      }

      const result = await response.json();
      const data: UnpaidChunksData = result.data;

      if (data.unpaidTokens > 0 && !data.canProceed) {
        setUnpaidData(data);
        setShowPaymentDialog(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking unpaid chunks:", error);
      return true; // Allow to proceed if check fails
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handlePayment = async () => {
    if (!unpaidData) return;

    try {
      setIsProcessingPayment(true);

      const response = await fetch("/api/chunks/pay-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "pay",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Payment failed");
      }

      setShowPaymentDialog(false);
      setUnpaidData(null);

      // Allow the message to be sent now
      return true;
    } catch (error) {
      console.error("Payment error:", error);
      alert(
        "Payment failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      return false;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Custom send handler that checks payment first
  const handleSend = async () => {
    if (!user) {
      // Save current composer text as pending message
      const state = composerRuntime.getState();
      if (state.text.trim()) {
        setPendingMessage(state.text.trim());
        composerRuntime.reset(); // Clear the composer
        onAuthRequired();
      }
      return;
    }

    // Generate new session ID for this question
    const newSessionId = onNewQuestion();

    // Check for unpaid chunks from previous sessions
    const canProceed = await checkUnpaidChunks();
    if (!canProceed) {
      return; // Payment dialog will be shown
    }

    // Proceed with normal send
    setPendingMessage(""); // Clear any pending message
    composerRuntime.send();
  };

  return (
    <>
      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
          rows={1}
          autoFocus
          aria-label="Message input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
          <ComposerAddAttachment />

          <ThreadPrimitive.If running={false}>
            <TooltipIconButton
              tooltip="Send message"
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-send size-[34px] rounded-full p-1"
              aria-label="Send message"
              onClick={handleSend}
              disabled={isCheckingPayment}
            >
              <ArrowUpIcon className="aui-composer-send-icon size-5" />
            </TooltipIconButton>
          </ThreadPrimitive.If>

          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
                aria-label="Stop generating"
              >
                <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
              </Button>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </div>
      </ComposerPrimitive.Root>

      {/* Payment Dialog */}
      {showPaymentDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Payment Required
              </h3>
              <button
                onClick={() => setShowPaymentDialog(false)}
                disabled={isProcessingPayment}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                You have unpaid tokens from previous messages that need to be
                paid before sending a new message.
              </p>

              {unpaidData && (
                <div className="rounded-lg border bg-slate-50 p-4 dark:bg-slate-800">
                  <div className="mb-3 flex items-center gap-2">
                    <Coins className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Payment Details</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Unpaid Chunks:
                      </span>
                      <span className="font-medium">
                        {unpaidData.unpaidChunks}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Unpaid Tokens:
                      </span>
                      <span className="font-medium">
                        {unpaidData.unpaidTokens.toLocaleString()}
                      </span>
                    </div>
                    {unpaidData.defaultChannel && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Available Tokens:
                        </span>
                        <span className="font-medium">
                          {unpaidData.defaultChannel.remainingTokens.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Click &ldquo;Pay Now&rdquo; to deduct tokens from your default
                channel and continue chatting.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPaymentDialog(false)}
                disabled={isProcessingPayment}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                disabled={isProcessingPayment}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessingPayment ? "Processing..." : "Pay Now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
