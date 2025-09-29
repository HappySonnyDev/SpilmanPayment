import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository, PaymentChannelRepository } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;
    
    const { chunkId } = await req.json();
    
    if (!chunkId) {
      return NextResponse.json(
        { error: 'chunkId is required' },
        { status: 400 }
      );
    }
    
    const chunkRepo = new ChunkPaymentRepository();
    const channelRepo = new PaymentChannelRepository();
    
    // Get the specific chunk
    const chunk = chunkRepo.getChunkPaymentByChunkId(chunkId);
    
    if (!chunk) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 422 } // 422 Unprocessable Entity - the request is valid but the chunk doesn't exist
      );
    }
    
    // Verify the chunk belongs to this user
    if (chunk.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to chunk' },
        { status: 403 } // 403 Forbidden - user doesn't have permission to access this chunk
      );
    }
    
    // Check if already paid
    if (chunk.is_paid) {
      return NextResponse.json({
        success: true,
        message: 'Chunk already paid',
        data: {
          chunkId: chunk.chunk_id,
          tokens: chunk.tokens_count,
          alreadyPaid: true
        }
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
    
    if (remainingTokens < chunk.tokens_count) {
      return NextResponse.json(
        { error: `Insufficient tokens. Need ${chunk.tokens_count}, have ${remainingTokens}` },
        { status: 400 }
      );
    }
    
    // Mark chunk as paid
    chunkRepo.markChunksAsPaid([chunk.chunk_id], defaultChannel.channel_id);
    
    // Note: consumed_tokens is updated during chat streaming, not during payment
    // Payment status is tracked separately from consumption
    
    return NextResponse.json({
      success: true,
      message: `Successfully paid for chunk ${chunkId}`,
      data: {
        chunkId: chunk.chunk_id,
        tokens: chunk.tokens_count,
        sessionId: chunk.session_id,
        remainingTokens: remainingTokens - chunk.tokens_count
      }
    });
    
  } catch (error) {
    console.error('Single chunk payment API error:', error);
    
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