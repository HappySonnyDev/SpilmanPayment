import { useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-context';

interface ChunkPaymentResult {
  success: boolean;
  chunkId: string;
  tokens: number;
  remainingTokens: number;
  error?: string;
}

interface PaymentChannelInfo {
  channelId: string;
  remainingTokens: number;
}

export function useChunkPayment() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<ChunkPaymentResult[]>([]);

  // Pay for a single chunk by chunk_id
  const payForChunk = useCallback(async (chunkId: string): Promise<ChunkPaymentResult> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsProcessing(true);
    
    try {
      console.log(`💰 Making payment request for chunk: ${chunkId}`);
      
      const response = await fetch('/api/chunks/pay-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chunkId }),
        credentials: 'include', // Important: Include cookies for authentication
      });

      console.log(`📋 Payment API response status: ${response.status}`);
      
      const result = await response.json();
      console.log(`📄 Payment API response:`, result);

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: Payment failed`);
      }

      const paymentResult: ChunkPaymentResult = {
        success: true,
        chunkId: result.data.chunkId,
        tokens: result.data.tokens,
        remainingTokens: result.data.remainingTokens,
      };

      // Add to payment history
      setPaymentHistory(prev => [...prev, paymentResult]);

      return paymentResult;
    } catch (error) {
      const paymentResult: ChunkPaymentResult = {
        success: false,
        chunkId,
        tokens: 0,
        remainingTokens: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      setPaymentHistory(prev => [...prev, paymentResult]);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  // Get current payment channel info
  const getChannelInfo = useCallback(async (): Promise<PaymentChannelInfo | null> => {
    if (!user) return null;

    try {
      const response = await fetch('/api/chunks/check-all', {
        credentials: 'include' // Include cookies for authentication
      });
      if (!response.ok) return null;

      const result = await response.json();
      return result.data.defaultChannel;
    } catch {
      return null;
    }
  }, [user]);

  // Clear payment history
  const clearHistory = useCallback(() => {
    setPaymentHistory([]);
  }, []);

  return {
    payForChunk,
    getChannelInfo,
    isProcessing,
    paymentHistory,
    clearHistory,
  };
}