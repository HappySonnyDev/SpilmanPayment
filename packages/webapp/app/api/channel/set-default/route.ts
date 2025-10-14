import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/server/database';

// Request body interface
interface SetDefaultRequest {
  channelId: string;
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

    const { channelId }: SetDefaultRequest = await request.json();

    // Validate input
    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required' },
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

    // Check if channel is active
    if (paymentChannel.status !== PAYMENT_CHANNEL_STATUS.ACTIVE) {
      return NextResponse.json(
        { error: 'Only active channels can be set as default' },
        { status: 400 }
      );
    }

    // Set channel as default
    const updatedChannel = paymentChannelRepo.setChannelAsDefault(channelId, user.id);

    if (!updatedChannel) {
      return NextResponse.json(
        { error: 'Failed to set channel as default' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Channel set as default successfully',
      data: {
        channelId: updatedChannel.channel_id,
        status: updatedChannel.status,
        statusText: getStatusText(updatedChannel.status),
        isDefault: Boolean(updatedChannel.is_default),
      }
    });

  } catch (error) {
    console.error('Set default channel error:', error);

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