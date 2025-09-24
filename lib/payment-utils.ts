import { ccc } from "@ckb-ccc/core";
import { DEVNET_SCRIPTS } from "./ckb";

export interface PaymentChannelData {
  channelId: string;
  fundingTx: Record<string, unknown>;
  amount: number;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  channelStatus?: string;
}

/**
 * Executes the PayNow payment flow - sends funding transaction and confirms payment
 * This function is shared between Recharge and Payment Channels components
 */
export async function executePayNow(paymentData: PaymentChannelData): Promise<PaymentResult> {
  try {
    // Get buyer private key from localStorage
    const buyerPrivateKey = localStorage.getItem("private_key");
    if (!buyerPrivateKey) {
      throw new Error("Please connect your CKB wallet first in Profile settings.");
    }

    // Convert fundingTx to CCC transaction
    const fundingTx = ccc.Transaction.from(paymentData.fundingTx);

    // Create CKB client and buyer signer
    const cccClient = new ccc.ClientPublicTestnet({
      url: "http://localhost:28114",
      scripts: DEVNET_SCRIPTS,
    });
    const buyerSigner = new ccc.SignerCkbPrivateKey(
      cccClient,
      buyerPrivateKey,
    );

    console.log("Sending funding transaction:", fundingTx);

    // Send the funding transaction
    const txHash = await buyerSigner.sendTransaction(fundingTx);

    console.log("Funding transaction sent successfully:", txHash);
    
    // Call confirm-funding API to verify transaction and activate channel
    try {
      const confirmResponse = await fetch('/api/channel/confirm-funding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txHash: txHash,
          channelId: paymentData.channelId,
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        console.error('Confirm funding error:', errorData);
        return {
          success: false,
          txHash,
          error: `Payment sent but verification failed: ${errorData.error}`,
        };
      }

      const confirmResult = await confirmResponse.json();
      console.log('Payment confirmed and channel activated:', confirmResult);
      
      return {
        success: true,
        txHash,
        channelStatus: confirmResult.data.statusText,
      };
      
    } catch (confirmError) {
      console.error('Error confirming payment:', confirmError);
      return {
        success: false,
        txHash,
        error: `Payment sent successfully but could not verify channel activation. Transaction Hash: ${txHash}. Please contact support if needed.`,
      };
    }
    
  } catch (error) {
    console.error('Payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown payment error',
    };
  }
}