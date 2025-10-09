"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Star, Activity } from "lucide-react";

interface PaymentChannel {
  id: number;
  channelId: string;
  amount: number;
  durationDays: number;
  durationSeconds?: number; // Add optional seconds field
  status: number;
  statusText: string;
  isDefault: boolean;
  consumedTokens: number;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string; // Add verifiedAt field
}

export const UsageSettings: React.FC = () => {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<object | null>(null);
  // Removed unpaidTokens state - Usage page now relies on database consumed_tokens

  // Fetch payment channels on component mount
  useEffect(() => {
    fetchPaymentChannels();
  }, []);

  // Remove auto-refresh to avoid unnecessary API calls
  // Only refresh when user explicitly clicks the refresh button

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

  const fetchPaymentChannels = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/channel/list');
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment channels');
      }
      
      const result = await response.json();
      setChannels(result.data.channels);
      
    } catch (error) {
      console.error('Error fetching payment channels:', error);
      alert('Failed to load payment channels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetAsDefault = async (channelId: string) => {
    try {
      setActionLoading(true);
      
      const response = await fetch('/api/channel/set-default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set as default');
      }
      
      alert('Channel set as default successfully!');
      await fetchPaymentChannels(); // Refresh data
    } catch (error) {
      console.error('Error setting default channel:', error);
      alert('Failed to set as default: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const fetchDebugInfo = async () => {
    try {
      const response = await fetch('/api/debug/payment-status');
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data.debug);
        console.log('Debug Info:', data.debug);
      } else {
        console.error('Failed to fetch debug info');
      }
    } catch (error) {
      console.error('Error fetching debug info:', error);
    }
  };

  const selectedChannel = channels.find(channel => channel.channelId === selectedChannelId);
  const activeChannels = channels.filter(channel => channel.status === 2); // Only active channels

  // Calculate usage statistics
  const getUsageStats = (channel: PaymentChannel) => {
    const totalTokens = channel.amount * 0.01; // 1 CKB = 0.01 Token conversion
    const consumedTokens = channel.consumedTokens;
    const remainingTokens = totalTokens - consumedTokens;
    const usagePercentage = (consumedTokens / totalTokens) * 100;
    
    // Calculate days remaining - use verifiedAt for active channels, createdAt for inactive
    const startDate = new Date(channel.verifiedAt && channel.verifiedAt !== null ? channel.verifiedAt : channel.createdAt);
    // Use duration in seconds if available, otherwise convert days to seconds
    const durationInSeconds = channel.durationSeconds || (channel.durationDays * 24 * 60 * 60);
    const endDate = new Date(startDate.getTime() + (durationInSeconds * 1000));
    const now = new Date();
    
    // Calculate remaining time in different units
    const remainingMs = Math.max(0, endDate.getTime() - now.getTime());
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const remainingDays = Math.floor(remainingSeconds / (24 * 60 * 60));
    const remainingHours = Math.floor((remainingSeconds % (24 * 60 * 60)) / 3600);
    const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
    
    // Format remaining time display
    let timeRemainingDisplay;
    if (remainingDays > 0) {
      timeRemainingDisplay = `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    } else if (remainingHours > 0) {
      timeRemainingDisplay = `${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
    } else if (remainingMinutes > 0) {
      timeRemainingDisplay = `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    } else if (remainingSeconds > 0) {
      timeRemainingDisplay = `${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
    } else {
      timeRemainingDisplay = 'Expired';
    }
    
    return {
      totalTokens,
      consumedTokens,
      remainingTokens,
      usagePercentage,
      daysRemaining: remainingDays,
      timeRemainingDisplay,
      endDate,
      isExpired: remainingMs <= 0
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Shanghai'
    });
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
          {/* Debug Button */}
          <Button
            onClick={fetchDebugInfo}
            size="sm"
            variant="secondary"
          >
            Debug
          </Button>
          
          {/* Refresh Button */}
          <Button
            onClick={fetchPaymentChannels}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            {isLoading ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          
          {/* Channel Selector */}
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Channel:
          </span>
          <select 
            value={selectedChannelId} 
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="">Select a channel</option>
            {activeChannels.map((channel) => (
              <option key={channel.channelId} value={channel.channelId}>
                ...{channel.channelId.slice(-6)} - {channel.amount.toLocaleString()} CKB
                {channel.isDefault ? ' ⭐' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedChannel && stats && (
        <div className="space-y-6">
          {/* Debug Info Panel */}
          {debugInfo && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                Debug Information
              </h4>
              <pre className="text-xs text-red-700 dark:text-red-400 overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
          {/* Channel Info Header */}
          <div className="rounded-lg border border-gray-100/30 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-slate-700/40 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  Channel Overview
                </h4>
                {selectedChannel.isDefault && (
                  <span className="inline-flex rounded-full px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <Star className="h-3 w-3 mr-1" />
                    Default
                  </span>
                )}
              </div>
              
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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalTokens.toLocaleString()}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Tokens</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.remainingTokens.toLocaleString()}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Remaining</p>
              </div>
              <div className="space-y-1">
                <p className={`text-2xl font-bold ${stats.isExpired ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400'}`}>
                  {stats.timeRemainingDisplay}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Time Left</p>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {formatDate(stats.endDate.toISOString())}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Expires On</p>
              </div>
            </div>
          </div>

          {/* Usage Progress */}
          <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 p-6 dark:border-slate-700/40 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                Token Usage
              </h4>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {stats.consumedTokens.toLocaleString()} / {stats.totalTokens.toLocaleString()} tokens
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
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