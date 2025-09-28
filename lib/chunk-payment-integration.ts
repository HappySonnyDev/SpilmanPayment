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
      const response = await fetch('/api/chunks/pay-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment failed');
      }

      this.paymentHistory.push({ chunkId, success: true });
      this.paymentQueue.delete(chunkId);
      
      console.log(`✅ Successfully paid for chunk: ${chunkId}`);
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

  async payAllPending(): Promise<void> {
    const pending = this.getPendingPayments();
    const promises = pending.map(chunk => this.payForChunk(chunk.chunkId));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Some payments failed during batch payment:', error);
    }
  }
}