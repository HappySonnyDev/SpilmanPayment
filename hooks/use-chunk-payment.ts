import { useState, useCallback } from 'react';
import { useAuth } from '@/app/context/auth-context';
import { usePaymentTransaction, PaymentTransactionData } from './use-payment-transaction';
import { jsonStr } from '@/lib/ckb';

interface ChunkPaymentResult {
  success: boolean;
  chunkId: string;
  tokens: number;
  remainingTokens: number;
  transactionData?: PaymentTransactionData;
  error?: string;
}

interface PaymentChannelInfo {
  channelId: string;
  remainingTokens: number;
}

interface ChunkPaymentInfo {
  cumulativePayment: number; // Amount in CKB to pay to seller
  remainingBalance: number;  // Amount in CKB to return to buyer
  channelId: string;
  tokens: number; // Number of tokens consumed
}

export function useChunkPayment() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<ChunkPaymentResult[]>([]);
  const { constructPaymentTransaction } = usePaymentTransaction();

  // Enhanced payment with transaction construction
  const enhancedPayForChunk = useCallback(async (
    chunkId: string,
    paymentInfo: ChunkPaymentInfo
  ): Promise<ChunkPaymentResult> => {
    try {
      // Get payment channel tx_hash from user's active channel
      const activeChannel = user?.active_channel;
      
      if (!activeChannel) {
        throw new Error('No active payment channel found');
      }
      
      const channelTxHash = activeChannel.txHash;
      
      if (!channelTxHash) {
        throw new Error('Payment channel has no confirmed transaction hash');
      }
      
      console.log('🎗️ Constructing payment transaction for chunk:', chunkId);
      
      // Construct payment transaction and signatures
      const transactionResult = await constructPaymentTransaction(
        chunkId,
        paymentInfo.cumulativePayment,
        paymentInfo.remainingBalance,
        paymentInfo.channelId,
        channelTxHash
      );
      
      if (!transactionResult.success || !transactionResult.transactionData) {
        throw new Error(transactionResult.error || 'Failed to construct payment transaction');
      }
      
      console.log('💾 Sending enhanced payment request...');
      
      // Send enhanced payment request with transaction data
      const response = await fetch('/api/chunks/pay-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonStr({
          chunkId,
          paymentInfo,
          transactionData: transactionResult.transactionData
        }),
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Enhanced payment failed');
      }
      
      console.log('✅ Enhanced payment successful:', result);
      
      return {
        success: true,
        chunkId: result.data.chunkId,
        tokens: result.data.tokens,
        remainingTokens: result.data.remainingBalance,
        transactionData: transactionResult.transactionData
      };
      
    } catch (error) {
      console.error('❌ Enhanced payment failed:', error);
      throw error;
    }
  }, [constructPaymentTransaction]);

  // Pay for a single chunk using enhanced payment method
  const payForChunk = useCallback(async (
    chunkId: string,
    paymentInfo: ChunkPaymentInfo
  ): Promise<ChunkPaymentResult> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsProcessing(true);
    
    try {
      console.log(`💰 Making enhanced payment request for chunk: ${chunkId}`);
      
      // Use the enhanced payment method with payment info
      const result = await enhancedPayForChunk(chunkId, paymentInfo);
      setPaymentHistory(prev => [...prev, result]);
      return result;
      
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
  }, [user, enhancedPayForChunk]);

  // Note: Removed getChannelInfo function that used check-all endpoint
  // Channel info is now obtained through other means

  // Clear payment history
  const clearHistory = useCallback(() => {
    setPaymentHistory([]);
  }, []);

  return {
    payForChunk,
    isProcessing,
    paymentHistory,
    clearHistory,
  };
}