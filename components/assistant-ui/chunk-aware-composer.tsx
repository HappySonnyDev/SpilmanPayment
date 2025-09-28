import { ComposerPrimitive, ThreadPrimitive, useComposerRuntime, useAssistantRuntime } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ComposerAddAttachment, ComposerAttachments } from "@/components/assistant-ui/attachment";
import { useAuth } from '@/components/auth/auth-context';
import { useChunkPayment } from '@/hooks/use-chunk-payment';
import { AlertTriangle, Coins, X, ArrowUpIcon, Square, Check, Loader2 } from "lucide-react";
import React, { useState, useEffect, useCallback } from 'react';

interface ChunkPaymentData {
  chunkId: string;
  tokens: number;
  sessionId: string;
  isPaid: boolean;
}

interface StreamDataPart {
  type: string;
  data: ChunkPaymentData;
}

interface ChunkAwareComposerProps {
  onAuthRequired: () => void;
  pendingMessage: string;
  setPendingMessage: (message: string) => void;
  onNewQuestion: () => string;
}

interface ChunkPaymentStatus {
  chunkId: string;
  tokens: number;
  status: 'pending' | 'paying' | 'paid' | 'failed';
  error?: string;
}

export const ChunkAwareComposer: React.FC<ChunkAwareComposerProps> = ({
  onAuthRequired,
  pendingMessage,
  setPendingMessage,
  onNewQuestion
}) => {
  const { user } = useAuth();
  const composerRuntime = useComposerRuntime();
  const assistantRuntime = useAssistantRuntime();
  const { payForChunk, isProcessing } = useChunkPayment();
  
  // Chunk payment state
  const [chunkPayments, setChunkPayments] = useState<ChunkPaymentStatus[]>([]);
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);
  const [totalPendingTokens, setTotalPendingTokens] = useState(0);
  const [isStreamingActive, setIsStreamingActive] = useState(false);

  // Check for recent unpaid chunks and pay for them automatically  
  const checkAndPayRecentChunks = useCallback(async () => {
    if (!user || !autoPayEnabled) return;
    
    try {
      // Get all unpaid chunks for this user
      const response = await fetch('/api/chunks/check-all', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        const unpaidTokens = result.data.unpaidTokens;
        
        if (unpaidTokens > 0) {
          console.log(`🔄 Found ${unpaidTokens} unpaid tokens, auto-paying...`);
          
          // Pay all unpaid chunks
          const payResponse = await fetch('/api/chunks/pay-all', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'pay' }),
            credentials: 'include',
          });
          
          if (payResponse.ok) {
            const payResult = await payResponse.json();
            console.log(`✅ Successfully paid for ${payResult.data.paidTokens} tokens`);
            
            // Update UI to show payment completion
            setChunkPayments([]);
            setTotalPendingTokens(0);
          }
        }
      }
    } catch (error) {
      console.error('Error checking and paying for chunks:', error);
    }
  }, [user, autoPayEnabled]);

  // Simple fallback check for any missed chunks
  useEffect(() => {
    if (user && autoPayEnabled && !isStreamingActive) {
      const timeoutId = setTimeout(() => {
        checkAndPayRecentChunks();
      }, 2000); // Check 2 seconds after streaming stops
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, autoPayEnabled, isStreamingActive, checkAndPayRecentChunks]);

  // Simulate chunk received event (for testing)
  const handleChunkReceived = async (chunkId: string, tokens: number) => {
    const newChunk: ChunkPaymentStatus = {
      chunkId,
      tokens,
      status: 'pending'
    };
    
    setChunkPayments(prev => [...prev, newChunk]);
    setTotalPendingTokens(prev => prev + tokens);

    // Auto-pay if enabled
    if (autoPayEnabled && user) {
      await handlePayForChunk(chunkId);
    }
  };

  const handlePayForChunk = async (chunkId: string) => {
    console.log(`🔄 Attempting to pay for chunk: ${chunkId}`);
    
    setChunkPayments(prev =>
      prev.map(chunk =>
        chunk.chunkId === chunkId
          ? { ...chunk, status: 'paying' }
          : chunk
      )
    );

    try {
      const result = await payForChunk(chunkId);
      
      setChunkPayments(prev =>
        prev.map(chunk =>
          chunk.chunkId === chunkId
            ? { ...chunk, status: 'paid' }
            : chunk
        )
      );
      
      setTotalPendingTokens(prev => prev - result.tokens);
      
      console.log(`✅ Successfully paid for chunk: ${chunkId} (${result.tokens} tokens)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      
      setChunkPayments(prev =>
        prev.map(chunk =>
          chunk.chunkId === chunkId
            ? { ...chunk, status: 'failed', error: errorMessage }
            : chunk
        )
      );
      
      console.error(`❌ Failed to pay for chunk ${chunkId}:`, error);
      
      // Show user-friendly error message
      alert(`Payment failed for chunk: ${errorMessage}`);
    }
  };

  const handleSend = async () => {
    if (!user) {
      const state = composerRuntime.getState();
      if (state.text.trim()) {
        setPendingMessage(state.text.trim());
        composerRuntime.reset();
        onAuthRequired();
      }
      return;
    }

    // Clear previous chunk payment history for new conversation
    setChunkPayments([]);
    setTotalPendingTokens(0);
    
    // Generate new session ID
    const newSessionId = onNewQuestion();
    
    // Send the message
    composerRuntime.send();
  };

  // Demo function to simulate chunk received and create in database
  const simulateChunkReceived = async () => {
    const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tokens = Math.floor(Math.random() * 10) + 1;
    
    // Create the chunk in the database first via API
    try {
      const response = await fetch('/api/chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chunkId,
          sessionId: `demo_session_${Date.now()}`,
          tokens,
        }),
        credentials: 'include',
      });
      
      if (response.ok) {
        console.log(`🎯 Created demo chunk in database: ${chunkId}`);
        handleChunkReceived(chunkId, tokens);
      } else {
        console.error('Failed to create demo chunk in database');
        // Still show in UI for demo purposes
        handleChunkReceived(chunkId, tokens);
      }
    } catch (error) {
      console.error('Error creating demo chunk:', error);
      // Still show in UI for demo purposes
      handleChunkReceived(chunkId, tokens);
    }
  };

  const pendingChunks = chunkPayments.filter(c => c.status === 'pending');
  const payingChunks = chunkPayments.filter(c => c.status === 'paying');
  const failedChunks = chunkPayments.filter(c => c.status === 'failed');

  return (
    <div className="space-y-2">
      {/* Debug Info - Always show for testing */}
      <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <div className="text-xs text-green-700 dark:text-green-300">
          🧪 Chunk Payment System Active | 
          User: {user ? '✅ Logged in' : '❌ Not logged in'} | 
          Auto-pay: {autoPayEnabled ? '✅ On' : '❌ Off'} | 
          Chunks: {chunkPayments.length} |
          Streaming: {isStreamingActive ? '🔄 Active' : '⏹️ Idle'}
        </div>
        {process.env.NODE_ENV === 'development' && (
          <Button
            onClick={simulateChunkReceived}
            size="sm"
            variant="outline"
            className="mt-2 h-6 px-2 text-xs"
          >
            Simulate Chunk
          </Button>
        )}
      </div>

      {/* Chunk Payment Status Bar */}
      {user && chunkPayments.length > 0 && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Chunk Payments:</span>
              </div>
              
              {payingChunks.length > 0 && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{payingChunks.length} paying...</span>
                </div>
              )}
              
              {pendingChunks.length > 0 && (
                <span className="text-orange-600">
                  {pendingChunks.length} pending ({totalPendingTokens} tokens)
                </span>
              )}
              
              {failedChunks.length > 0 && (
                <span className="text-red-600">
                  {failedChunks.length} failed
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={autoPayEnabled}
                  onChange={(e) => setAutoPayEnabled(e.target.checked)}
                  className="rounded"
                />
                Auto-pay
              </label>
            </div>
          </div>

          {/* Pending Chunks List */}
          {pendingChunks.length > 0 && !autoPayEnabled && (
            <div className="mt-2 space-y-1">
              {pendingChunks.slice(0, 3).map(chunk => (
                <div key={chunk.chunkId} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded px-2 py-1 text-xs">
                  <span className="font-mono">{chunk.chunkId.slice(-8)}... ({chunk.tokens} tokens)</span>
                  <Button
                    onClick={() => handlePayForChunk(chunk.chunkId)}
                    size="sm"
                    variant="default"
                    className="h-5 px-2 text-xs"
                    disabled={isProcessing}
                  >
                    Pay
                  </Button>
                </div>
              ))}
              {pendingChunks.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  ... and {pendingChunks.length - 3} more
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
          rows={1}
          autoFocus
          aria-label="Message input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
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
    </div>
  );
};