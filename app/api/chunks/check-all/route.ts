import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository, PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;

    const chunkRepo = new ChunkPaymentRepository();
    
    // Get all unpaid chunks for this user (across all sessions)
    const unpaidTokensCount = chunkRepo.getUserTotalUnpaidTokens(userId);
    
    // Get user's default channel info
    const channelRepo = new PaymentChannelRepository();
    const defaultChannel = channelRepo.getUserDefaultChannel(userId);
    
    const canProceed = unpaidTokensCount === 0 || (defaultChannel && defaultChannel.amount - defaultChannel.consumed_tokens >= unpaidTokensCount);
    
    // Get unpaid chunks count (approximation)
    const unpaidChunksCount = Math.ceil(unpaidTokensCount / 5); // Assume average 5 tokens per chunk
    
    return NextResponse.json({
      success: true,
      data: {
        unpaidChunks: unpaidChunksCount,
        unpaidTokens: unpaidTokensCount,
        canProceed,
        defaultChannel: defaultChannel ? {
          channelId: defaultChannel.channel_id,
          remainingTokens: defaultChannel.amount - defaultChannel.consumed_tokens
        } : null
      }
    });
    
  } catch (error) {
    console.error('Check all chunks API error:', error);
    
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