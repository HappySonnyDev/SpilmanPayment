import { NextRequest, NextResponse } from 'next/server';
import { PaymentChannelRepository, ChunkPaymentRepository, getDatabase, PAYMENT_CHANNEL_STATUS, ChunkPayment, ScheduledTaskLogRepository } from '@/lib/server/database';
import { ccc, hexFrom, WitnessArgs } from "@ckb-ccc/core";
import { buildClient, generateCkbSecp256k1Signature, createWitnessData, jsonStr } from "@/lib/shared/ckb";

export async function POST(request: NextRequest) {
  const startTime = new Date();
  const taskLogRepo = new ScheduledTaskLogRepository();
  
  // Create initial task log entry
  const taskLog = taskLogRepo.createTaskLog({
    task_name: 'auto-settle-expiring',
    task_type: 'settlement',
    execution_status: 'running',
    started_at: startTime.toISOString()
  });

  try {
    console.log('[AUTO-SETTLE] Starting auto-settlement check...');

    // Get all active payment channels
    const db = getDatabase();
    const activeChannels = db.prepare(`
      SELECT * FROM payment_channels 
      WHERE status = ? 
      ORDER BY created_at DESC
    `).all(PAYMENT_CHANNEL_STATUS.ACTIVE);

    if (activeChannels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active channels to check',
        settledCount: 0,
        checkedCount: 0
      });
    }

    let settledCount = 0;
    let checkedCount = 0;
    // Get current time in UTC for consistent comparison with database timestamps
    const currentTimeUTC = new Date();
    const results = [];

    for (const channel of activeChannels) {
      try {
        checkedCount++;
        
        // Parse database timestamp as UTC (database stores UTC time)
        const createdAtUTC = new Date(channel.created_at + (channel.created_at.includes('Z') ? '' : 'Z'));
        const expirationTimeUTC = new Date(createdAtUTC.getTime() + (channel.duration_days * 24 * 60 * 60 * 1000));
        const timeUntilExpiration = expirationTimeUTC.getTime() - currentTimeUTC.getTime();
        const minutesUntilExpiration = Math.floor(timeUntilExpiration / (1000 * 60));
        console.log(minutesUntilExpiration,'minutes until expiration', {
          currentTimeUTC: currentTimeUTC.toISOString(),
          createdAtUTC: createdAtUTC.toISOString(),
          expirationTimeUTC: expirationTimeUTC.toISOString(),
          dbCreatedAt: channel.created_at
        });
        // Check if channel expires within 15 minutes
        if (minutesUntilExpiration <= 15 && minutesUntilExpiration >= 0) {
          console.log(`[AUTO-SETTLE] ⏰ Channel ${channel.channel_id} expires in ${minutesUntilExpiration} minutes, attempting settlement...`);
          
          const settlementResult = await settleChannelAutomatically(channel);
          if (settlementResult.success) {
            settledCount++;
            results.push({
              channelId: channel.channel_id,
              status: 'settled',
              minutesUntilExpiration,
              txHash: settlementResult.txHash
            });
            console.log(`[AUTO-SETTLE] ✅ Successfully settled channel ${channel.channel_id}`);
          } else {
            results.push({
              channelId: channel.channel_id,
              status: 'failed',
              minutesUntilExpiration,
              error: settlementResult.error
            });
            console.log(`[AUTO-SETTLE] ⚠️ Failed to settle channel ${channel.channel_id}: ${settlementResult.error}`);
          }
        }
      } catch (error) {
        console.error(`[AUTO-SETTLE] ❌ Error processing channel ${channel.channel_id}:`, error);
        results.push({
          channelId: channel.channel_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const response = {
      success: true,
      message: `Auto-settlement check completed`,
      settledCount,
      checkedCount,
      results,
      timestamp: new Date().toISOString()
    };

    if (settledCount > 0) {
      console.log(`[AUTO-SETTLE] 🎯 Successfully settled ${settledCount} out of ${checkedCount} checked channels`);
    }

    // Update task log with success
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    taskLogRepo.updateTaskLog(taskLog.id, {
      execution_status: 'success',
      completed_at: endTime.toISOString(),
      duration_ms: duration,
      result_data: JSON.stringify({
        settledCount,
        checkedCount,
        results: results.length > 0 ? results : null
      }),
      settled_count: settledCount,
      checked_count: checkedCount
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('[AUTO-SETTLE] ❌ Error in auto-settlement:', error);
    
    // Update task log with failure
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    taskLogRepo.updateTaskLog(taskLog.id, {
      execution_status: 'failed',
      completed_at: endTime.toISOString(),
      duration_ms: duration,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Auto-settlement failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to settle a channel automatically
async function settleChannelAutomatically(channel: { 
  id: number; 
  channel_id: string; 
  duration_days: number; 
  created_at: string; 
  status: number; 
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const paymentChannelRepo = new PaymentChannelRepository();
    
    // Get all chunk payments for this channel to find the latest one
    const db = getDatabase();
    const chunkPayments = db
      .prepare("SELECT * FROM chunk_payments WHERE channel_id = ? ORDER BY created_at DESC")
      .all(channel.channel_id) as ChunkPayment[];

    if (chunkPayments.length === 0) {
      return { success: false, error: 'No payments found for channel' };
    }

    // Find the latest chunk payment
    const latestChunk = chunkPayments[0];

    // Check if the latest chunk is paid
    if (!latestChunk.is_paid) {
      return { success: false, error: 'Latest chunk payment is not paid' };
    }

    // Check if we have transaction data and buyer signature
    if (!latestChunk.transaction_data || !latestChunk.buyer_signature) {
      return { success: false, error: 'Missing transaction data or buyer signature' };
    }

    const transactionData = JSON.parse(latestChunk.transaction_data);
    
    // Convert buyer signature to bytes
    const buyerSignatureHex = latestChunk.buyer_signature.startsWith('0x') 
      ? latestChunk.buyer_signature.slice(2) 
      : latestChunk.buyer_signature;
    
    if (buyerSignatureHex.length !== 130) {
      return { success: false, error: 'Invalid buyer signature length' };
    }
    
    const buyerSignatureBytes = new Uint8Array(
      buyerSignatureHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );

    // Get seller private key from environment
    const sellerPrivateKey = process.env.SELLER_PRIVATE_KEY;
    if (!sellerPrivateKey) {
      return { success: false, error: 'Seller private key not configured' };
    }

    // Recover the transaction from transaction data
    const transaction = ccc.Transaction.from(transactionData);
    const transactionHash = transaction.hash();
    
    // Convert transaction hash to bytes for signing
    const transactionHashBytes = new Uint8Array(32);
    const hashStr = transactionHash.slice(2); // Remove '0x' prefix
    for (let i = 0; i < 32; i++) {
      transactionHashBytes[i] = parseInt(hashStr.substr(i * 2, 2), 16);
    }
    
    // Generate seller signature
    const sellerSignatureBytes = generateCkbSecp256k1Signature(
      sellerPrivateKey,
      transactionHashBytes,
    );
    
    // Validate signature lengths
    if (buyerSignatureBytes.length !== 65) {
      return { success: false, error: `Invalid buyer signature length: ${buyerSignatureBytes.length}, expected 65` };
    }
    if (sellerSignatureBytes.length !== 65) {
      return { success: false, error: `Invalid seller signature length: ${sellerSignatureBytes.length}, expected 65` };
    }

    // Create witness data with both signatures
    const witnessData = createWitnessData(
      buyerSignatureBytes,
      sellerSignatureBytes,
    );

    // Update the transaction witnesses
    const witnessArgs = new WitnessArgs(hexFrom(witnessData));
    transaction.witnesses[0] = hexFrom(witnessArgs.toBytes());

    // Submit the transaction to CKB network
    const client = buildClient("devnet");
    const txHash = await client.sendTransaction(transaction);

    // Store the transaction data in settle_tx_data field
    paymentChannelRepo.updatePaymentChannelSettleTxData(
      channel.channel_id,
      jsonStr(transaction)
    );

    // Update channel status to SETTLED
    paymentChannelRepo.updatePaymentChannelStatus(
      channel.channel_id,
      PAYMENT_CHANNEL_STATUS.SETTLED,
    );

    // Update the channel with the settlement transaction hash
    paymentChannelRepo.updatePaymentChannelSettleHash(channel.channel_id, txHash);

    return { success: true, txHash };

  } catch (error) {
    console.error(`[AUTO-SETTLE] Error settling channel ${channel.channel_id}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown settlement error' 
    };
  }
}