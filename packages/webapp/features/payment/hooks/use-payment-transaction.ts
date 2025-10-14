import { useState, useCallback } from "react";
import { useAuth } from "@/features/auth/components/auth-context";
import { ccc } from "@ckb-ccc/core";
import {
  DEVNET_SCRIPTS,
  getMessageHashFromTx,
  generateCkbSecp256k1Signature,
  createMultisigScript,
  derivePublicKeyHashByPrivateKey,
  derivePublicKeyHashByPublicKey,
  jsonStr,
  createPlaceholderWitness,
} from "@/lib/shared/ckb";

export interface PaymentTransactionData {
  transaction: Record<string, unknown>; // CKB transaction object
  buyerSignature: string; // Single buyer signature
}

export interface PaymentTransactionResult {
  success: boolean;
  transactionData?: PaymentTransactionData;
  error?: string;
}

export function usePaymentTransaction() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // 构造支付交易
  const constructPaymentTransaction = useCallback(
    async (
      chunkId: string,
      cumulativePayment: number, // Amount in CKB to pay to seller
      remainingBalance: number, // Amount in CKB to return to buyer
      channelId: string,
      channelTxHash: string,
    ): Promise<PaymentTransactionResult> => {
      if (!user?.seller_address || !user?.serverPublicKey) {
        return {
          success: false,
          error: "Seller address or server public key not available",
        };
      }

      const buyerPrivateKey = localStorage.getItem("private_key");
      if (!buyerPrivateKey) {
        return {
          success: false,
          error: "Please connect your CKB wallet first in Profile settings.",
        };
      }

      try {
        setIsProcessing(true);

        // 创建CKB客户端和买家签名器
        const client = new ccc.ClientPublicTestnet({
          url: "http://localhost:28114",
          scripts: DEVNET_SCRIPTS,
        });
        const buyerSigner = new ccc.SignerCkbPrivateKey(
          client,
          buyerPrivateKey,
        );

        const buyerAddress = await buyerSigner.getRecommendedAddressObj();
        const sellerAddress = await ccc.Address.fromString(
          user.seller_address,
          client,
        );

        // Create multisig script to get the correct cellDeps
        const { cellDeps } = createMultisigScript(
          derivePublicKeyHashByPrivateKey(buyerPrivateKey),
          derivePublicKeyHashByPublicKey(user.serverPublicKey),
        );

        // Construct payment transaction
        const paymentTx = ccc.Transaction.from({
          inputs: [
            {
              previousOutput: {
                txHash: channelTxHash,
                index: 0,
              },
            },
          ],
          outputs: [
            {
              lock: sellerAddress.script,
              capacity: ccc.fixedPointFrom(cumulativePayment),
            },
            {
              lock: buyerAddress.script,
              capacity: ccc.fixedPointFrom(remainingBalance),
            },
          ],
          cellDeps,
        });

        // Create placeholder witness for multisig (132 bytes)
        paymentTx.witnesses.push(createPlaceholderWitness());

        const fee = 1400;
        await paymentTx.completeFeeBy(buyerSigner, fee);
        await buyerSigner.signTransaction(paymentTx);
        // Get transaction message hash
        const messageHash = getMessageHashFromTx(paymentTx.hash());

        // Generate buyer signature
        const buyerSignature = generateCkbSecp256k1Signature(
          buyerPrivateKey,
          messageHash,
        );

        const transactionData: PaymentTransactionData = {
          transaction: JSON.parse(jsonStr(paymentTx)),
          buyerSignature: Buffer.from(buyerSignature).toString("hex"),
        };

        return {
          success: true,
          transactionData,
        };
      } catch (error) {
        console.error("❌ Error constructing payment transaction:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [user],
  );

  return {
    constructPaymentTransaction,
    isProcessing,
  };
}
