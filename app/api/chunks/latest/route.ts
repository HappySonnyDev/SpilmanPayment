import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository, PaymentChannelRepository } from '@/lib/database';
import { withAuth, ApiResponse } from '@/lib/api-middleware';

async function getLatestChunkHandler(req: NextRequest) {
  // Require authentication
  const user = await requireAuth(req);
  const userId = user.id;

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channel_id');

  const chunkRepo = new ChunkPaymentRepository();
  const channelRepo = new PaymentChannelRepository();
  
  let targetChannelId: string;
  let channelInfo;
  
  if (channelId) {
    // Use provided channel_id
    const channel = channelRepo.getPaymentChannelByChannelId(channelId);
    if (!channel || channel.user_id !== userId) {
      return ApiResponse.error('Channel not found or access denied');
    }
    targetChannelId = channelId;
    channelInfo = {
      channelId: channel.channel_id,
      totalAmount: channel.amount,
      consumedTokens: channel.consumed_tokens
    };
  } else {
    // Use user's default channel
    const defaultChannel = channelRepo.getUserDefaultChannel(userId);
    if (!defaultChannel) {
      return ApiResponse.error('No default payment channel found');
    }
    targetChannelId = defaultChannel.channel_id;
    channelInfo = {
      channelId: defaultChannel.channel_id,
      totalAmount: defaultChannel.amount,
      consumedTokens: defaultChannel.consumed_tokens
    };
  }

  // Get the latest chunk payment for this channel
  const latestChunk = chunkRepo.getLatestChunkForUserChannel(userId, targetChannelId);
  
  if (!latestChunk) {
    return ApiResponse.success({
      hasLatestChunk: false,
      message: 'No chunk payments found for this channel',
      channelInfo
    });
  }

  // Format the chunk record similar to PaymentRecord interface
  const formattedChunk = {
    chunkId: latestChunk.chunk_id,
    tokens: latestChunk.tokens_count,
    consumedTokens: Math.floor((latestChunk.cumulative_payment || 0) * 0.01), // Convert CKB to tokens
    remainingTokens: Math.floor((latestChunk.remaining_balance || channelInfo.totalAmount) * 0.01), // Convert CKB to tokens
    timestamp: latestChunk.created_at,
    isPaid: Boolean(latestChunk.is_paid),
    transactionData: latestChunk.transaction_data ? JSON.parse(latestChunk.transaction_data) : undefined,
    buyerSignature: latestChunk.buyer_signature
  };

  return ApiResponse.success({
    hasLatestChunk: true,
    latestChunk: formattedChunk,
    channelInfo
  });
}

// Export the wrapped handler
export const GET = withAuth(getLatestChunkHandler);