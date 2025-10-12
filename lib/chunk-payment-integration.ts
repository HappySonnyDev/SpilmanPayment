// Utility functions for integrating chunk-level payment with streaming responses

export interface ChunkInfo {
  chunkId: string;
  tokens: number;
  sessionId?: string;
}

export interface ChunkPaymentHandler {
  onChunkReceived: (chunkInfo: ChunkInfo) => Promise<void>;
  onPaymentSuccess: (chunkId: string, tokens: number) => void;
  onPaymentFailure: (chunkId: string, error: Error) => void;
}

/**
 * This function would be called when you receive streaming chunks from the AI response.
 * In a real implementation, you'd integrate this with your streaming response parser.
 * 
 * @param streamingResponse - The streaming response from the AI
 * @param paymentHandler - Handler for chunk payment events
 */
export async function processStreamingResponseWithPayment(
  streamingResponse: ReadableStream,
  paymentHandler: ChunkPaymentHandler
): Promise<string> {
  const reader = streamingResponse.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      
      // In a real implementation, you'd extract chunk_id from the response metadata
      // For now, we'll simulate this
      const chunkInfo: ChunkInfo = {
        chunkId: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tokens: Math.ceil(chunk.length / 4), // Approximate token count
      };
      
      // Handle chunk payment
      await paymentHandler.onChunkReceived(chunkInfo);
    }
  } finally {
    reader.releaseLock();
  }
  
  return fullResponse;
}

/**
 * Real-time chunk payment service
 */
export class ChunkPaymentService {
  private autoPayEnabled: boolean = true;
  private paymentQueue: Map<string, ChunkInfo> = new Map();
  private paymentHistory: Array<{ chunkId: string; success: boolean; error?: string }> = [];

  constructor(autoPayEnabled: boolean = true) {
    this.autoPayEnabled = autoPayEnabled;
  }

  async payForChunk(chunkId: string): Promise<void> {
    try {
      // Note: Enhanced payment is now handled directly in the chunk-aware-composer
      // This method is kept for compatibility but should use the enhanced payment flow
      throw new Error('Direct chunk payment not supported. Use enhanced payment flow in chunk-aware-composer.');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.paymentHistory.push({ chunkId, success: false, error: errorMessage });
      
      console.error(`❌ Failed to pay for chunk ${chunkId}:`, error);
      throw error;
    }
  }

  async handleChunkReceived(chunkInfo: ChunkInfo): Promise<void> {
    this.paymentQueue.set(chunkInfo.chunkId, chunkInfo);
    
    if (this.autoPayEnabled) {
      try {
        await this.payForChunk(chunkInfo.chunkId);
      } catch (error) {
        // Error already logged in payForChunk
      }
    }
  }

  getPendingPayments(): ChunkInfo[] {
    return Array.from(this.paymentQueue.values());
  }

  getPaymentHistory(): Array<{ chunkId: string; success: boolean; error?: string }> {
    return [...this.paymentHistory];
  }

  setAutoPayEnabled(enabled: boolean): void {
    this.autoPayEnabled = enabled;
  }

  isAutoPayEnabled(): boolean {
    return this.autoPayEnabled;
  }

  // Note: Removed payAllPending method as we now use direct chunk-level payment
}