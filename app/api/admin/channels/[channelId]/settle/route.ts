import { NextRequest, NextResponse } from "next/server";
import {
  PaymentChannelRepository,
  ChunkPaymentRepository,
  PAYMENT_CHANNEL_STATUS,
  ChunkPayment,
} from "@/lib/server/database";
import { ccc, hexFrom, WitnessArgs } from "@ckb-ccc/core";
import {
  buildClient,
  generateCkbSecp256k1Signature,
  createWitnessData,
} from "@/lib/shared/ckb";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId: channelIdParam } = await params;
    const channelId = parseInt(channelIdParam);

    if (isNaN(channelId)) {
      return NextResponse.json(
        { error: "Invalid channel ID" },
        { status: 400 },
      );
    }

    const paymentChannelRepo = new PaymentChannelRepository();

    // Get the payment channel by database ID
    const channel = paymentChannelRepo.getPaymentChannelById(channelId);
    if (!channel) {
      return NextResponse.json(
        { error: "Payment channel not found" },
        { status: 404 },
      );
    }

    // Verify channel is active
    if (channel.status !== PAYMENT_CHANNEL_STATUS.ACTIVE) {
      return NextResponse.json(
        { error: "Only active channels can be settled" },
        { status: 400 },
      );
    }

    // Get all chunk payments for this channel to find the latest one
    // 使用和用户结算完全相同的逻辑
    const { getDatabase } = await import("@/lib/server/database");
    const db = getDatabase();
    const chunkPayments = db
      .prepare(
        "SELECT * FROM chunk_payments WHERE channel_id = ? ORDER BY created_at DESC",
      )
      .all(channel.channel_id) as ChunkPayment[];

    if (chunkPayments.length === 0) {
      return NextResponse.json(
        { error: "No payments found for this channel" },
        { status: 400 },
      );
    }

    // Find the latest chunk payment
    const latestChunk = chunkPayments[0];

    // Check if the latest chunk is paid
    if (!latestChunk.is_paid) {
      return NextResponse.json(
        { error: "Latest chunk payment is not paid. Cannot settle channel." },
        { status: 400 },
      );
    }

    // Check if we have transaction data and buyer signature
    if (!latestChunk.transaction_data || !latestChunk.buyer_signature) {
      return NextResponse.json(
        {
          error: "Missing transaction data or buyer signature for latest chunk",
        },
        { status: 400 },
      );
    }

    const transactionData = JSON.parse(latestChunk.transaction_data);
    
    // Convert buyer signature to bytes
    const buyerSignatureHex = latestChunk.buyer_signature.startsWith('0x') 
      ? latestChunk.buyer_signature.slice(2) 
      : latestChunk.buyer_signature;
    
    if (buyerSignatureHex.length !== 130) {
      return NextResponse.json(
        { error: `Invalid buyer signature length: ${buyerSignatureHex.length}, expected 130` },
        { status: 400 }
      );
    }
    
    const buyerSignatureBytes = new Uint8Array(
      buyerSignatureHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );

    // Get seller private key from environment
    const sellerPrivateKey = process.env.SELLER_PRIVATE_KEY;
    if (!sellerPrivateKey) {
      return NextResponse.json(
        { error: "Seller private key not configured" },
        { status: 500 },
      );
    }

    try {
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
        throw new Error(`Invalid buyer signature length: ${buyerSignatureBytes.length}, expected 65`);
      }
      if (sellerSignatureBytes.length !== 65) {
        throw new Error(`Invalid seller signature length: ${sellerSignatureBytes.length}, expected 65`);
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

      // Update channel status to SETTLED
      const updatedChannel = paymentChannelRepo.updatePaymentChannelStatus(
        channel.channel_id,
        PAYMENT_CHANNEL_STATUS.SETTLED,
      );

      // Update the channel with the settlement transaction hash
      paymentChannelRepo.updatePaymentChannelSettleHash(channel.channel_id, txHash);

      return NextResponse.json({
        success: true,
        message: "Channel settled successfully",
        txHash,
        channelStatus: "SETTLED",
        channel: updatedChannel,
      });
    } catch (blockchainError) {
      console.error("Blockchain settlement error:", blockchainError);
      return NextResponse.json(
        {
          error: "Failed to submit settlement transaction to blockchain",
          details:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown blockchain error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Admin settlement error:", error);
    return NextResponse.json(
      {
        error: "Internal server error during settlement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}