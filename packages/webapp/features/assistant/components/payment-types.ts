export interface PaymentRecord {
  chunkId: string;
  tokens: number;
  consumedTokens: number; // Cumulative tokens consumed (converted from CKB)
  remainingTokens: number; // Remaining tokens in channel (converted from CKB)
  timestamp: string;
  isPaid?: boolean; // Track payment status
  isPaying?: boolean; // Track loading state
  transactionData?: Record<string, unknown>;
}

export interface PaymentChannelInfo {
  consumedTokens: number;
  remainingTokens: number;
  channelId: string;
  channelTotalTokens: number;
  currentChunkTokens: number;
}
