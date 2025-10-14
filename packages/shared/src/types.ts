/**
 * Shared types used across webapp and contracts packages
 */

// Payment Channel Types
export interface PaymentChannel {
  id: string;
  userId: string;
  amount: number;
  balance: number;
  status: 'pending' | 'active' | 'settled' | 'expired';
  createdAt: string;
  expiresAt: string;
}

// Transaction Types
export interface PaymentResult {
  success: boolean;
  txHash?: string;
  channelStatus?: string;
  error?: string;
}

// CKB Script Types
export interface ScriptInfo {
  codeHash: string;
  hashType: 'data' | 'type' | 'data1' | 'data2';
  args: string;
}

// Export commonly used constants
export const CKB_SHANNON_RATIO = 100000000; // 1 CKB = 10^8 Shannon
