import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository, PaymentChannelRepository } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;
    
    const { sessionId, action } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!action || action !== 'pay') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pay"' },
        { status: 400 }
      );
    }
    
    const chunkRepo = new ChunkPaymentRepository();
    const channelRepo = new PaymentChannelRepository();
    
    // Pay for unpaid chunks in this specific session
    const unpaidChunks = chunkRepo.getUnpaidChunksByUserSession(userId, sessionId);
    const unpaidTokensCount = chunkRepo.getUnpaidTokensCount(userId, sessionId);
    
    if (unpaidTokensCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unpaid chunks to process for this session'
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
    
    // Update channel consumed tokens
    const updateStmt = channelRepo['db'].prepare(`
      UPDATE payment_channels 
      SET consumed_tokens = consumed_tokens + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE channel_id = ?
    `);
    updateStmt.run(unpaidTokensCount, defaultChannel.channel_id);
    
    return NextResponse.json({
      success: true,
      message: `Successfully paid for ${unpaidTokensCount} tokens in session ${sessionId}`,
      data: {
        paidTokens: unpaidTokensCount,
        paidChunks: chunkIds.length,
        sessionId: sessionId,
        remainingTokens: remainingTokens - unpaidTokensCount
      }
    });
    
  } catch (error) {
    console.error('Session payment API error:', error);
    
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