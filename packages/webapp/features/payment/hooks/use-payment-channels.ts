import { useState, useEffect, useCallback } from 'react';
import { channel } from '@/lib/client/api';

export interface PaymentChannel {
  id: number;
  channelId: string;
  amount: number;
  durationDays: number;
  durationSeconds?: number;
  status: number;
  statusText: string;
  isDefault: boolean;
  consumedTokens: number;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  sellerSignature: string | null;
  refundTxData: string | null;
  fundingTxData: string | null;
  settleTxData: string | null;
}

export const usePaymentChannels = () => {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await channel.list();
      setChannels(result.data.channels as PaymentChannel[]);
    } catch (error) {
      console.error('Error fetching payment channels:', error);
      setError(error instanceof Error ? error.message : 'Failed to load payment channels');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on hook initialization
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Computed values
  const activeChannels = channels.filter(channel => channel.status === 2);
  const defaultChannel = channels.find(channel => channel.isDefault && channel.status === 2);

  return {
    channels,
    activeChannels,
    defaultChannel,
    isLoading,
    error,
    refetch: fetchChannels,
  };
};