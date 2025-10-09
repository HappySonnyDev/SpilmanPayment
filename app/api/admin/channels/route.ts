import { NextRequest, NextResponse } from 'next/server';
import { PaymentChannelRepository, UserRepository, PaymentChannel, PAYMENT_CHANNEL_STATUS } from '@/lib/database';

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
    default:
      return 'Unknown';
  }
}

export async function GET(request: NextRequest) {
  try {
    // In a real admin system, you would add authentication checks here
    // For now, this is for demo purposes
    
    const paymentChannelRepo = new PaymentChannelRepository();
    const userRepo = new UserRepository();
    
    // Get all payment channels
    const channels = paymentChannelRepo.getAllPaymentChannels();

    // Format channels for admin display with user information
    const formattedChannels = channels.map((channel: PaymentChannel) => {
      const user = userRepo.getUserById(channel.user_id);
      
      return {
        id: channel.id,
        channelId: channel.channel_id,
        userId: channel.user_id,
        username: user?.username || 'Unknown User',
        amount: channel.amount,
        durationDays: channel.duration_days,
        status: channel.status,
        statusText: getStatusText(channel.status),
        consumed_tokens: channel.consumed_tokens || 0,
        createdAt: channel.created_at,
        updatedAt: channel.updated_at,
        tx_hash: channel.tx_hash,
        settle_hash: channel.settle_hash
      };
    });

    return NextResponse.json({
      channels: formattedChannels,
      total: formattedChannels.length
    });

  } catch (error) {
    console.error('Error fetching payment channels for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment channels' },
      { status: 500 }
    );
  }
}