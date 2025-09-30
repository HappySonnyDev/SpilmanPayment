import { NextRequest, NextResponse } from "next/server";
import {
  PaymentChannelRepository,
  ChunkPaymentRepository,
  PAYMENT_CHANNEL_STATUS,
  ChunkPayment,
} from "@/lib/database";
import { requireAuth } from "@/lib/auth";
import { ccc, hexFrom, WitnessArgs } from "@ckb-ccc/core";
import {
  buildClient,
  generateCkbSecp256k1Signature,
  createWitnessData,
  getMessageHashFromTx,
  jsonStr,
} from "@/lib/ckb";

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
    const chunkPaymentRepo = new ChunkPaymentRepository();

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

    // Get all chunk payments for this channel to find the latest one
    // Use a raw database query since we need to access the database directly
    const { getDatabase } = await import("@/lib/database");
    const db = getDatabase();
    const chunkPayments = db
      .prepare(
        "SELECT * FROM chunk_payments WHERE channel_id = ? ORDER BY created_at DESC",
      )
      .all(channelId) as ChunkPayment[];

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
    const buyerSignatureBytes = hexFrom(latestChunk.buyer_signature);

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
      const messageHash = getMessageHashFromTx(transactionHash);

      // Generate seller signature
      const sellerSignatureBytes = generateCkbSecp256k1Signature(
        sellerPrivateKey,
        messageHash,
      );

      // Create witness data with both signatures
      const witnessData = createWitnessData(
        new Uint8Array(
          buyerSignatureBytes
            .slice(2)
            .match(/.{2}/g)!
            .map((byte) => parseInt(byte, 16)),
        ),
        sellerSignatureBytes,
      );

      // Update the transaction witnesses
      transaction.witnesses[0] = hexFrom(
        new WitnessArgs(hexFrom(witnessData)).toBytes(),
      );

      // Submit the transaction to CKB network
      const client = buildClient("devnet");
      console.log(jsonStr(transaction), "transaction-=");
      const txHash = await client.sendTransaction(transaction);

      console.log(
        `✅ Settlement transaction submitted successfully: ${txHash}`,
      );

      // Update channel status to SETTLED
      const updatedChannel = paymentChannelRepo.updatePaymentChannelStatus(
        channelId,
        PAYMENT_CHANNEL_STATUS.SETTLED,
      );

      // Update the channel with the settlement transaction hash
      paymentChannelRepo.updatePaymentChannelTxHash(channelId, txHash);

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
