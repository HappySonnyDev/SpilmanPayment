import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository, PaymentChannelRepository } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;
    
    const chunkRepo = new ChunkPaymentRepository();
    const channelRepo = new PaymentChannelRepository();
    
    // Get user's default channel
    const defaultChannel = channelRepo.getUserDefaultChannel(userId);
    
    if (!defaultChannel) {
      return NextResponse.json({
        error: 'No default payment channel found',
        debug: {
          userId,
          hasDefaultChannel: false
        }
      }, { status: 400 });
    }
    
    // Get all unpaid chunks for this user
    const unpaidTokens = chunkRepo.getUserTotalUnpaidTokens(userId);
    
    // Get latest session for this user
    const latestSession = chunkRepo.getLatestSessionForUser(userId);
    
    // Get unpaid chunks for latest session
    const sessionUnpaidTokens = latestSession ? chunkRepo.getUnpaidTokensCount(userId, latestSession) : 0;
    
    return NextResponse.json({
      success: true,
      debug: {
        userId,
        channelId: defaultChannel.channel_id,
        channelAmount: defaultChannel.amount,
        consumedTokens: defaultChannel.consumed_tokens,
        remainingTokens: defaultChannel.amount - defaultChannel.consumed_tokens,
        totalUnpaidTokens: unpaidTokens,
        latestSession,
        sessionUnpaidTokens,
        channelStatus: defaultChannel.status
      }
    });
    
  } catch (error) {
    console.error('Debug API error:', error);
    
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