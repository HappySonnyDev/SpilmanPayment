"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Eye, Edit, Trash2, RefreshCw, Gavel, Loader2, Info } from "lucide-react";
import { formatDbTimeToLocal } from "@/lib/shared/date-utils";
import dayjs from 'dayjs';

interface PaymentChannel {
  id: number;
  channelId: string;
  userId: number;
  username: string;
  amount: number;
  durationDays: number;
  durationSeconds?: number; // Add optional seconds field
  status: number;
  statusText: string;
  consumed_tokens: number;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string; // Add verifiedAt field
  tx_hash?: string;
  settle_hash?: string;
}

export const PaymentChannelManagement: React.FC = () => {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<PaymentChannel | null>(null);
  const [showChannelDetails, setShowChannelDetails] = useState(false);
  const [settlingChannels, setSettlingChannels] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/channels');
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      } else {
        console.error('Failed to fetch payment channels');
      }
    } catch (error) {
      console.error('Error fetching payment channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = channels.filter(channel => 
    channel.channelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    channel.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (channel.tx_hash && channel.tx_hash.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (channel.settle_hash && channel.settle_hash.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return formatDbTimeToLocal(dateString, 'MM/DD/YYYY HH:mm:ss');
  };

  const getStatusBadge = (status: number, statusText: string) => {
    const baseClasses = "inline-flex rounded-full px-3 py-1 text-xs font-medium";
    
    switch (status) {
      case 1: // Inactive
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            {statusText}
          </Badge>
        );
      case 2: // Active
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            {statusText}
          </Badge>
        );
      case 3: // Invalid
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            {statusText}
          </Badge>
        );
      case 4: // Settled
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            {statusText}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
            {statusText}
          </Badge>
        );
    }
  };

  const handleViewChannel = (channel: PaymentChannel) => {
    setSelectedChannel(channel);
    setShowChannelDetails(true);
  };

  const updateChannelStatus = async (channelId: number, newStatus: number) => {
    try {
      const response = await fetch(`/api/admin/channels/${channelId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchChannels();
      } else {
        console.error('Failed to update channel status');
      }
    } catch (error) {
      console.error('Error updating channel status:', error);
    }
  };

  const settleChannel = async (channelId: number) => {
    try {
      setSettlingChannels(prev => new Set([...prev, channelId]));
      
      const response = await fetch(`/api/admin/channels/${channelId}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        // Format the alert message based on settlement type
        let alertMessage = `Channel settled successfully!\n`;
        if (result.txHash) {
          if (result.note) {
            alertMessage += `Settlement Type: ${result.note}\n`;
            alertMessage += `Reference ID: ${result.txHash}\n`;
          } else {
            alertMessage += `Transaction Hash: ${result.txHash}\n`;
          }
        }
        alertMessage += `Channel Status: ${result.channelStatus}`;
        
        alert(alertMessage);
        await fetchChannels();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to settle channel');
      }
    } catch (error) {
      console.error('Error settling channel:', error);
      alert(`Failed to settle channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSettlingChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  const formatDuration = (durationDays: number, durationSeconds?: number) => {
    // If we have duration in seconds, use that; otherwise fall back to days
    if (durationSeconds !== undefined && durationSeconds !== null) {
      if (durationSeconds < 60) {
        return `${durationSeconds}s`;
      } else if (durationSeconds < 3600) {
        return `${Math.floor(durationSeconds / 60)}m`;
      } else if (durationSeconds < 86400) {
        return `${Math.floor(durationSeconds / 3600)}h`;
      } else {
        const days = Math.floor(durationSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''}`;
      }
    }
    // Fallback to days format
    return `${durationDays} day${durationDays > 1 ? 's' : ''}`;
  };

  const getPeriodRange = (createdAt: string, verifiedAt: string | undefined, durationDays: number, durationSeconds?: number) => {
    // Use verifiedAt for active channels, createdAt for inactive channels
    const startDateStr = verifiedAt && verifiedAt !== null ? verifiedAt : createdAt;
    // Use duration in seconds if available, otherwise convert days to seconds
    const durationInSeconds = durationSeconds || (durationDays * 24 * 60 * 60);
    
    try {
      // Parse UTC time using dayjs and calculate end time
      const startUtc = dayjs.utc(startDateStr);
      const endUtc = startUtc.add(durationInSeconds, 'seconds');
      
      // Format both dates using the utility function
      const startFormatted = formatDbTimeToLocal(startDateStr, 'MM/DD/YYYY HH:mm:ss');
      const endFormatted = formatDbTimeToLocal(endUtc.toISOString(), 'MM/DD/YYYY HH:mm:ss');

      return `${startFormatted} - ${endFormatted}`;
    } catch (error) {
      console.error('Error parsing date in getPeriodRange:', error, { startDateStr, durationInSeconds });
      // Fallback to basic string formatting
      return `${startDateStr} - (Duration: ${durationDays} days)`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading payment channels...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by channel ID, username, tx hash, or settle hash..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={fetchChannels} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total Channels: {channels.length}
        </div>
      </div>

      {/* Channels Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-white dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Channel ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Consumed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredChannels.map((channel) => (
                <tr key={channel.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {channel.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                    <span title={channel.channelId}>
                      {channel.channelId.slice(0, 12)}...
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {channel.username} (ID: {channel.userId})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {channel.amount.toLocaleString()} CKB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDuration(channel.durationDays, channel.durationSeconds)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(channel.status, channel.statusText)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {channel.consumed_tokens.toLocaleString()} tokens
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(channel.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewChannel(channel)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {channel.status === 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateChannelStatus(channel.id, 2)}
                        className="text-green-600 hover:text-green-700"
                      >
                        Activate
                      </Button>
                    )}
                    {channel.status === 2 && (
                      <>
                        {/* <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateChannelStatus(channel.id, 3)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Invalidate
                        </Button> */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => settleChannel(channel.id)}
                                disabled={settlingChannels.has(channel.id)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                {settlingChannels.has(channel.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Gavel className="h-4 w-4" />
                                )}
                                {settlingChannels.has(channel.id) ? 'Settling...' : 'Settle'}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm max-w-xs">
                                Settlement will use blockchain transaction if chunk payment data is available,
                                otherwise will perform database-only settlement for administrative purposes.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredChannels.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No payment channels found.
          </div>
        )}
      </div>

      {/* Channel Details Modal */}
      {showChannelDetails && selectedChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Payment Channel Details
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChannelDetails(false)}
              >
                ×
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Channel ID</label>
                  <p className="text-sm text-gray-900 dark:text-white font-mono break-all bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {selectedChannel.channelId}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">User</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedChannel.username} (ID: {selectedChannel.userId})
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedChannel.amount.toLocaleString()} CKB
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDuration(selectedChannel.durationDays, selectedChannel.durationSeconds)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  {getStatusBadge(selectedChannel.status, selectedChannel.statusText)}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Consumed Tokens</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedChannel.consumed_tokens.toLocaleString()} tokens
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Period Range</label>
                  <p className="text-sm text-gray-900 dark:text-white font-mono">
                    {getPeriodRange(selectedChannel.createdAt, selectedChannel.verifiedAt, selectedChannel.durationDays, selectedChannel.durationSeconds)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Created At</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedChannel.createdAt)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Updated At</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedChannel.updatedAt)}
                  </p>
                </div>
                
                {selectedChannel.tx_hash && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Hash</label>
                    <p className="text-sm text-gray-900 dark:text-white font-mono break-all bg-gray-100 dark:bg-gray-700 p-2 rounded">
                      {selectedChannel.tx_hash}
                    </p>
                  </div>
                )}
                
                {selectedChannel.settle_hash && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Settlement Hash</label>
                    <p className="text-sm text-gray-900 dark:text-white font-mono break-all bg-gray-100 dark:bg-gray-700 p-2 rounded">
                      {selectedChannel.settle_hash}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};