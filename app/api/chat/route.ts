import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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
    
    console.log('Streaming started for session:', currentSessionId, 'User:', userId);
    
    // Create a UIMessageStream to include chunk payment data
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const result = streamText({
          model: openrouter("deepseek/deepseek-chat-v3.1:free"),
          messages: convertToModelMessages(messages),
          onChunk: ({ chunk }) => {
            // Track tokens for each chunk in real-time
            if (chunk.type === 'text-delta' && chunk.text) {
              const chunkId = generateChunkId();
              const tokens = tokenTracker.addChunk(chunkId, chunk.text);
              
              // Store chunk payment record in database (unpaid initially)
              try {
                chunkRepo.createChunkPayment({
                  chunk_id: chunkId,
                  user_id: userId,
                  session_id: currentSessionId,
                  channel_id: defaultChannel.channel_id, // Associate with payment channel
                  tokens_count: tokens,
                  is_paid: false
                });
                
                console.log(`New chunk created: ${chunkId} (${tokens} tokens)`);
                
                // Calculate cumulative payment for this payment channel (Bitcoin-style)
                // This includes: consumed_tokens (already paid) + all unpaid tokens for this channel
                const currentConsumedTokens = defaultChannel.consumed_tokens || 0;
                const currentUnpaidTokens = chunkRepo.getChannelUnpaidTokens(defaultChannel.channel_id);
                
                // Total cumulative payment = already paid + currently unpaid (including this chunk)
                const cumulativePayment = currentConsumedTokens + currentUnpaidTokens;
                
                // Calculate remaining balance (total channel amount - cumulative payment)
                const remainingBalance = defaultChannel.amount - cumulativePayment;
                
                console.log(`Payment Channel ${defaultChannel.channel_id}: Cumulative ${cumulativePayment}/${defaultChannel.amount} tokens (${remainingBalance} remaining)`);
                
                // Send chunk payment data to the client with Bitcoin-style payment channel info
                writer.write({
                  type: 'data-chunk-payment' as const,
                  data: {
                    chunkId,
                    tokens,
                    sessionId: currentSessionId,
                    isPaid: false,
                    // Bitcoin-style unidirectional payment channel fields
                    cumulativePayment, // Total amount user should pay (sum of all tokens in this channel)
                    remainingBalance,  // User's remaining balance (total - cumulative)
                    channelId: defaultChannel.channel_id,
                    channelTotalAmount: defaultChannel.amount
                  },
                  transient: true // Don't add to message history
                });
                
              } catch (error) {
                console.warn('Failed to store chunk payment:', error);
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