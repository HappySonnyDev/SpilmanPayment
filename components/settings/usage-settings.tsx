"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Star, Activity, Eye, Check, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentChannels, PaymentChannel } from "@/hooks/use-payment-channels";
import { useChunkPayment } from "@/hooks/use-chunk-payment";
import { channel } from "@/lib/api";
import { formatDbTimeToLocal, calculateDaysRemaining, isChannelExpired } from "@/lib/date-utils";
import { DataDisplay } from "@/components/bussiness/data-display";

interface LatestChunk {
  chunkId: string;
  tokens: number;
  consumedTokens: number;
  remainingTokens: number;
  timestamp: string;
  isPaid: boolean;
  transactionData?: Record<string, unknown>;
  buyerSignature?: string;
}

export const UsageSettings: React.FC = () => {
  const { channels, activeChannels, isLoading, refetch } = usePaymentChannels();
  const { payForChunk, isProcessing } = useChunkPayment();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [latestChunk, setLatestChunk] = useState<LatestChunk | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);

  // Auto-select default channel when channels are loaded
  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      const defaultChannel = channels.find(channel => channel.isDefault && channel.status === 2);
      if (defaultChannel) {
        setSelectedChannelId(defaultChannel.channelId);
      } else {
        // If no default, select first active channel
        const activeChannel = channels.find(channel => channel.status === 2);
        if (activeChannel) {
          setSelectedChannelId(activeChannel.channelId);
        }
      }
    }
  }, [channels, selectedChannelId]);

  // Fetch latest chunk when selected channel changes
  useEffect(() => {
    if (selectedChannelId) {
      fetchLatestChunk(selectedChannelId);
    }
  }, [selectedChannelId]);

  const fetchLatestChunk = async (channelId: string) => {
    try {
      setChunkLoading(true);
      const response = await fetch(`/api/chunks/latest?channel_id=${channelId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.data.hasLatestChunk) {
          setLatestChunk(result.data.latestChunk);
        } else {
          setLatestChunk(null);
        }
      } else {
        setLatestChunk(null);
      }
    } catch (error) {
      console.error('Failed to fetch latest chunk:', error);
      setLatestChunk(null);
    } finally {
      setChunkLoading(false);
    }
  };

  const handleSetAsDefault = async (channelId: string) => {
    try {
      setActionLoading(true);
      
      await channel.setDefault({
        channelId,
      });
      
      alert('Channel set as default successfully!');
      await refetch(); // Refresh data
    } catch (error) {
      console.error('Error setting default channel:', error);
      alert('Failed to set as default: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayForChunk = async (chunkId: string) => {
    if (!latestChunk || !selectedChannel) {
      alert('Missing chunk or channel information');
      return;
    }

    try {
      // Calculate enhanced payment info similar to chunk-aware-composer
      const cumulativePayment = latestChunk.consumedTokens * 100; // Convert tokens to CKB
      const remainingBalance = latestChunk.remainingTokens * 100; // Convert tokens to CKB
      
      const result = await payForChunk(chunkId, {
        cumulativePayment,
        remainingBalance,
        channelId: selectedChannel.channelId,
        tokens: latestChunk.tokens
      });
      
      console.log(`✅ Successfully paid for chunk: ${chunkId} (${result.tokens} tokens)`);
      
      // Emit chunkPaymentSuccess event to notify Payment History
      const chunkPaymentSuccessEvent = new CustomEvent('chunkPaymentSuccess', {
        detail: {
          chunkId,
          tokens: latestChunk.tokens,
          paidAmount: cumulativePayment,
          remainingAmount: remainingBalance,
          timestamp: new Date().toISOString(),
          transactionData: result.transactionData
        }
      });
      window.dispatchEvent(chunkPaymentSuccessEvent);
      
      // Refresh the latest chunk data after payment
      if (selectedChannelId) {
        await fetchLatestChunk(selectedChannelId);
      }
      
      alert('Payment successful!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      console.error(`❌ Failed to pay for chunk ${chunkId}:`, error);
      alert(`Payment failed: ${errorMessage}`);
    }
  };


  const selectedChannel = channels.find(channel => channel.channelId === selectedChannelId);

  // Calculate usage statistics
  const getUsageStats = (channel: PaymentChannel) => {
    const totalTokens = channel.amount * 0.01; // 1 CKB = 0.01 Token conversion
    const consumedTokens = channel.consumedTokens;
    const remainingTokens = totalTokens - consumedTokens;
    const usagePercentage = (consumedTokens / totalTokens) * 100;
    
    // Calculate days remaining using the utility function
    const daysRemaining = calculateDaysRemaining(channel.verifiedAt || null, channel.durationDays);
    
    // Format remaining time display
    let timeRemainingDisplay;
    if (daysRemaining > 0) {
      timeRemainingDisplay = `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;
    } else if (daysRemaining === 0) {
      timeRemainingDisplay = 'Less than 1 day';
    } else {
      timeRemainingDisplay = 'Expired';
    }
    
    // Calculate end date for display
    const startDate = new Date(channel.verifiedAt && channel.verifiedAt !== null ? channel.verifiedAt : channel.createdAt);
    const durationInSeconds = channel.durationSeconds || (channel.durationDays * 24 * 60 * 60);
    const endDate = new Date(startDate.getTime() + (durationInSeconds * 1000));
    
    return {
      totalTokens,
      consumedTokens,
      remainingTokens,
      usagePercentage,
      daysRemaining,
      timeRemainingDisplay,
      endDate,
      isExpired: isChannelExpired(channel.verifiedAt || null, channel.durationDays)
    };
  };

  const formatDate = (dateString: string) => {
    return formatDbTimeToLocal(dateString, 'MMM DD, YYYY');
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-none h-[600px] overflow-y-scroll p-8">
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Loading usage data...
          </p>
        </div>
      </div>
    );
  }

  if (activeChannels.length === 0) {
    return (
      <div className="w-full max-w-none h-[600px] overflow-y-scroll p-8">
        <h3 className="mb-6 text-lg font-semibold">Usage Statistics</h3>
        <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
          <div className="p-8 text-center">
            <Activity className="mx-auto h-12 w-12 text-slate-400 mb-4" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              No active payment channels found.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Create and activate a payment channel to view usage statistics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stats = selectedChannel ? getUsageStats(selectedChannel) : null;

  return (
    <div className="w-full max-w-none h-[600px] overflow-y-scroll p-8">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Usage Statistics</h3>
        
        <div className="flex items-center space-x-3">
          
        
          <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
            <SelectTrigger className="w-54 text-center">
              <SelectValue placeholder="Select a channel">
                {selectedChannelId && (() => {
                  const channel = activeChannels.find(c => c.channelId === selectedChannelId);
                  return channel ? (
                    <span className="flex items-center justify-center gap-1">
                      <span>...{channel.channelId.slice(-6)} - {channel.amount.toLocaleString()} CKB</span>
                      {channel.isDefault && <Star className="h-3 w-3" />}
                    </span>
                  ) : 'Select a channel';
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {activeChannels.map((channel) => (
                <SelectItem key={channel.channelId} value={channel.channelId}>
                  <span className="flex items-center gap-1">
                    <span>...{channel.channelId.slice(-6)} - {channel.amount.toLocaleString()} CKB</span>
                    {channel.isDefault && <Star className="h-3 w-3" />}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedChannel && stats && (
        <div className="space-y-6">
       
          {/* Channel Info Header */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4 min-h-[2.5rem]">
              <div className="flex items-center space-x-3">
                <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  Channel Overview
                </h4>
                {selectedChannel.isDefault && (
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    <Star className="h-3 w-3 mr-1" />
                    Default
                  </span>
                )}
              </div>
              
              <div className="flex items-center min-h-[2rem]">
                {!selectedChannel.isDefault && (
                  <Button
                    onClick={() => handleSetAsDefault(selectedChannel.channelId)}
                    disabled={actionLoading}
                    size="sm"
                    variant="outline"
                  >
                    {actionLoading ? 'Setting...' : 'Set as Default'}
                  </Button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.totalTokens.toLocaleString()}
                </p>
                <p className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">Total Tokens</p>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.remainingTokens.toLocaleString()}
                </p>
                <p className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">Remaining</p>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-300">
                  {stats.timeRemainingDisplay}
                </p>
                <p className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">Time Left</p>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-300">
                  {formatDate(stats.endDate.toISOString())}
                </p>
                <p className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">Expires On</p>
              </div>
            </div>
          </div>

          {/* Usage Progress */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                Token Usage
              </h4>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {stats.consumedTokens.toLocaleString()} / {stats.totalTokens.toLocaleString()} tokens
              </span>
            </div>
            
            <div className="w-full bg-slate-200 rounded-full h-3 mb-2 dark:bg-slate-700">
              <div 
                className="bg-slate-600 h-3 rounded-full transition-all duration-300 dark:bg-slate-400" 
                style={{ width: `${Math.min(stats.usagePercentage, 100)}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>0</span>
              <span className="font-medium">
                {stats.usagePercentage.toFixed(1)}% used
              </span>
              <span>{stats.totalTokens.toLocaleString()}</span>
            </div>
          </div>

          {/* Latest Transaction - Separate Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                Latest Transaction
              </h4>
              {chunkLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
            
            {latestChunk ? (
              <div className="space-y-4">
                {/* Basic Information Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <DataDisplay
                      title="Chunk ID"
                      data={latestChunk.chunkId}
                      className="mb-0"
                    />
                  </div>
                  <div>
                    <DataDisplay
                      title="Tokens Consumed"
                      data={`${latestChunk.tokens} tokens`}
                      className="mb-0"
                    />
                  </div>
                  <div>
                    <DataDisplay
                      title="Payment Status"
                      data={latestChunk.isPaid ? "✓ Paid" : "Unpaid"}
                      className="mb-0"
                    />
                  </div>
                  <div>
                    <DataDisplay
                      title="Timestamp"
                      data={formatDbTimeToLocal(latestChunk.timestamp, 'YYYY-MM-DD HH:mm:ss')}
                      className="mb-0"
                    />
                  </div>
                  <div>
                    <DataDisplay
                      title="Consumed Tokens"
                      data={`${latestChunk.consumedTokens.toLocaleString()} Tokens`}
                      className="mb-0"
                    />
                  </div>
                  <div>
                    <DataDisplay
                      title="Remaining Tokens"
                      data={`${latestChunk.remainingTokens.toLocaleString()} Tokens`}
                      className="mb-0"
                    />
                  </div>
                </div>
                
                {/* Buyer Signature - Only show if available */}
                {latestChunk.buyerSignature && (
                  <DataDisplay
                    title="Buyer Signature"
                    data={latestChunk.buyerSignature}
                  />
                )}
                
                {/* Transaction Data - Only show if paid and has transaction data */}
                {latestChunk.isPaid && latestChunk.transactionData && (
                  <DataDisplay
                    title="Transaction Data"
                    data={latestChunk.transactionData}
                  />
                )}
                
                {/* Pay Button - Only show if unpaid */}
                {!latestChunk.isPaid && (
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => handlePayForChunk(latestChunk.chunkId)}
                      size="lg"
                      variant="default"
                      className="bg-slate-900 px-8 py-6 text-xl font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        'Pay'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 text-center">
                <Activity className="mx-auto h-8 w-8 text-slate-400 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  No chunk transactions found for this channel.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Start a conversation to see transaction records here.
                </p>
              </div>
            )}
          </div>

          {/* Channel Details */}
          <div className="grid grid-cols-1 gap-6">
            {/* Channel ID Info */}
            {/* <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 p-6 dark:border-slate-700/40 dark:bg-slate-800">
              <h4 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-300">
                Channel Information
              </h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Channel ID:</span>
                <span className="text-sm font-mono bg-white dark:bg-slate-900 px-3 py-1 rounded border">
                  {selectedChannel.channelId}
                </span>
              </div>
            </div> */}
          </div>
        </div>
      )}
    </div>
  );
};