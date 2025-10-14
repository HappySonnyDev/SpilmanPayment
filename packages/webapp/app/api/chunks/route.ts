import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { ChunkPaymentRepository, PaymentChannelRepository } from '@/lib/server/database';
import { withAuth, ApiResponse } from '@/lib/server/api-middleware';

async function getChunksHandler(req: NextRequest) {
  // Require authentication
  const user = await requireAuth(req);
  const userId = user.id;
  
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return ApiResponse.error('sessionId is required', 400);
  }

  const chunkRepo = new ChunkPaymentRepository();
  
  // Get unpaid chunks for this user and session
  const unpaidChunks = chunkRepo.getUnpaidChunksByUserSession(userId, sessionId);
  const unpaidTokensCount = chunkRepo.getUnpaidTokensCount(userId, sessionId);
  
  // Get user's default channel info
  const channelRepo = new PaymentChannelRepository();
  const defaultChannel = channelRepo.getUserDefaultChannel(userId);
  
  const canProceed = unpaidTokensCount === 0 || (defaultChannel && defaultChannel.amount - defaultChannel.consumed_tokens >= unpaidTokensCount);
  
  return ApiResponse.success({
    unpaidChunks: unpaidChunks.length,
    unpaidTokens: unpaidTokensCount,
    canProceed,
    defaultChannel: defaultChannel ? {
      channelId: defaultChannel.channel_id,
      remainingTokens: defaultChannel.amount - defaultChannel.consumed_tokens
    } : null
  });
}

async function postChunksHandler(req: NextRequest) {
  // Require authentication
  const user = await requireAuth(req);
  const userId = user.id;
  
  const { sessionId, action, chunkId, tokens } = await req.json();
  
  // Handle demo chunk creation
  if (chunkId && tokens && !action) {
    const chunkRepo = new ChunkPaymentRepository();
    
    const demoChunk = chunkRepo.createChunkPayment({
      chunk_id: chunkId,
      user_id: userId,
      session_id: sessionId || `demo_session_${Date.now()}`,
      tokens_count: tokens,
      is_paid: false
    });
    
    return ApiResponse.success({
      chunkId: demoChunk.chunk_id,
      tokens: demoChunk.tokens_count,
      sessionId: demoChunk.session_id
    });
  }
  
  if (!sessionId) {
    return ApiResponse.error('sessionId is required');
  }

  const chunkRepo = new ChunkPaymentRepository();
  const channelRepo = new PaymentChannelRepository();
  
  if (action === 'pay') {
    // Pay for unpaid chunks using default channel
    const unpaidChunks = chunkRepo.getUnpaidChunksByUserSession(userId, sessionId);
    const unpaidTokensCount = chunkRepo.getUnpaidTokensCount(userId, sessionId);
    
    if (unpaidTokensCount === 0) {
      return ApiResponse.success({ message: 'No unpaid chunks to process' });
    }
    
    // Get user's default channel
    const defaultChannel = channelRepo.getUserDefaultChannel(userId);
    
    if (!defaultChannel) {
      return ApiResponse.error('No default payment channel found');
    }
    
    const remainingTokens = defaultChannel.amount - defaultChannel.consumed_tokens;
    
    if (remainingTokens < unpaidTokensCount) {
      return ApiResponse.error(`Insufficient tokens. Need ${unpaidTokensCount}, have ${remainingTokens}`);
    }
    
    // Mark chunks as paid
    const chunkIds = unpaidChunks.map(chunk => chunk.chunk_id);
    chunkRepo.markChunksAsPaid(chunkIds, defaultChannel.channel_id);
    
    // Note: consumed_tokens is updated during chat streaming, not during payment
    // Payment status is tracked separately from consumption
    
    return ApiResponse.success({
      paidChunks: chunkIds.length,
      paidTokens: unpaidTokensCount,
      remainingTokens: remainingTokens - unpaidTokensCount
    });
  }
  
  return ApiResponse.error('Invalid action');
}

// Export wrapped handlers
export const GET = withAuth(getChunksHandler);
export const POST = withAuth(postChunksHandler);