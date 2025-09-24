import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/database';

// Helper function to get status text
function getStatusText(status: number): string {
  switch (status) {
    case PAYMENT_CHANNEL_STATUS.INACTIVE:
      return 'Inactive';
    case PAYMENT_CHANNEL_STATUS.ACTIVE:
      return 'Active';
    case PAYMENT_CHANNEL_STATUS.INVALID:
      return 'Invalid';
    default:
      return 'Unknown';
  }
}

export async function GET(request: NextRequest) {
  try {
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
      status: channel.status,
      statusText: getStatusText(channel.status),
      isDefault: Boolean(channel.is_default), // Convert SQLite integer (0/1) to boolean
      consumedTokens: channel.consumed_tokens || 0,
      createdAt: channel.created_at,
      updatedAt: channel.updated_at,
      // Include raw database fields for frontend processing
      sellerSignature: channel.seller_signature,
      refundTxData: channel.refund_tx_data,
      fundingTxData: channel.funding_tx_data,
    }));

    return NextResponse.json({
      success: true,
      data: {
        channels: formattedChannels,
        total: formattedChannels.length,
      }
    });

  } catch (error) {
    console.error('List channels error:', error);

    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}