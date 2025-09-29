import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository, PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const chunkRepo = new ChunkPaymentRepository();
    
    // Get unpaid chunks for this user and session
    const unpaidChunks = chunkRepo.getUnpaidChunksByUserSession(userId, sessionId);
    const unpaidTokensCount = chunkRepo.getUnpaidTokensCount(userId, sessionId);
    
    // Get user's default channel info
    const channelRepo = new PaymentChannelRepository();
    const defaultChannel = channelRepo.getUserDefaultChannel(userId);
    
    const canProceed = unpaidTokensCount === 0 || (defaultChannel && defaultChannel.amount - defaultChannel.consumed_tokens >= unpaidTokensCount);
    
    return NextResponse.json({
      success: true,
      data: {
        unpaidChunks: unpaidChunks.length,
        unpaidTokens: unpaidTokensCount,
        canProceed,
        defaultChannel: defaultChannel ? {
          channelId: defaultChannel.channel_id,
          remainingTokens: defaultChannel.amount - defaultChannel.consumed_tokens
        } : null
      }
    });
    
  } catch (error) {
    console.error('Check chunks API error:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;
    
    const { sessionId, action, chunkId, tokens } = await req.json();
    
    // Handle demo chunk creation
    if (chunkId && tokens && !action) {
      const chunkRepo = new ChunkPaymentRepository();
      
      try {
        const demoChunk = chunkRepo.createChunkPayment({
          chunk_id: chunkId,
          user_id: userId,
          session_id: sessionId || `demo_session_${Date.now()}`,
          tokens_count: tokens,
          is_paid: false
        });
        
        return NextResponse.json({
          success: true,
          message: 'Demo chunk created successfully',
          data: {
            chunkId: demoChunk.chunk_id,
            tokens: demoChunk.tokens_count,
            sessionId: demoChunk.session_id
          }
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to create demo chunk' },
          { status: 400 }
        );
      }
    }
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const chunkRepo = new ChunkPaymentRepository();
    const channelRepo = new PaymentChannelRepository();
    
    if (action === 'pay') {
      // Pay for unpaid chunks using default channel
      const unpaidChunks = chunkRepo.getUnpaidChunksByUserSession(userId, sessionId);
      const unpaidTokensCount = chunkRepo.getUnpaidTokensCount(userId, sessionId);
      
      if (unpaidTokensCount === 0) {
        return NextResponse.json({
          success: true,
          message: 'No unpaid chunks to process'
        });
      }
      
      // Get user's default channel
      const defaultChannel = channelRepo.getUserDefaultChannel(userId);
      
      if (!defaultChannel) {
        return NextResponse.json(
          { error: 'No default payment channel found' },
          { status: 400 }
        );
      }
      
      const remainingTokens = defaultChannel.amount - defaultChannel.consumed_tokens;
      
      if (remainingTokens < unpaidTokensCount) {
        return NextResponse.json(
          { error: `Insufficient tokens. Need ${unpaidTokensCount}, have ${remainingTokens}` },
          { status: 400 }
        );
      }
      
      // Mark chunks as paid
      const chunkIds = unpaidChunks.map(chunk => chunk.chunk_id);
      chunkRepo.markChunksAsPaid(chunkIds, defaultChannel.channel_id);
      
      // Note: consumed_tokens is updated during chat streaming, not during payment
      // Payment status is tracked separately from consumption
      
      return NextResponse.json({
        success: true,
        data: {
          paidChunks: chunkIds.length,
          paidTokens: unpaidTokensCount,
          remainingTokens: remainingTokens - unpaidTokensCount
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Process chunks API error:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}