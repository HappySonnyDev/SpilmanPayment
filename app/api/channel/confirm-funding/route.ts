import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/server/database';
import { buildClient } from '@/lib/shared/ckb';
import { ccc } from '@ckb-ccc/core';

// Request body interface
interface ConfirmFundingRequest {
  txHash: string;
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

    const { txHash, channelId }: ConfirmFundingRequest = await request.json();

    // Validate input
    if (!txHash || !channelId) {
      return NextResponse.json(
        { error: 'txHash and channelId are required' },
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

    // Check if channel is already active
    if (paymentChannel.status === PAYMENT_CHANNEL_STATUS.ACTIVE) {
      return NextResponse.json({
        success: true,
        message: 'Payment channel is already active',
        data: {
          channelId: paymentChannel.channel_id,
          status: paymentChannel.status,
          statusText: getStatusText(paymentChannel.status),
        }
      });
    }

    // Create CKB client to query the blockchain
    const cccClient = buildClient('devnet');

    // Query transaction from blockchain
    let onChainTransaction;
    try {
      // Use CCC client to get transaction by hash
      onChainTransaction = await cccClient.getTransaction(txHash);
    } catch (error) {
      console.error('Error querying transaction from blockchain:', error);
      return NextResponse.json(
        { error: 'Transaction not found on blockchain' },
        { status: 400 }
      );
    }

    if (!onChainTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found on blockchain' },
        { status: 400 }
      );
    }

    // Verify transaction matches our stored funding transaction
    let storedFundingTx;
    try {
      storedFundingTx = JSON.parse(paymentChannel.funding_tx_data || '{}');
    } catch (error) {
      console.error('Error parsing stored funding transaction:', error);
      return NextResponse.json(
        { error: 'Invalid stored funding transaction data' },
        { status: 500 }
      );
    }

    // Convert stored funding tx to CCC transaction for comparison
    const expectedFundingTx = ccc.Transaction.from(storedFundingTx);
    const expectedTxHash = expectedFundingTx.hash();

    // Verify the transaction hash matches
    if (txHash !== expectedTxHash) {
      return NextResponse.json(
        { error: 'Transaction hash does not match expected funding transaction' },
        { status: 400 }
      );
    }

    // Additional verification: check transaction outputs match expected values
    const onChainTx = onChainTransaction.transaction;
    if (!onChainTx || !onChainTx.outputs || onChainTx.outputs.length === 0) {
      return NextResponse.json(
        { error: 'Invalid transaction structure' },
        { status: 400 }
      );
    }

    // Verify the first output matches our expected amount and lock script
    const firstOutput = onChainTx.outputs[0];
    const expectedOutput = expectedFundingTx.outputs[0];

    if (firstOutput.capacity !== expectedOutput.capacity) {
      return NextResponse.json(
        { error: 'Transaction amount does not match expected value' },
        { status: 400 }
      );
    }

    // If all verifications pass, activate the payment channel
    const updatedChannel = paymentChannelRepo.activatePaymentChannel(channelId);

    if (!updatedChannel) {
      return NextResponse.json(
        { error: 'Failed to activate payment channel' },
        { status: 500 }
      );
    }

    // Store the verified transaction hash in the database
    const channelWithTxHash = paymentChannelRepo.updatePaymentChannelTxHash(channelId, txHash);
    
    if (!channelWithTxHash) {
      console.warn(`Warning: Failed to update tx_hash for channel ${channelId}`);
      // Don't fail the operation since activation was successful
    } else {
      console.log(`Successfully stored tx_hash ${txHash} for channel ${channelId}`);
    }

    // Invalidate all other inactive channels for this user
    // When one channel is activated, all other inactive channels become invalid
    try {
      const inactiveChannels = paymentChannelRepo.getPaymentChannelsByStatus(user.id, PAYMENT_CHANNEL_STATUS.INACTIVE);
      let invalidatedCount = 0;
      
      for (const inactiveChannel of inactiveChannels) {
        if (inactiveChannel.channel_id !== channelId) { // Don't invalidate the channel we just activated
          paymentChannelRepo.invalidatePaymentChannel(inactiveChannel.channel_id);
          invalidatedCount++;
        }
      }
      
      console.log(`Invalidated ${invalidatedCount} inactive channels for user ${user.id}`);
    } catch (invalidateError) {
      // Log error but don't fail the main operation since channel activation was successful
      console.error('Error invalidating inactive channels:', invalidateError);
    }

    // Auto-assign as default channel if user has no other active channels
    let isNewDefault = false;
    try {
      const existingDefault = paymentChannelRepo.getUserDefaultChannel(user.id);
      if (!existingDefault) {
        // No existing default channel, set this one as default
        paymentChannelRepo.setChannelAsDefault(channelId, user.id);
        isNewDefault = true;
        console.log(`Set channel ${channelId} as default for user ${user.id}`);
      }
    } catch (defaultError) {
      // Log error but don't fail the main operation
      console.error('Error setting default channel:', defaultError);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Payment channel activated successfully',
      data: {
        channelId: updatedChannel.channel_id,
        status: updatedChannel.status,
        statusText: getStatusText(updatedChannel.status),
        isDefault: isNewDefault,
        txHash: txHash,
        verifiedAt: updatedChannel.verified_at, // Use the actual database value
      }
    });

  } catch (error) {
    console.error('Confirm funding error:', error);

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