import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/database';
import { getMessageHashFromTx, generateCkbSecp256k1Signature } from '@/lib/ckb';
import { ccc } from '@ckb-ccc/core';

// Request body interface
interface CreateChannelRequest {
  refundTx: Record<string, unknown>; // CKB transaction structure
  fundingTx: Record<string, unknown>; // CKB funding transaction structure
  amount: number;
  day: number;
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

    const { refundTx, fundingTx, amount, day }: CreateChannelRequest = await request.json();

    // Validate input
    if (!refundTx || !fundingTx || !amount || !day) {
      return NextResponse.json(
        { error: 'refundTx, fundingTx, amount, and day are required' },
        { status: 400 }
      );
    }

    // Get seller private key from environment
    const sellerPrivateKey = process.env.SELLER_PRIVATE_KEY;
    if (!sellerPrivateKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    const refundCCC = ccc.Transaction.from(refundTx)
    // Generate message hash from refund transaction
    const refundTxHash = refundCCC.hash()
    if (!refundTxHash) {
      return NextResponse.json(
        { error: 'Invalid refund transaction: missing hash' },
        { status: 400 }
      );
    }

    const messageHash = getMessageHashFromTx(refundTxHash);

    // Generate seller signature
    const sellerSignature = generateCkbSecp256k1Signature(sellerPrivateKey, messageHash);

    // Generate unique channel ID
    const channelId = `channel_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Save to database with INACTIVE status
    const paymentChannelRepo = new PaymentChannelRepository();
    const paymentChannel = paymentChannelRepo.createPaymentChannel({
      user_id: user.id,
      channel_id: channelId,
      amount,
      duration_days: day,
      status: PAYMENT_CHANNEL_STATUS.INACTIVE, // Set to inactive when created
      seller_signature: Buffer.from(sellerSignature).toString('hex'),
      refund_tx_data: JSON.stringify(refundTx),
      funding_tx_data: JSON.stringify(fundingTx),
    });

    // Return signature and transaction structures
    return NextResponse.json({
      success: true,
      data: {
        channelId: paymentChannel.channel_id,
        status: paymentChannel.status,
        statusText: getStatusText(paymentChannel.status),
        sellerSignature: Buffer.from(sellerSignature).toString('hex'),
        refundTx: refundTx,
        fundingTx: fundingTx,
        amount,
        duration: day,
        createdAt: paymentChannel.created_at,
      }
    });

  } catch (error) {
    console.error('Payment channel creation error:', error);

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