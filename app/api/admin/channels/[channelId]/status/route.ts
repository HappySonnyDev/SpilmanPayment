import { NextRequest, NextResponse } from 'next/server';
import { PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/server/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId: channelIdParam } = await params;
    const channelId = parseInt(channelIdParam);
    const { status } = await request.json();

    if (isNaN(channelId)) {
      return NextResponse.json(
        { error: 'Invalid channel ID' },
        { status: 400 }
      );
    }

    if (!Object.values(PAYMENT_CHANNEL_STATUS).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const paymentChannelRepo = new PaymentChannelRepository();
    
    // Check if channel exists
    const channel = paymentChannelRepo.getPaymentChannelById(channelId);
    if (!channel) {
      return NextResponse.json(
        { error: 'Payment channel not found' },
        { status: 404 }
      );
    }

    // Update channel status
    const updatedChannel = paymentChannelRepo.updatePaymentChannelStatusById(channelId, status);

    if (!updatedChannel) {
      return NextResponse.json(
        { error: 'Failed to update channel status' },
        { status: 500 }
      );
    }

    const statusText = status === PAYMENT_CHANNEL_STATUS.INACTIVE ? 'Inactive' : 
                      status === PAYMENT_CHANNEL_STATUS.ACTIVE ? 'Active' : 
                      status === PAYMENT_CHANNEL_STATUS.INVALID ? 'Invalid' :
                      status === PAYMENT_CHANNEL_STATUS.SETTLED ? 'Settled' :
                      status === PAYMENT_CHANNEL_STATUS.EXPIRED ? 'Expired' : 'Unknown';

    return NextResponse.json({
      success: true,
      message: `Payment channel status updated to ${statusText}`,
      channel: updatedChannel
    });

  } catch (error) {
    console.error('Error updating payment channel status:', error);
    return NextResponse.json(
      { error: 'Failed to update payment channel status' },
      { status: 500 }
    );
  }
}