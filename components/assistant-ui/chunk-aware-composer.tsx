import { ComposerPrimitive, ThreadPrimitive, useComposerRuntime, useAssistantRuntime } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ComposerAddAttachment, ComposerAttachments } from "@/components/assistant-ui/attachment";
import { useAuth } from '@/app/context/auth-context';
import { useChunkPayment } from '@/hooks/use-chunk-payment';
import { AlertTriangle, Coins, X, ArrowUpIcon, Square, Check, Loader2, Eye } from "lucide-react";
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

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

interface PaymentChannel {
  id: number;
  channelId: string;
  amount: number;
  durationDays: number;
  status: number;
  statusText: string;
  isDefault: boolean;
  consumedTokens: number;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRecord {
  chunkId: string;
  tokens: number;
  consumedTokens: number;
  remainingTokens: number;
  timestamp: string;
  transactionData?: Record<string, unknown>;
}

interface PaymentChannelInfo {
  consumedTokens: number;
  remainingTokens: number;
  channelId: string;
  channelTotalTokens: number;
  currentChunkTokens: number;
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
  const [paymentChannelInfo, setPaymentChannelInfo] = useState<PaymentChannelInfo | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);

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

  // Fetch current payment channel data on component mount
  useEffect(() => {
    if (!user) return;
    
    const fetchChannelData = async () => {
      try {
        const response = await fetch('/api/channel/list', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const result = await response.json();
          const defaultChannel = result.data.channels.find((channel: PaymentChannel) => channel.isDefault && channel.status === 2);
          
          if (defaultChannel) {
            // Initialize payment channel info from current channel
            // Convert CKB amounts to tokens using 1 CKB = 0.01 Token ratio
            const totalTokens = Math.floor(defaultChannel.amount * 0.01);
            const consumedTokens = defaultChannel.consumedTokens;
            const remainingTokens = totalTokens - consumedTokens;
            
            setPaymentChannelInfo({
              currentChunkTokens: 0,
              consumedTokens: consumedTokens,
              remainingTokens: remainingTokens,
              channelId: defaultChannel.channelId,
              channelTotalTokens: totalTokens
            });
            
            // Payment history will only show real chunk payment transactions
            // Current channel status is displayed in the header section
          }
        }
      } catch (error) {
        console.error('Failed to fetch channel data:', error);
      }
    };
    
    fetchChannelData();
  }, [user]);

  // Simple fallback check for any missed chunks
  useEffect(() => {
    if (user && autoPayEnabled && !isStreamingActive) {
      const timeoutId = setTimeout(() => {
        checkAndPayRecentChunks();
      }, 2000); // Check 2 seconds after streaming stops
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, autoPayEnabled, isStreamingActive, checkAndPayRecentChunks]);

  // Listen for payment channel info from streaming data
  useEffect(() => {
    const handlePaymentChannelData = (event: CustomEvent) => {
      const { tokens, cumulativePayment, remainingBalance, channelId, channelTotalAmount } = event.detail;
      
      // Convert CKB amounts to tokens for display
      const totalTokens = Math.floor(channelTotalAmount * 0.01);
      const consumedTokens = Math.floor(cumulativePayment * 0.01);
      const remainingTokens = totalTokens - consumedTokens;
      
      setPaymentChannelInfo({
        currentChunkTokens: tokens,
        consumedTokens: consumedTokens,
        remainingTokens: remainingTokens,
        channelId,
        channelTotalTokens: totalTokens
      });
    };

    // Listen for successful payments from automatic payment system
    const handleChunkPaymentSuccess = (event: CustomEvent) => {
      const { chunkId, tokens, paidAmount, remainingAmount, timestamp, transactionData } = event.detail;
      
      const paymentRecord: PaymentRecord = {
        chunkId,
        tokens,
        consumedTokens: Math.floor(paidAmount * 0.01),
        remainingTokens: Math.floor(remainingAmount * 0.01),
        timestamp,
        transactionData
      };
      
      setPaymentRecords(prev => [paymentRecord, ...prev]); // Add to front of list
      console.log('📝 Added payment record for chunk:', chunkId);
    };

    window.addEventListener('tokenStreamUpdate', handlePaymentChannelData as EventListener);
    window.addEventListener('chunkPaymentSuccess', handleChunkPaymentSuccess as EventListener);
    
    return () => {
      window.removeEventListener('tokenStreamUpdate', handlePaymentChannelData as EventListener);
      window.removeEventListener('chunkPaymentSuccess', handleChunkPaymentSuccess as EventListener);
    };
  }, []);

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
      
      // Add payment record with transaction details
      const paymentRecord: PaymentRecord = {
        chunkId: result.chunkId,
        tokens: result.tokens,
        consumedTokens: paymentChannelInfo?.consumedTokens || 0,
        remainingTokens: result.remainingTokens,
        timestamp: new Date().toISOString(),
        transactionData: result.transactionData ? (result.transactionData as unknown as Record<string, unknown>) : undefined
      };
      
      setPaymentRecords(prev => [paymentRecord, ...prev]); // Add to front of list
      
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
      {/* Persistent Payment Status Panel - Always visible when user is logged in */}
      {user && (
        <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Coins className="h-4 w-4" />
              <span className="text-sm font-medium">Payment Status</span>
            </div>
            
            {paymentChannelInfo && (
              <div className="flex items-center gap-4 text-xs text-green-600 dark:text-green-400">
                <span>Consumed: {paymentChannelInfo.consumedTokens.toLocaleString()} Tokens</span>
                <span>Remaining: {paymentChannelInfo.remainingTokens.toLocaleString()} Tokens</span>
                <span className={`inline-flex h-2 w-2 rounded-full ${
                  paymentChannelInfo.remainingTokens < paymentChannelInfo.channelTotalTokens * 0.1 ? 'bg-red-500' : 
                  paymentChannelInfo.remainingTokens < paymentChannelInfo.channelTotalTokens * 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <span>{Math.max(0, (paymentChannelInfo.remainingTokens / paymentChannelInfo.channelTotalTokens * 100)).toFixed(1)}% remaining</span>
              </div>
            )}
          </div>

          {/* Payment Records List */}
          {paymentRecords.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                Payment History:
              </div>
              {paymentRecords.map((record, index) => (
                <div key={`${record.chunkId}-${index}`} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded px-3 py-2 text-xs border border-green-200 dark:border-green-700">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {record.chunkId.slice(-8)}...
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {record.tokens} tokens
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      Consumed: {record.consumedTokens.toLocaleString()} Tokens
                    </span>
                    <span className="text-purple-600 dark:text-purple-400">
                      Remaining: {record.remainingTokens.toLocaleString()} Tokens
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                    <Button
                      onClick={() => setSelectedRecord(record)}
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-green-600 dark:text-green-400 text-center py-4">
              New chunk payments will appear here during chat interactions.
            </div>
          )}
        </div>
      )}

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

      {/* Transaction Details Modal */}
      {selectedRecord && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Transaction Details
              </h3>
              <Button
                onClick={() => setSelectedRecord(null)}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chunk ID
                  </label>
                  <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {selectedRecord.chunkId}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tokens Consumed
                  </label>
                  <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {selectedRecord.tokens} tokens
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Consumed Tokens
                  </label>
                  <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {selectedRecord.consumedTokens.toLocaleString()} Tokens
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Remaining Tokens
                  </label>
                  <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {selectedRecord.remainingTokens.toLocaleString()} Tokens
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Timestamp
                  </label>
                  <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {new Date(selectedRecord.timestamp).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                      timeZone: 'Asia/Shanghai'
                    })}
                  </p>
                </div>
              </div>
              
              {selectedRecord.transactionData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Data
                  </label>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedRecord.transactionData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <Button
                onClick={() => setSelectedRecord(null)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};