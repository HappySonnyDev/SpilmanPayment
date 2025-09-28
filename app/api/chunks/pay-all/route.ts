import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository, PaymentChannelRepository, PAYMENT_CHANNEL_STATUS, getDatabase } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;
    
    const { action } = await req.json();

    const chunkRepo = new ChunkPaymentRepository();
    const channelRepo = new PaymentChannelRepository();
    
    if (action === 'pay') {
      // Get all unpaid chunks for this user
      const unpaidTokensCount = chunkRepo.getUserTotalUnpaidTokens(userId);
      
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
      
      // Get all unpaid chunk IDs for this user
      const db = getDatabase();
      const getUnpaidChunksStmt = db.prepare('SELECT chunk_id FROM chunk_payments WHERE user_id = ? AND is_paid = 0');
      const unpaidChunkRecords = getUnpaidChunksStmt.all(userId) as Array<{ chunk_id: string }>;
      const chunkIds = unpaidChunkRecords.map(record => record.chunk_id);
      
      if (chunkIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No unpaid chunks found'
        });
      }
      
      // Mark all unpaid chunks as paid
      chunkRepo.markChunksAsPaid(chunkIds, defaultChannel.channel_id);
      
      // Update channel consumed tokens
      const updateStmt = db.prepare(`
        UPDATE payment_channels 
        SET consumed_tokens = consumed_tokens + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE channel_id = ?
      `);
      updateStmt.run(unpaidTokensCount, defaultChannel.channel_id);
      
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
    console.error('Pay all chunks API error:', error);
    
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