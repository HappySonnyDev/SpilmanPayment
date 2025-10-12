import { NextRequest, NextResponse } from "next/server";
import {
  PaymentChannelRepository,
  ChunkPaymentRepository,
  PAYMENT_CHANNEL_STATUS,
  ChunkPayment,
} from "@/lib/server/database";
import { requireAuth } from "@/lib/server/auth";
import { ccc, hexFrom, WitnessArgs } from "@ckb-ccc/core";
import {
  buildClient,
  generateCkbSecp256k1Signature,
  createWitnessData,
  jsonStr,
} from "@/lib/shared/ckb";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await requireAuth(request);
    const userId = auth.id;

    const body = await request.json();
    const { channelId } = body;

    if (!channelId) {
      return NextResponse.json(
        { error: "Channel ID is required" },
        { status: 400 },
      );
    }

    const paymentChannelRepo = new PaymentChannelRepository();

    // Get the payment channel
    const channel = paymentChannelRepo.getPaymentChannelByChannelId(channelId);
    if (!channel) {
      return NextResponse.json(
        { error: "Payment channel not found" },
        { status: 404 },
      );
    }

    // Verify channel belongs to authenticated user
    if (channel.user_id !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify channel is active
    if (channel.status !== PAYMENT_CHANNEL_STATUS.ACTIVE) {
      return NextResponse.json(
        { error: "Only active channels can be settled" },
        { status: 400 },
      );
    }

    // Get the latest chunk payment for this channel using the same logic as getLatestChunkForUserChannel
    const chunkPaymentRepo = new ChunkPaymentRepository();
    const latestChunk = chunkPaymentRepo.getLatestChunkForUserChannel(userId, channelId);

    if (!latestChunk) {
      return NextResponse.json(
        { error: "No payments found for this channel" },
        { status: 400 },
      );
    }

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
      console.log(jsonStr(transaction),'transaction==========')
      const txHash = await client.sendTransaction(transaction);

      // Store the transaction data in settle_tx_data field
      paymentChannelRepo.updatePaymentChannelSettleTxData(
        channelId,
        jsonStr(transaction)
      );

      // Update channel status to SETTLED
      const updatedChannel = paymentChannelRepo.updatePaymentChannelStatus(
        channelId,
        PAYMENT_CHANNEL_STATUS.SETTLED,
      );

      // Update the channel with the settlement transaction hash
      paymentChannelRepo.updatePaymentChannelSettleHash(channelId, txHash);

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
    console.error("Settlement error:", error);
    return NextResponse.json(
      {
        error: "Internal server error during settlement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}