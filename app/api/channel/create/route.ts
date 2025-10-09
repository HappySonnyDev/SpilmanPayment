import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  PaymentChannelRepository,
  PAYMENT_CHANNEL_STATUS,
} from "@/lib/database";
import {
  getMessageHashFromTx,
  generateCkbSecp256k1Signature,
  generateCkbSecp256k1SignatureWithSince,
  buildClient,
  jsonStr,
} from "@/lib/ckb";
import { ccc } from "@ckb-ccc/core";
import { hexFrom } from "@ckb-ccc/core";

// Request body interface
interface CreateChannelRequest {
  refundTx: Record<string, unknown>; // CKB transaction structure
  fundingTx: Record<string, unknown>; // CKB funding transaction structure
  amount: number;
  seconds: number;
}

// Helper function to get status text
function getStatusText(status: number): string {
  switch (status) {
    case PAYMENT_CHANNEL_STATUS.INACTIVE:
      return "Inactive";
    case PAYMENT_CHANNEL_STATUS.ACTIVE:
      return "Active";
    case PAYMENT_CHANNEL_STATUS.INVALID:
      return "Invalid";
    default:
      return "Unknown";
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const { refundTx, fundingTx, amount, seconds }: CreateChannelRequest =
      await request.json();

    // Validate input
    if (!refundTx || !fundingTx || !amount || !seconds) {
      return NextResponse.json(
        { error: "refundTx, fundingTx, amount, and seconds are required" },
        { status: 400 },
      );
    }

    // Get seller private key from environment
    const sellerPrivateKey = process.env.SELLER_PRIVATE_KEY;
    if (!sellerPrivateKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
    const refundCCC = ccc.Transaction.from(refundTx);
    const placeholderWitness = ("0x" + "00".repeat(132)) as `0x${string}`;
    refundCCC.witnesses.push(placeholderWitness);

    // Add seller's real UTXO for fee payment since we have seller's private key
    const client = buildClient("devnet");
    const sellerSigner = new ccc.SignerCkbPrivateKey(client, sellerPrivateKey);
    const sellerAddress = await sellerSigner.getRecommendedAddressObj();

    // Find a suitable UTXO from seller's address for fee payment
    const sellerUTXOsGenerator = sellerSigner.client.findCellsByLock(
      sellerAddress.script,
    );

    let feeUTXO = null;
    for await (const utxo of sellerUTXOsGenerator) {
      // Find a UTXO with sufficient capacity for fee (much more lenient check)
      // Just need enough for basic transaction fee, not full cell minimum
      if (utxo.cellOutput.capacity >= BigInt(10000)) { // 10,000 shannons = 0.0001 CKB
        feeUTXO = utxo;
        break;
      }
    }

    if (!feeUTXO) {
      return NextResponse.json(
        { error: "Seller has no available UTXOs for refund transaction fee" },
        { status: 500 },
      );
    }

    const estimatedFee = BigInt(1400); // 1400 shannons for fee (use BigInt directly)

    // Add seller's real UTXO as fee input
    refundCCC.inputs.push(
      ccc.CellInput.from({
        previousOutput: feeUTXO.outPoint!,
      }),
    );

    // Always add seller's change output to ensure transaction balance
    // Not adding change output causes massive fee (input - output = fee)
    const changeAmount = feeUTXO.cellOutput.capacity - estimatedFee;
    
    console.log(`Change amount: ${changeAmount}, Fee UTXO capacity: ${feeUTXO.cellOutput.capacity}, Estimated fee: ${estimatedFee}`);
    
    // Always add change output regardless of amount to prevent unbalanced transaction
    refundCCC.outputs.push(
      ccc.CellOutput.from({
        lock: sellerAddress.script,
        capacity: changeAmount,
      }),
    );
    console.log(`Added change output: ${changeAmount} capacity`);

    console.log(
      jsonStr(refundCCC),
      "refundCCC with seller's real UTXO for fees",
    );

    // Manually generate seller signature for fee inputs to avoid UTXO existence checks
    const refundTxHashForSigning = refundCCC.hash();
    const refundHashBytes = getMessageHashFromTx(refundTxHashForSigning);
    const sellerFeeSignature = generateCkbSecp256k1Signature(
      sellerPrivateKey,
      refundHashBytes,
    );
    
    // Add seller signature for fee input to witnesses (index 1 for second input)
    const sellerFeeWitness = hexFrom(sellerFeeSignature) as `0x${string}`;
    refundCCC.witnesses.push(sellerFeeWitness);
    console.log("Seller signature added to witnesses for fee inputs");

    // Generate message hash from completed refund transaction
    const refundTxHash = refundCCC.hash();
    if (!refundTxHash) {
      return NextResponse.json(
        { error: "Invalid refund transaction: missing hash" },
        { status: 400 },
      );
    }

    const messageHash = getMessageHashFromTx(refundTxHash);

    // Generate seller signature
    const sellerSignature = generateCkbSecp256k1SignatureWithSince(
      sellerPrivateKey,
      messageHash,
      ccc.numFromBytes(
        new Uint8Array([
          0x80,
          0x00,
          0x00,
          0x00, // Relative time lock flag
          0x00,
          0x00,
          0x00,
          0x00,
        ]),
      ) + BigInt(seconds),
    );

    // Generate unique channel ID
    const channelId = `channel_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Save to database with INACTIVE status
    const paymentChannelRepo = new PaymentChannelRepository();
    const paymentChannel = paymentChannelRepo.createPaymentChannel({
      user_id: user.id,
      channel_id: channelId,
      amount,
      duration_days: seconds / (24 * 60 * 60), // Convert seconds to days for backward compatibility
      duration_seconds: seconds, // Store actual seconds
      status: PAYMENT_CHANNEL_STATUS.INACTIVE, // Set to inactive when created
      seller_signature: Buffer.from(sellerSignature).toString("hex"),
      refund_tx_data: jsonStr(refundCCC), // Store completed refund transaction with fees
      funding_tx_data: jsonStr(fundingTx),
    });

    // Return signature and transaction structures
    return NextResponse.json({
      success: true,
      data: {
        channelId: paymentChannel.channel_id,
        status: paymentChannel.status,
        statusText: getStatusText(paymentChannel.status),
        sellerSignature: Buffer.from(sellerSignature).toString("hex"),
        refundTx: JSON.parse(jsonStr(refundCCC)), // Return completed refund transaction with seller fees
        fundingTx: fundingTx,
        amount,
        duration: seconds,
        createdAt: paymentChannel.created_at,
      },
    });
  } catch (error) {
    console.error("Payment channel creation error:", error);

    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
