import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/features/assistant/components/tooltip-icon-button";
import { ComposerAddAttachment, ComposerAttachments } from "@/features/assistant/components/attachment";
import { useAuth } from '@/features/auth/components/auth-context';
import { useChunkPayment } from '@/features/assistant/hooks/use-chunk-payment';
import { Coins, X, ArrowUpIcon, Square, Check, Loader2, Eye } from "lucide-react";
import React, { useState, useEffect, useCallback } from 'react';
import { channel, chunks } from '@/lib/client/api';
import { PaymentRecord, PaymentChannelInfo } from './payment-types';
import { PaymentStatusPanel } from './payment-status-panel';
import { TransactionDetailsModal } from './transaction-details-modal';
import {
  ComposerPrimitive,
  ThreadPrimitive,
  useComposerRuntime,
  useThreadRuntime
} from '@assistant-ui/react';

interface ChunkAwareComposerProps {
  onAuthRequired: () => void;
  onNewQuestion: () => string;
  onOpenSettings: (tab: 'recharge') => void; // Add callback to open settings
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

// Moved PaymentRecord to payment-types.ts

// Moved PaymentChannelInfo to payment-types.ts

export const ChunkAwareComposer: React.FC<ChunkAwareComposerProps> = ({
  onAuthRequired,
  onNewQuestion,
  onOpenSettings
}) => {
  const { user } = useAuth();
  const composerRuntime = useComposerRuntime();
  const threadRuntime = useThreadRuntime();
  const { payForChunk, isProcessing } = useChunkPayment();
  
  // Chunk payment state
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);
  const [autoPayUserSetting, setAutoPayUserSetting] = useState(true); // User's preference
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const [hasStreamingStarted, setHasStreamingStarted] = useState(false); // Track if streaming has actually started
  const [paymentChannelInfo, setPaymentChannelInfo] = useState<PaymentChannelInfo | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false); // For pre-send payment check modal
  const [isDataLoading, setIsDataLoading] = useState(true); // Track if payment data is still loading

  // Handle automatic payment for a chunk with enhanced payment info
  const handlePayForChunkWithEnhancedInfo = useCallback(async (chunkId: string, paymentInfo: {
    cumulativePayment: number;
    remainingBalance: number;
    channelId: string;
    tokens: number;
  }) => {
    try {
      const result = await payForChunk(chunkId, paymentInfo);
      // Update payment record to paid
      setPaymentRecords(prev => 
        prev.map(record => 
          record.chunkId === chunkId 
            ? { 
                ...record, 
                isPaid: true, 
                isPaying: false,
                transactionData: result.transactionData ? (result.transactionData as unknown as Record<string, unknown>) : undefined,
                // Keep the original consumedTokens - don't overwrite with current channel total
                // consumedTokens: record.consumedTokens, // Preserve original cumulative value
                remainingTokens: Math.floor(paymentInfo.remainingBalance * 0.01)
              }
            : record
        )
      );
      
      console.log(`✅ Successfully auto-paid for chunk: ${chunkId} (${paymentInfo.tokens} tokens)`);
    } catch (error) {
      setPaymentRecords(prev => 
        prev.map(record => 
          record.chunkId === chunkId 
            ? { ...record, isPaying: false }
            : record
        )
      );
      
      console.error(`❌ Auto-payment failed for chunk ${chunkId}:`, error);
    }
  }, [payForChunk, paymentChannelInfo?.consumedTokens]);

  // Fetch current payment channel data and latest chunk on component mount
  useEffect(() => {
    if (!user) return;
    
    const fetchChannelData = async () => {
      try {
        const result = await channel.list() as { data: { channels: PaymentChannel[] } };
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
          
          // Fetch the latest chunk payment record
          const latestChunkResult = await chunks.latest() as { data: { hasLatestChunk: boolean; latestChunk: { chunkId: string; tokens: number; consumedTokens: number; remainingTokens: number; timestamp: string; transactionData?: Record<string, unknown>; isPaid: boolean } } };
          
          if (latestChunkResult && latestChunkResult.data && latestChunkResult.data.hasLatestChunk) {
            const latestChunk = latestChunkResult.data.latestChunk;
            
            // Add the latest chunk to payment records
            const initialRecord: PaymentRecord = {
              chunkId: latestChunk.chunkId,
              tokens: latestChunk.tokens,
              consumedTokens: latestChunk.consumedTokens,
              remainingTokens: latestChunk.remainingTokens,
              timestamp: latestChunk.timestamp,
              transactionData: latestChunk.transactionData,
              isPaid: latestChunk.isPaid,
              isPaying: false
            };
            
            setPaymentRecords([initialRecord]);
            console.log('📝 Loaded latest chunk record:', latestChunk.chunkId, 'isPaid:', latestChunk.isPaid);
          } else {
            // Reset payment records if no chunk found
            setPaymentRecords([]);
            console.log('📝 No latest chunk found - reset payment records');
          }
        } else {
          // Reset both payment channel info and payment records if no default channel
          setPaymentChannelInfo(null);
          setPaymentRecords([]);
          console.log('📝 No default channel found - reset payment data');
        }
      } catch (error) {
        console.error('Failed to fetch channel data or latest chunk:', error);
      } finally {
        // Mark data loading as complete
        setIsDataLoading(false);
      }
    };
    
    fetchChannelData();
    
    // Listen for default channel changes
    const handleDefaultChannelChanged = (event: CustomEvent) => {
      const { channelId } = event.detail;
      console.log('🔄 Default channel changed to:', channelId, '- refreshing payment data');
      // Reset loading state and refetch
      setIsDataLoading(true);
      fetchChannelData();
    };
    
    window.addEventListener('defaultChannelChanged', handleDefaultChannelChanged as EventListener);
    
    return () => {
      window.removeEventListener('defaultChannelChanged', handleDefaultChannelChanged as EventListener);
    };
  }, [user]);



  // Listen for payment channel info from streaming data
  useEffect(() => {
    console.log('🎧 Setting up event listeners for payment events');
    
    const handleChunkPaymentUpdate = (event: CustomEvent) => {
      const { chunkId, tokens, timestamp, cumulativePayment, remainingBalance, channelId, channelTotalAmount, isArrival } = event.detail;
      
      console.log('📡 Received chunkPaymentUpdate event:', {
        chunkId,
        tokens,
        timestamp,
        cumulativePayment,
        remainingBalance,
        channelId,
        channelTotalAmount,
        isArrival
      });
      
      // Update channel info if available
      if (channelTotalAmount !== undefined) {
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
      }
      
      if (isArrival) {
        // Create unpaid record immediately
        const newRecord: PaymentRecord = {
          chunkId,
          tokens,
          consumedTokens: Math.floor(cumulativePayment * 0.01), // Convert CKB to tokens
          remainingTokens: Math.floor(remainingBalance * 0.01), // Convert CKB to tokens
          timestamp: timestamp || new Date().toISOString(),
          isPaid: false, // Initially unpaid
          isPaying: false,
        };
        
        setPaymentRecords(prev => {
          const updated = [newRecord, ...prev];
          console.log('📋 Updated payment records list, now has', updated.length, 'records');
          return updated;
        });
        
        // Auto-pay during streaming if enabled
        if (autoPayUserSetting && isStreamingActive) {
          console.log('🚀 Auto Pay: Immediately paying chunk during streaming:', chunkId);
          
          setPaymentRecords(prev => 
            prev.map(record => 
              record.chunkId === chunkId 
                ? { ...record, isPaying: true }
                : record
            )
          );
          
          handlePayForChunkWithEnhancedInfo(chunkId, {
            cumulativePayment,
            remainingBalance,
            channelId,
            tokens
          });
        } else {
          console.log('⏸️ Auto Pay disabled or streaming ended - chunk will wait for manual payment or batch processing:', chunkId);
        }
      }
    };

    // Listen for successful payments from automatic payment system
    const handleChunkPaymentSuccess = (event: CustomEvent) => {
      const { chunkId, tokens, paidAmount, remainingAmount, timestamp, transactionData } = event.detail;
      
      console.log('🎉 Received chunkPaymentSuccess event:', {
        chunkId,
        tokens,
        paidAmount,
        remainingAmount,
        timestamp
      });
      

      
      const paymentRecord: PaymentRecord = {
        chunkId,
        tokens,
        consumedTokens: Math.floor(paidAmount * 0.01),
        remainingTokens: Math.floor(remainingAmount * 0.01),
        timestamp,
        isPaid: true, // Mark as paid since this is a payment success event
        isPaying: false,
        transactionData
      };
      
      // Update existing record or add new one
      setPaymentRecords(prev => {
        const existingIndex = prev.findIndex(record => record.chunkId === chunkId);
        if (existingIndex >= 0) {
          // Update existing record
          const updated = [...prev];
          updated[existingIndex] = paymentRecord;
          console.log('📝 Updated existing payment record for chunk:', chunkId);
          return updated;
        } else {
          // Add new record to front of list
          console.log('📝 Added new payment record for chunk:', chunkId);
          return [paymentRecord, ...prev];
        }
      });
    };

    // Listen for new chunks arriving from streaming (text-delta)
    // Merged: newChunkArrived handling moved into handleChunkPaymentUpdate

    window.addEventListener('chunkPaymentUpdate', handleChunkPaymentUpdate as EventListener);
    window.addEventListener('chunkPaymentSuccess', handleChunkPaymentSuccess as EventListener);
    // Removed: newChunkArrived listener merged into chunkPaymentUpdate
    
    console.log('✅ Event listeners added successfully');
    
    return () => {
      console.log('🧹 Cleaning up event listeners');
      window.removeEventListener('chunkPaymentUpdate', handleChunkPaymentUpdate as EventListener);
      window.removeEventListener('chunkPaymentSuccess', handleChunkPaymentSuccess as EventListener);
      // Removed: newChunkArrived listener merged into chunkPaymentUpdate
    };
  }, [handlePayForChunkWithEnhancedInfo, threadRuntime, autoPayUserSetting, isStreamingActive]); // Added autoPayUserSetting and isStreamingActive



  // Handle manual payment for a specific chunk
  const handlePayForChunk = async (chunkId: string) => {
    // Find the payment record to get the payment info
    const record = paymentRecords.find(r => r.chunkId === chunkId);
    if (!record) {
      console.error('Payment record not found for chunk:', chunkId);
      alert('Payment record not found');
      return;
    }

    // Mark as paying

    setPaymentRecords(prev => 
      prev.map(record => 
        record.chunkId === chunkId 
          ? { ...record, isPaying: true }
          : record
      )
    );

    try {
      // Use the enhanced payment method with calculated payment info from record data
      const cumulativePayment = record.consumedTokens * 100; // Convert tokens to CKB
      const remainingBalance = record.remainingTokens * 100; // Convert tokens to CKB
      
      const result = await payForChunk(chunkId, {
        cumulativePayment,
        remainingBalance,
        channelId: paymentChannelInfo?.channelId || '',
        tokens: record.tokens
      });
      

      
      // Update payment record to paid
      setPaymentRecords(prev => 
        prev.map(record => 
          record.chunkId === chunkId 
            ? { 
                ...record, 
                isPaid: true, 
                isPaying: false,
                transactionData: result.transactionData ? (result.transactionData as unknown as Record<string, unknown>) : undefined,
                // Keep the original consumedTokens - don't overwrite with current channel total
                // consumedTokens: record.consumedTokens, // Preserve original cumulative value
                remainingTokens: Math.floor(result.remainingTokens * 0.01) // Convert CKB to tokens
              }
            : record
        )
      );
      
      console.log(`✅ Successfully paid for chunk: ${chunkId} (${result.tokens} tokens)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      

      
      setPaymentRecords(prev => 
        prev.map(record => 
          record.chunkId === chunkId 
            ? { ...record, isPaying: false }
            : record
        )
      );
      
      console.error(`❌ Failed to pay for chunk ${chunkId}:`, error);
      
      // Show user-friendly error message
      alert(`Payment failed for chunk: ${errorMessage}`);
    }
  };

  // Monitor streaming state and control Auto Pay
  useEffect(() => {
    const runtime = threadRuntime;
    if (runtime && runtime.subscribe) {
      return runtime.subscribe(() => {
        const state = runtime.getState();
        const isRunning = state.isRunning || false; // Check if assistant is currently running/streaming
        
        setIsStreamingActive(isRunning);
        
        // Disable Auto Pay during streaming, enable after streaming completes
        if (isRunning) {
          setHasStreamingStarted(true);
          console.log('🚫 Streaming started - Auto Pay disabled');
          setAutoPayEnabled(false);
        } else {
          // Only process "streaming ended" logic if streaming had actually started
          if (hasStreamingStarted) {
            console.log('✅ Streaming ended - Auto Pay restored to user setting:', autoPayUserSetting);
            setAutoPayEnabled(autoPayUserSetting);
            
            // No need to process unpaid chunks here anymore
            // All chunks are already paid during streaming if Auto Pay is enabled
            console.log('🏁 Streaming completed - all chunks should already be paid if Auto Pay was enabled');
          } else {
            console.log('🔄 Page initialized - streaming has not started yet, no Auto Pay triggered');
          }
        }
      });
    }
  }, [threadRuntime, autoPayUserSetting, handlePayForChunkWithEnhancedInfo, paymentChannelInfo?.channelId, hasStreamingStarted]);

  // Handle authentication and payment check before submission
  const handlePreSendValidation = useCallback(async () => {
    if (!user) {
      onAuthRequired();
      return false;
    }
    
    // Check if user has a default payment channel
    if (!user.active_channel) {
      console.log('❌ No default payment channel found - opening recharge settings');
      onOpenSettings('recharge');
      return false; // Prevent sending until user sets up a payment channel
    }
    
    console.log('🔍 Pre-send validation - isDataLoading:', isDataLoading, 'paymentRecords.length:', paymentRecords.length);
    
    // Always fetch the latest chunk status to ensure we have current data
    try {
      const latestChunkResult = await chunks.latest() as { data: { hasLatestChunk: boolean; latestChunk: { chunkId: string; tokens: number; consumedTokens: number; remainingTokens: number; timestamp: string; transactionData?: Record<string, unknown>; isPaid: boolean } } };
      
      if (latestChunkResult && latestChunkResult.data && latestChunkResult.data.hasLatestChunk) {
        const latestChunk = latestChunkResult.data.latestChunk;
        console.log('🔍 Latest chunk status - chunkId:', latestChunk.chunkId, 'isPaid:', latestChunk.isPaid);
        
        // If latest chunk is unpaid, show payment modal and prevent sending
        if (!latestChunk.isPaid) {
          const record: PaymentRecord = {
            chunkId: latestChunk.chunkId,
            tokens: latestChunk.tokens,
            consumedTokens: latestChunk.consumedTokens,
            remainingTokens: latestChunk.remainingTokens,
            timestamp: latestChunk.timestamp,
            transactionData: latestChunk.transactionData,
            isPaid: latestChunk.isPaid,
            isPaying: false
          };
          
          console.log('❌ Latest chunk is unpaid - showing payment modal and preventing send');
          setSelectedRecord(record);
          setShowPaymentModal(true);
          return false; // Prevent sending - don't call onNewQuestion()
        } else {
          console.log('✅ Latest chunk is paid - allowing send');
        }
      } else {
        console.log('ℹ️ No latest chunk found - allowing send');
      }
    } catch (error) {
      console.error('Failed to fetch latest chunk status:', error);
      // Continue with normal validation if fetch fails
    }
    
    // Only generate new session ID if validation passes
    const sessionId = onNewQuestion();
    console.log('✅ Pre-send validation passed - new session ID:', sessionId);
    return true; // Allow sending
  }, [user, onAuthRequired, onOpenSettings, onNewQuestion, isDataLoading, paymentRecords]);
  
  // Custom send handler with payment validation
  const handleSend = useCallback(async () => {
    console.log('📨 Send button clicked - starting validation');
    const isValid = await handlePreSendValidation();
    console.log('🔍 Validation result:', isValid);
    
    if (!isValid) {
      console.log('❌ Validation failed - not sending message');
      return; // Pre-send validation failed
    }
    
    console.log('✅ Validation passed - sending message');
    // Validation passed, send the message
    composerRuntime.send();
  }, [handlePreSendValidation, composerRuntime]);
  
  // Handle keyboard events for Enter key
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default composer send behavior
      console.log('⌨️ Enter key pressed - triggering validation');
      await handleSend();
    }
  }, [handleSend]);
  
  // Listen for submit events and intercept with payment validation
  useEffect(() => {
    const runtime = composerRuntime;
    if (runtime && runtime.subscribe) {
      return runtime.subscribe(() => {
        const state = runtime.getState();
        // We'll handle validation in the send button click instead
        // This effect is kept for potential future use
      });
    }
  }, [composerRuntime, user]);



  return (
    <div className="space-y-2">
      {user && (
        <PaymentStatusPanel
          paymentChannelInfo={paymentChannelInfo}
          paymentRecords={paymentRecords}
          isProcessing={isProcessing}
          isStreamingActive={isStreamingActive}
          autoPayUserSetting={autoPayUserSetting}
          onAutoPayChange={(newSetting) => {
            setAutoPayUserSetting(newSetting);
            if (!isStreamingActive) {
              setAutoPayEnabled(newSetting);
            }
          }}
          onPayChunk={handlePayForChunk}
          onShowDetails={(record) => setSelectedRecord(record)}
        />
      )}



      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
          rows={1}
          autoFocus
          aria-label="Message input"
          onKeyDown={handleKeyDown}
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

      {selectedRecord && (
        <TransactionDetailsModal
          selectedRecord={selectedRecord}
          isProcessing={isProcessing}
          showPaymentModal={showPaymentModal}
          onClose={() => {
            setSelectedRecord(null);
            setShowPaymentModal(false);
          }}
          onPayNow={(chunkId) => {
            handlePayForChunk(chunkId);
            setSelectedRecord(null);
            setShowPaymentModal(false);
          }}
        />
      )}
    </div>
  );
};