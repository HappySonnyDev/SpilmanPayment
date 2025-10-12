import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ComposerAddAttachment, ComposerAttachments } from "@/components/assistant-ui/attachment";
import { useAuth } from '@/app/context/auth-context';
import { useChunkPayment } from '@/hooks/use-chunk-payment';
import { Coins, X, ArrowUpIcon, Square, Check, Loader2, Eye } from "lucide-react";
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ComposerPrimitive,
  ThreadPrimitive,
  useComposerRuntime,
  useThreadRuntime
} from '@assistant-ui/react';

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
  consumedTokens: number; // Cumulative tokens consumed (converted from CKB)
  remainingTokens: number; // Remaining tokens in channel (converted from CKB)
  timestamp: string;
  isPaid?: boolean; // Add isPaid field to track payment status
  isPaying?: boolean; // Add isPaying field to track loading state
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
  onNewQuestion
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
  const [currentlyPayingChunks, setCurrentlyPayingChunks] = useState<Set<string>>(new Set()); // Track which chunks are currently being paid
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
      
      // Remove from paying state
      setCurrentlyPayingChunks(prev => {
        const newSet = new Set(prev);
        newSet.delete(chunkId);
        return newSet;
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
                remainingTokens: Math.floor(paymentInfo.remainingBalance * 0.01)
              }
            : record
        )
      );
      
      console.log(`✅ Successfully auto-paid for chunk: ${chunkId} (${paymentInfo.tokens} tokens)`);
    } catch (error) {
      // Remove from paying state and mark as failed
      setCurrentlyPayingChunks(prev => {
        const newSet = new Set(prev);
        newSet.delete(chunkId);
        return newSet;
      });
      
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
            
            // Fetch the latest chunk payment record
            const latestChunkResponse = await fetch('/api/chunks/latest', {
              credentials: 'include'
            });
            
            if (latestChunkResponse.ok) {
              const latestChunkResult = await latestChunkResponse.json();
              
              if (latestChunkResult.data.hasLatestChunk) {
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
                console.log('📝 No latest chunk found');
              }
            } else {
              console.log('📝 Failed to fetch latest chunk');
            }
          } else {
            console.log('📝 No default channel found');
          }
        } else {
          console.log('📝 Failed to fetch channel list');
        }
      } catch (error) {
        console.error('Failed to fetch channel data or latest chunk:', error);
      } finally {
        // Mark data loading as complete
        setIsDataLoading(false);
      }
    };
    
    fetchChannelData();
  }, [user]);

  // Simple fallback check for any missed chunks
  useEffect(() => {
    // Note: Removed automatic chunk payment check as we now use direct chunk-level payment
    // This effect is kept for potential future use
  }, [user, autoPayEnabled, isStreamingActive]);

  // Listen for payment channel info from streaming data
  useEffect(() => {
    console.log('🎧 Setting up event listeners for payment events');
    
    const handlePaymentChannelData = (event: CustomEvent) => {
      const { tokens, cumulativePayment, remainingBalance, channelId, channelTotalAmount } = event.detail;
      
      console.log('📡 Received tokenStreamUpdate event:', {
        tokens,
        cumulativePayment,
        remainingBalance,
        channelId,
        channelTotalAmount
      });
      
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
      
      console.log('🎉 Received chunkPaymentSuccess event:', {
        chunkId,
        tokens,
        paidAmount,
        remainingAmount,
        timestamp
      });
      
      // Remove from paying state
      setCurrentlyPayingChunks(prev => {
        const newSet = new Set(prev);
        newSet.delete(chunkId);
        return newSet;
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
    const handleNewChunkArrived = (event: CustomEvent) => {
      const { chunkId, tokens, timestamp, cumulativePayment, remainingBalance, channelId } = event.detail;
      
      console.log('🆕 Received newChunkArrived event:', {
        chunkId,
        tokens,
        timestamp,
        cumulativePayment,
        remainingBalance,
        channelId
      });
      
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
      
      console.log('📝 Creating new payment record with values:');
      console.log('  - chunkId:', chunkId);
      console.log('  - tokens:', tokens);
      console.log('  - cumulativePayment (CKB):', cumulativePayment);
      console.log('  - consumedTokens (converted):', newRecord.consumedTokens);
      console.log('  - remainingBalance (CKB):', remainingBalance);
      console.log('  - remainingTokens (converted):', newRecord.remainingTokens);
      console.log('📝 Full payment record:', newRecord);
      
      // Add to payment records immediately
      setPaymentRecords(prev => {
        const updated = [newRecord, ...prev];
        console.log('📋 Updated payment records list, now has', updated.length, 'records');
        return updated;
      });
      
      // If Auto Pay is enabled and not streaming ended yet, pay immediately
      if (autoPayUserSetting && isStreamingActive) {
        console.log('🚀 Auto Pay: Immediately paying chunk during streaming:', chunkId);
        
        // Mark as paying
        setCurrentlyPayingChunks(prev => new Set(prev).add(chunkId));
        
        setPaymentRecords(prev => 
          prev.map(record => 
            record.chunkId === chunkId 
              ? { ...record, isPaying: true }
              : record
          )
        );
        
        // Trigger payment immediately
        handlePayForChunkWithEnhancedInfo(chunkId, {
          cumulativePayment,
          remainingBalance,
          channelId,
          tokens
        });
      } else {
        console.log('⏸️ Auto Pay disabled or streaming ended - chunk will wait for manual payment or batch processing:', chunkId);
      }
    };

    window.addEventListener('tokenStreamUpdate', handlePaymentChannelData as EventListener);
    window.addEventListener('chunkPaymentSuccess', handleChunkPaymentSuccess as EventListener);
    window.addEventListener('newChunkArrived', handleNewChunkArrived as EventListener);
    
    console.log('✅ Event listeners added successfully');
    
    return () => {
      console.log('🧹 Cleaning up event listeners');
      window.removeEventListener('tokenStreamUpdate', handlePaymentChannelData as EventListener);
      window.removeEventListener('chunkPaymentSuccess', handleChunkPaymentSuccess as EventListener);
      window.removeEventListener('newChunkArrived', handleNewChunkArrived as EventListener);
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
    setCurrentlyPayingChunks(prev => new Set(prev).add(chunkId));
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
      
      // Remove from paying state
      setCurrentlyPayingChunks(prev => {
        const newSet = new Set(prev);
        newSet.delete(chunkId);
        return newSet;
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
                remainingTokens: result.remainingTokens
              }
            : record
        )
      );
      
      console.log(`✅ Successfully paid for chunk: ${chunkId} (${result.tokens} tokens)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      
      // Remove from paying state and mark as failed
      setCurrentlyPayingChunks(prev => {
        const newSet = new Set(prev);
        newSet.delete(chunkId);
        return newSet;
      });
      
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
    
    console.log('🔍 Pre-send validation - isDataLoading:', isDataLoading, 'paymentRecords.length:', paymentRecords.length);
    
    // Always fetch the latest chunk status to ensure we have current data
    try {
      const latestChunkResponse = await fetch('/api/chunks/latest', {
        credentials: 'include'
      });
      
      if (latestChunkResponse.ok) {
        const latestChunkResult = await latestChunkResponse.json();
        
        if (latestChunkResult.data.hasLatestChunk) {
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
      } else {
        console.log('⚠️ Failed to fetch latest chunk status - allowing send');
      }
    } catch (error) {
      console.error('Failed to fetch latest chunk status:', error);
      // Continue with normal validation if fetch fails
    }
    
    // Only generate new session ID if validation passes
    const sessionId = onNewQuestion();
    console.log('✅ Pre-send validation passed - new session ID:', sessionId);
    return true; // Allow sending
  }, [user, onAuthRequired, onNewQuestion, isDataLoading, paymentRecords]);
  
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
      {/* Persistent Payment Status Panel - Always visible when user is logged in */}
      {user && (
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
                  <span>Cumulative: {Math.floor((paymentRecords[0].consumedTokens || 0)).toLocaleString()} Tokens</span>
                  <span>Remaining: {Math.floor((paymentRecords[0].remainingTokens || 0)).toLocaleString()} Tokens</span>
                  <span className={`inline-flex h-2 w-2 rounded-full ${
                    paymentChannelInfo && paymentRecords[0].remainingTokens
                      ? paymentRecords[0].remainingTokens < paymentChannelInfo.channelTotalTokens * 0.1 ? 'bg-red-500' : 
                        paymentRecords[0].remainingTokens < paymentChannelInfo.channelTotalTokens * 0.3 ? 'bg-gray-400' : 'bg-gray-600'
                      : 'bg-gray-500'
                  }`} />
                  <span>
                    {paymentChannelInfo && paymentRecords[0].remainingTokens
                      ? Math.max(0, (paymentRecords[0].remainingTokens / paymentChannelInfo.channelTotalTokens * 100)).toFixed(1)
                      : '0.0'
                    }% remaining
                  </span>
                </div>
              )}
              
              {/* Fallback to channel info if no payment records */}
              {paymentRecords.length === 0 && paymentChannelInfo && (
                <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <span>Cumulative: {paymentChannelInfo.consumedTokens.toLocaleString()} Tokens</span>
                  <span>Remaining: {paymentChannelInfo.remainingTokens.toLocaleString()} Tokens</span>
                  <span className={`inline-flex h-2 w-2 rounded-full ${
                    paymentChannelInfo.remainingTokens < paymentChannelInfo.channelTotalTokens * 0.1 ? 'bg-red-500' : 
                    paymentChannelInfo.remainingTokens < paymentChannelInfo.channelTotalTokens * 0.3 ? 'bg-gray-400' : 'bg-gray-600'
                  }`} />
                  <span>{Math.max(0, (paymentChannelInfo.remainingTokens / paymentChannelInfo.channelTotalTokens * 100)).toFixed(1)}% remaining</span>
                </div>
              )}
              
              {/* Auto Pay Toggle Switch */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPayUserSetting}
                    onChange={(e) => {
                      const newSetting = e.target.checked;
                      setAutoPayUserSetting(newSetting);
                      // If not streaming, update Auto Pay immediately
                      if (!isStreamingActive) {
                        setAutoPayEnabled(newSetting);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 focus:ring-2"
                    disabled={isStreamingActive}
                  />
                  <span className="font-medium">
                    Auto Pay
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Payment Records List */}
          {paymentRecords.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment History:
              </div>
              {paymentRecords.map((record, index) => (
                <div key={`${record.chunkId}-${index}`} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded px-3 py-2 text-xs border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {record.chunkId.slice(-8)}...
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {record.tokens} tokens
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      Cumulative: {record.consumedTokens.toLocaleString()} Tokens
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Remaining: {record.remainingTokens.toLocaleString()} Tokens
                    </span>
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
                    <span className="text-gray-500 dark:text-gray-500">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                    
                    {/* Show Pay button for unpaid records */}
                    {!record.isPaying && record.isPaid === false && (
                      <Button
                        onClick={() => handlePayForChunk(record.chunkId)}
                        size="sm"
                        variant="default"
                        className="h-6 px-2 text-xs bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black"
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Pay'}
                      </Button>
                    )}
                    
                    {/* Show transaction details button for all records */}
                    <Button
                      onClick={() => setSelectedRecord(record)}
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

      {/* Transaction Details Modal - Enhanced for pre-send payment check */}
      {selectedRecord && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {showPaymentModal ? 'Payment Required' : 'Transaction Details'}
              </h3>
              <Button
                onClick={() => {
                  setSelectedRecord(null);
                  setShowPaymentModal(false);
                }}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
              >
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
                    Payment Status
                  </label>
                  <p className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {selectedRecord.isPaid === true && (
                      <span className="inline-flex items-center text-gray-600 dark:text-gray-400">
                        <Check className="h-4 w-4 mr-1" />
                        Paid
                      </span>
                    )}
                    {selectedRecord.isPaid === false && (
                      <span className="text-orange-600">Unpaid</span>
                    )}
                    {selectedRecord.isPaid === undefined && (
                      <span className="text-gray-500">Status unknown</span>
                    )}
                  </p>
                </div>
                <div>
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
                      timeZoneName: 'short'
                    })}
                  </p>
                </div>
              </div>
              
              {selectedRecord.transactionData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Data
                  </label>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedRecord.transactionData, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Payment action buttons for unpaid chunks */}
              {selectedRecord.isPaid === false && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <Button
                    onClick={() => {
                      setSelectedRecord(null);
                      setShowPaymentModal(false);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      handlePayForChunk(selectedRecord.chunkId);
                      setSelectedRecord(null);
                      setShowPaymentModal(false);
                    }}
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
                      'Pay Now'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};