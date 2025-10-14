/**
 * Real-time token tracking utilities for streaming responses
 */

// Simple token counting function (approximation based on text length)
export function countTokens(text: string): number {
  // This is a simple approximation - in production you might want to use
  // a more accurate tokenizer like tiktoken
  // Roughly 4 characters = 1 token for most models
  return Math.ceil(text.length / 4);
}

// Generate unique chunk ID
export function generateChunkId(): string {
  return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Token tracker class for real-time streaming
export class StreamingTokenTracker {
  private userId: number;
  private sessionId: string;
  private chunks: Array<{
    chunkId: string;
    tokens: number;
    timestamp: number;
    isPaid: boolean;
  }> = [];

  constructor(userId: number, sessionId: string) {
    this.userId = userId;
    this.sessionId = sessionId;
  }

  // Add a new chunk and track its tokens
  addChunk(chunkId: string, text: string): number {
    const tokens = countTokens(text);
    this.chunks.push({
      chunkId,
      tokens,
      timestamp: Date.now(),
      isPaid: false
    });
    return tokens;
  }

  // Get total unpaid tokens for this session
  getUnpaidTokens(): number {
    return this.chunks
      .filter(chunk => !chunk.isPaid)
      .reduce((total, chunk) => total + chunk.tokens, 0);
  }

  // Get all unpaid chunks
  getUnpaidChunks() {
    return this.chunks.filter(chunk => !chunk.isPaid);
  }

  // Mark chunks as paid
  markChunksAsPaid(chunkIds: string[]) {
    this.chunks.forEach(chunk => {
      if (chunkIds.includes(chunk.chunkId)) {
        chunk.isPaid = true;
      }
    });
  }

  // Get session summary
  getSessionSummary() {
    const totalTokens = this.chunks.reduce((total, chunk) => total + chunk.tokens, 0);
    const paidTokens = this.chunks
      .filter(chunk => chunk.isPaid)
      .reduce((total, chunk) => total + chunk.tokens, 0);
    const unpaidTokens = totalTokens - paidTokens;

    return {
      totalTokens,
      paidTokens,
      unpaidTokens,
      totalChunks: this.chunks.length,
      unpaidChunks: this.chunks.filter(chunk => !chunk.isPaid).length
    };
  }
}

// Global token tracker storage (in production, this should be in a database or Redis)
const activeTrackers = new Map<string, StreamingTokenTracker>();

export function getOrCreateTracker(userId: number, sessionId: string): StreamingTokenTracker {
  const key = `${userId}_${sessionId}`;
  if (!activeTrackers.has(key)) {
    activeTrackers.set(key, new StreamingTokenTracker(userId, sessionId));
  }
  return activeTrackers.get(key)!;
}

export function removeTracker(userId: number, sessionId: string): void {
  const key = `${userId}_${sessionId}`;
  activeTrackers.delete(key);
}