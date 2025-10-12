import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse
} from "ai";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ChunkPaymentRepository, PaymentChannelRepository } from "@/lib/database";
import { getOrCreateTracker, generateChunkId, countTokens } from "@/lib/token-tracker";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Initialize OpenRouter provider
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;

    const { messages }: { messages: UIMessage[] } = await req.json();

    // Always generate a new session ID for each API call (each question)
    const currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize token tracker for this session
    const tokenTracker = getOrCreateTracker(userId, currentSessionId);
    const chunkRepo = new ChunkPaymentRepository();
    const channelRepo = new PaymentChannelRepository();
    
    // Get user's default payment channel for calculations
    const defaultChannel = channelRepo.getUserDefaultChannel(userId);
    
    if (!defaultChannel) {
      return new Response(
        JSON.stringify({ error: "No active payment channel found. Please activate a payment channel first." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    
    // Get existing cumulative tokens for this channel to avoid race conditions
    const existingCumulativeTokens = chunkRepo.getChannelCumulativeTokensWithCurrent(defaultChannel.channel_id, 0);
    let sessionCumulativeTokens = 0; // Track tokens added in this session
    
    console.log('Streaming started for session:', currentSessionId, 'User:', userId);
    console.log('Channel existing cumulative tokens:', existingCumulativeTokens);
    
    // Create a UIMessageStream to include chunk payment data
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const result = streamText({
          model: openrouter("qwen/qwen3-14b:free"),
          // model: openrouter("deepseek/deepseek-r1-0528-qwen3-8b:free"),
          messages: convertToModelMessages(messages),
          onChunk: ({ chunk }) => {
            // Track tokens for each chunk in real-time
            if (chunk.type === 'text-delta' && chunk.text) {
              const chunkId = generateChunkId();
              const tokens = tokenTracker.addChunk(chunkId, chunk.text);
              
              // Check if user will have enough balance after cumulative payment
              // Use session-level tracking to avoid database race conditions
              const potentialSessionTokens = sessionCumulativeTokens + tokens;
              const totalCumulativeTokens = existingCumulativeTokens + potentialSessionTokens;
              // Convert tokens to CKB for balance check: 1 Token = 100 CKB (since 1 CKB = 0.01 Token)
              const totalCumulativePaymentCKB = totalCumulativeTokens * 100;
              const potentialRemainingBalance = defaultChannel.amount - totalCumulativePaymentCKB;
              
              if (potentialRemainingBalance < 0) {
                console.warn(`Insufficient balance: cumulative payment would be ${totalCumulativePaymentCKB} CKB for ${totalCumulativeTokens} tokens, channel only has ${defaultChannel.amount} CKB`);
                // Still create the chunk but mark as unpaid for payment tracking
                try {
                  chunkRepo.createChunkPayment({
                    chunk_id: chunkId,
                    user_id: userId,
                    session_id: currentSessionId,
                    channel_id: defaultChannel.channel_id,
                    tokens_count: tokens,
                    is_paid: false
                  });
                } catch (error) {
                  console.warn('Failed to store unpaid chunk payment:', error);
                }
                return; // Skip further processing for this chunk
              }
              
              // Two-stage approach: Create unpaid chunk first, payment updates consumed tokens later
              try {
                // Increment session token counter for this chunk
                sessionCumulativeTokens += tokens;
                
                // Create chunk record as UNPAID - payment is separate from consumption tracking
                chunkRepo.createChunkPayment({
                  chunk_id: chunkId,
                  user_id: userId,
                  session_id: currentSessionId,
                  channel_id: defaultChannel.channel_id,
                  tokens_count: tokens,
                  is_paid: false // Always create as unpaid for payment tracking
                });
                
                // Update channel consumed tokens immediately during streaming
                // This tracks actual consumption regardless of payment status
                const channelRepo = new PaymentChannelRepository();
                const updateStmt = channelRepo['db'].prepare(`
                  UPDATE payment_channels 
                  SET consumed_tokens = consumed_tokens + ?, updated_at = CURRENT_TIMESTAMP 
                  WHERE channel_id = ?
                `);
                updateStmt.run(tokens, defaultChannel.channel_id);
                
                console.log(`✅ Chunk created for payment tracking: ${tokens} tokens for chunk: ${chunkId} (isPaid: false)`);
                
                // Calculate cumulative payment using session tracking to avoid race conditions
                // This represents what the user should pay in total for all chunks in this channel
                const cumulativeTokens = existingCumulativeTokens + sessionCumulativeTokens;
                // Convert tokens to CKB for payment: 1 Token = 100 CKB (since 1 CKB = 0.01 Token)
                const cumulativePayment = cumulativeTokens * 100; // Convert tokens to CKB
                const remainingBalance = defaultChannel.amount - cumulativePayment;
                
                console.log(`Payment Channel ${defaultChannel.channel_id}: Session tokens so far: ${sessionCumulativeTokens}, Total cumulative: ${cumulativeTokens}`);
                console.log(`Payment Channel ${defaultChannel.channel_id}: Cumulative payment will be ${cumulativePayment}/${defaultChannel.amount} CKB (${remainingBalance} CKB remaining)`);
                
                // Send chunk payment data to the client with cumulative payment info
                writer.write({
                  type: 'data-chunk-payment' as const,
                  data: {
                    chunkId,
                    tokens,
                    sessionId: currentSessionId,
                    isPaid: false, // Chunk is unpaid - requires separate payment verification
                    cumulativePayment: cumulativePayment, // Total amount user should pay for all chunks in channel
                    remainingBalance: remainingBalance, // Amount user will receive back from channel
                    channelId: defaultChannel.channel_id,
                    channelTotalAmount: defaultChannel.amount
                  },
                  transient: true // Don't add to message history
                });
                
              } catch (error) {
                console.error('Failed to track token consumption:', error);
                // Fallback: still create unpaid chunk record
                try {
                  chunkRepo.createChunkPayment({
                    chunk_id: chunkId,
                    user_id: userId,
                    session_id: currentSessionId,
                    channel_id: defaultChannel.channel_id,
                    tokens_count: tokens,
                    is_paid: false
                  });
                } catch (fallbackError) {
                  console.warn('Failed to store unpaid chunk payment:', fallbackError);
                }
              }
            }
          }
        });
        
        // Merge the streamText result into our stream
        writer.merge(result.toUIMessageStream());
      }
    });
    
    // Create the response with session header
    const response = createUIMessageStreamResponse({ stream });
    response.headers.set('X-Session-ID', currentSessionId);
    
    return response;
    
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Error && error.message === "Authentication required") {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}