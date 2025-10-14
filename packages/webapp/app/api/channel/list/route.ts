import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/server/database';
import { withAuth, ApiResponse } from '@/lib/server/api-middleware';

// Helper function to get status text
function getStatusText(status: number): string {
  switch (status) {
    case PAYMENT_CHANNEL_STATUS.INACTIVE:
      return 'Inactive';
    case PAYMENT_CHANNEL_STATUS.ACTIVE:
      return 'Active';
    case PAYMENT_CHANNEL_STATUS.INVALID:
      return 'Invalid';
    case PAYMENT_CHANNEL_STATUS.SETTLED:
      return 'Settled';
    case PAYMENT_CHANNEL_STATUS.EXPIRED:
      return 'Expired';
    default:
      return 'Unknown';
  }
}

async function listChannelsHandler(request: NextRequest) {
  // Require authentication
  const user = await requireAuth(request);

  // Get payment channels for the user
  const paymentChannelRepo = new PaymentChannelRepository();
  const channels = paymentChannelRepo.getPaymentChannelsByUserId(user.id);

  // Format the channels for the response
  const formattedChannels = channels.map(channel => ({
    id: channel.id,
    channelId: channel.channel_id,
    amount: channel.amount,
    durationDays: channel.duration_days,
    durationSeconds: channel.duration_seconds, // Include duration in seconds
    status: channel.status,
    statusText: getStatusText(channel.status),
    isDefault: Boolean(channel.is_default), // Convert SQLite integer (0/1) to boolean
    consumedTokens: channel.consumed_tokens || 0,
    createdAt: channel.created_at,
    updatedAt: channel.updated_at,
    verifiedAt: channel.verified_at, // Include verifiedAt
    // Include raw database fields for frontend processing
    sellerSignature: channel.seller_signature,
    refundTxData: channel.refund_tx_data,
    fundingTxData: channel.funding_tx_data,
    settleTxData: channel.settle_tx_data, // Include settlement transaction data
  }));

  return ApiResponse.success({
    channels: formattedChannels,
    total: formattedChannels.length,
  });
}

// Export the wrapped handler
export const GET = withAuth(listChannelsHandler);