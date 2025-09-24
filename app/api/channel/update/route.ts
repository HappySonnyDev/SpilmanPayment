import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/database';

// Request body interface
interface UpdateChannelRequest {
  channelId: string;
  action: 'activate' | 'close';
}

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

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const { channelId, action }: UpdateChannelRequest = await request.json();

    // Validate input
    if (!channelId || !action) {
      return NextResponse.json(
        { error: 'channelId and action are required' },
        { status: 400 }
      );
    }

    if (!['activate', 'close'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "activate" or "close"' },
        { status: 400 }
      );
    }

    // Get payment channel from database
    const paymentChannelRepo = new PaymentChannelRepository();
    const paymentChannel = paymentChannelRepo.getPaymentChannelByChannelId(channelId);

    if (!paymentChannel) {
      return NextResponse.json(
        { error: 'Payment channel not found' },
        { status: 404 }
      );
    }

    // Check if channel belongs to the authenticated user
    if (paymentChannel.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to payment channel' },
        { status: 403 }
      );
    }

    let updatedChannel;

    if (action === 'activate') {
      // Can only activate inactive channels
      if (paymentChannel.status !== PAYMENT_CHANNEL_STATUS.INACTIVE) {
        return NextResponse.json(
          { error: 'Only inactive channels can be activated' },
          { status: 400 }
        );
      }
      updatedChannel = paymentChannelRepo.activatePaymentChannel(channelId);
    } else if (action === 'close') {
      // Can only close active channels
      if (paymentChannel.status !== PAYMENT_CHANNEL_STATUS.ACTIVE) {
        return NextResponse.json(
          { error: 'Only active channels can be closed' },
          { status: 400 }
        );
      }
      updatedChannel = paymentChannelRepo.invalidatePaymentChannel(channelId);
    }

    if (!updatedChannel) {
      return NextResponse.json(
        { error: 'Failed to update payment channel' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Payment channel ${action}d successfully`,
      data: {
        channelId: updatedChannel.channel_id,
        status: updatedChannel.status,
        statusText: getStatusText(updatedChannel.status),
        updatedAt: updatedChannel.updated_at,
      }
    });

  } catch (error) {
    console.error('Update channel error:', error);

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