import { useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-context';
import { ccc } from '@ckb-ccc/core';
import { DEVNET_SCRIPTS, getMessageHashFromTx, generateCkbSecp256k1Signature, createMultisigScript, derivePublicKeyHashByPrivateKey, derivePublicKeyHashByPublicKey, jsonStr } from '@/lib/ckb';

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
  const constructPaymentTransaction = useCallback(async (
    chunkId: string,
    cumulativePayment: number,
    remainingBalance: number,
    channelId: string,
    channelTxHash: string
  ): Promise<PaymentTransactionResult> => {
    if (!user?.seller_address || !user?.serverPublicKey) {
      return { success: false, error: 'Seller address or server public key not available' };
    }

    const buyerPrivateKey = localStorage.getItem("private_key");
    if (!buyerPrivateKey) {
      return { success: false, error: 'Please connect your CKB wallet first in Profile settings.' };
    }

    try {
      setIsProcessing(true);

      // 创建CKB客户端和买家签名器
      const client = new ccc.ClientPublicTestnet({
        url: "http://localhost:28114",
        scripts: DEVNET_SCRIPTS,
      });
      const buyerSigner = new ccc.SignerCkbPrivateKey(client, buyerPrivateKey);

      // 获取买家地址
      const buyerAddress = await buyerSigner.getRecommendedAddressObj();
      const sellerAddress = await ccc.Address.fromString(user.seller_address, client);

      // Create multisig script to get the correct cellDeps
      // 使用买方私钥和服务端公钥（卖方公钥）
      const { cellDeps } = createMultisigScript(
        derivePublicKeyHashByPrivateKey(buyerPrivateKey),
        derivePublicKeyHashByPublicKey(user.serverPublicKey) // 使用服务端公钥
      );

      // 构造支付交易
      const paymentTx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: {
              txHash: channelTxHash, // 从payment channel的txHash字段获取
              index: 0,
            },
          },
        ],
        outputs: [
          {
            // 给卖家的支付
            lock: sellerAddress.script,
            capacity: ccc.fixedPointFrom(cumulativePayment),
          },
          {
            // 给买家的剩余金额
            lock: buyerAddress.script,
            capacity: ccc.fixedPointFrom(remainingBalance),
          },
        ],
        cellDeps, // Use cellDeps from multisig script
      });

      console.log('🏗️ Constructed payment transaction:', {
        seller: user.seller_address,
        sellerAmount: cumulativePayment,
        buyer: await buyerSigner.getRecommendedAddress(),
        buyerAmount: remainingBalance,
        channelTxHash
      });


      // 买家签名前先push占位符
      paymentTx.witnesses.push('0xfff');

      // 完成交易费用 (这会自动处理手续费签名)
      await paymentTx.completeFeeBy(buyerSigner, 1400);

      // 获取交易消息哈希
      const messageHash = getMessageHashFromTx(paymentTx.hash());

      // 生成买家签名
      const buyerSignature = generateCkbSecp256k1Signature(buyerPrivateKey, messageHash);

      const transactionData: PaymentTransactionData = {
        transaction: JSON.parse(jsonStr(paymentTx)), // Convert transaction to JSON
        buyerSignature: Buffer.from(buyerSignature).toString('hex')
      };

      console.log('✅ Payment transaction constructed successfully:', {
        chunkId,
        transactionHash: paymentTx.hash(),
        buyerSignature: 'generated'
      });

      return {
        success: true,
        transactionData
      };

    } catch (error) {
      console.error('❌ Error constructing payment transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  return {
    constructPaymentTransaction,
    isProcessing
  };
}