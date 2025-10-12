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
import { useAuth } from "@/app/context/auth-context";
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
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [unpaidData, setUnpaidData] = useState<UnpaidChunksData | null>(null);

  // Note: Removed checkUnpaidChunks and handlePayment functions 
  // as we now use direct chunk-level payment instead of bulk payment operations

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

    // Note: Removed unpaid chunks check as we now use direct chunk-level payment
    // Allow all messages to proceed
    const canProceed = true;
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

      {/* Note: Payment dialog removed as we now use direct chunk-level payment */}
    </>
  );
};
