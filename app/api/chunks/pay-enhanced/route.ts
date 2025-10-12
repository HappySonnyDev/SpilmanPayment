import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { ChunkPaymentRepository, PaymentChannelRepository } from '@/lib/server/database';

interface PaymentTransactionData {
  transaction: Record<string, unknown>;
  buyerSignature: string;
}

interface EnhancedChunkPaymentRequest {
  chunkId: string;
  paymentInfo: {
    cumulativePayment: number; // Amount in CKB to pay to seller
    remainingBalance: number;  // Amount in CKB to return to buyer
    channelId: string;
    tokens: number; // Number of tokens consumed
  };
  transactionData: PaymentTransactionData;
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    const userId = user.id;

    const { chunkId, paymentInfo, transactionData }: EnhancedChunkPaymentRequest = await request.json();

    // Validate input
    if (!chunkId || !paymentInfo || !transactionData) {
      return NextResponse.json(
        { error: 'chunkId, paymentInfo, and transactionData are required' },
        { status: 400 }
      );
    }

    const chunkRepo = new ChunkPaymentRepository();
    const channelRepo = new PaymentChannelRepository();

    // Get the chunk to verify it exists and belongs to this user
    const chunk = chunkRepo.getChunkPaymentByChunkId(chunkId);
    
    if (!chunk) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 422 }
      );
    }

    if (chunk.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to chunk' },
        { status: 403 }
      );
    }

    if (chunk.is_paid) {
      return NextResponse.json({
        success: true,
        message: 'Chunk is already paid',
        data: {
          chunkId: chunk.chunk_id,
          tokens: chunk.tokens_count,
          alreadyPaid: true
        }
      });
    }

    // Verify payment channel exists and matches
    const channel = channelRepo.getPaymentChannelByChannelId(paymentInfo.channelId);
    if (!channel) {
      return NextResponse.json(
        { error: 'Payment channel not found' },
        { status: 422 }
      );
    }

    // Store the payment transaction data in chunk_payments table
    const updatedChunk = chunkRepo.updateChunkPaymentWithTransactionData(
      chunkId,
      paymentInfo.channelId,
      paymentInfo.cumulativePayment,
      paymentInfo.remainingBalance,
      transactionData.transaction,
      transactionData.buyerSignature
    );

    if (!updatedChunk) {
      return NextResponse.json(
        { error: 'Failed to update chunk payment data' },
        { status: 500 }
      );
    }

    // Emit chunkPaymentSuccess event for real-time UI updates
    // consumed_tokens is updated during chat streaming, not during payment

    return NextResponse.json({
      success: true,
      message: `Successfully processed payment for chunk ${chunkId}`,
      data: {
        chunkId: chunk.chunk_id,
        tokens: chunk.tokens_count,
        sessionId: chunk.session_id,
        cumulativePayment: paymentInfo.cumulativePayment,
        remainingBalance: paymentInfo.remainingBalance,
        remainingTokens: paymentInfo.remainingBalance, // For consistency with other payment endpoints
        transactionStored: true,
        transactionData: {
          transaction: transactionData.transaction,
          buyerSignature: transactionData.buyerSignature
        }
      }
    });

  } catch (error) {
    console.error('Enhanced chunk payment API error:', error);

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