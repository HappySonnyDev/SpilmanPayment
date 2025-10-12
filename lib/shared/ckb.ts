import {
  ccc,
  CellDepInfoLike,
  hashCkb,
  KnownScript,
  Script,
  hexFrom,
  Transaction,
  hashTypeToBytes,
  WitnessArgs,
} from "@ckb-ccc/core";
import systemScripts from "../../deployment/system-scripts.json";
import dotenv from "dotenv";
import { secp256k1 } from "@noble/curves/secp256k1";
import scripts from "../../deployment/scripts.json";
dotenv.config({ quiet: true });
export const buildClient = (
  network: "devnet" | "testnet" | "mainnet" = "devnet",
) => {
  switch (network) {
    case "devnet":
      return new ccc.ClientPublicTestnet({
        url: "http://localhost:28114",
        scripts: DEVNET_SCRIPTS,
      });
    case "testnet":
      return new ccc.ClientPublicTestnet();
    case "mainnet":
      return new ccc.ClientPublicMainnet();

    default:
      throw new Error(`Unsupported network: ${network}`);
  }
};

/**
 * Build CKB client and signer for a given private key
 * @param privateKey - Private key string
 * @param network - Network type (defaults to devnet)
 * @returns Object containing client and signer
 */
export const buildClientAndSigner = (
  privateKey: string,
  network: "devnet" | "testnet" | "mainnet" = "devnet",
) => {
  const client = buildClient(network);
  const signer = new ccc.SignerCkbPrivateKey(client, privateKey);
  return { client, signer };
};
export type KnownScriptType = Pick<Script, "codeHash" | "hashType"> & {
  cellDeps: CellDepInfoLike[];
};

export const DEVNET_SCRIPTS: Record<string, KnownScriptType> = {
  [KnownScript.Secp256k1Blake160]: systemScripts.devnet
    .secp256k1_blake160_sighash_all!.script as KnownScriptType,
  [KnownScript.Secp256k1Multisig]: systemScripts.devnet
    .secp256k1_blake160_multisig_all!.script as KnownScriptType,
  [KnownScript.NervosDao]: systemScripts.devnet.dao!.script as KnownScriptType,
  [KnownScript.AnyoneCanPay]: systemScripts.devnet.anyone_can_pay!
    .script as KnownScriptType,
  [KnownScript.OmniLock]: systemScripts.devnet.omnilock!
    .script as KnownScriptType,
  [KnownScript.XUdt]: systemScripts.devnet.xudt!.script as KnownScriptType,
};

export const derivePublicKeyHashByPrivateKey = (
  privateKey: string,
): Uint8Array => {
  const privKeyBuffer = Buffer.from(privateKey.slice(2), "hex");
  const publicKey = secp256k1.getPublicKey(privKeyBuffer, false);
  return derivePublicKeyHashByPublicKeyUint8Array(publicKey);
};

/**
 * Convert private key to public key hex string
 * @param privateKey - Private key with or without '0x' prefix
 * @returns Public key as hex string (without '0x' prefix)
 */
export const privateKeyToPublicKeyHex = (privateKey: string): string => {
  const cleanPrivateKey = privateKey.startsWith("0x")
    ? privateKey.slice(2)
    : privateKey;
  const privKeyBuffer = Buffer.from(cleanPrivateKey, "hex");
  const publicKey = secp256k1.getPublicKey(privKeyBuffer, false);
  return Buffer.from(publicKey).toString("hex");
};

export const derivePublicKeyHashByPublicKeyUint8Array = (
  publicKey: Uint8Array<ArrayBufferLike>,
): Uint8Array => {
  const publicKeyHex = "0x" + Buffer.from(publicKey).toString("hex");
  const hash = hashCkb(publicKeyHex);

  // Extract first 20 bytes as public key hash
  const hashBytes = new Uint8Array(20);
  const hexStr = hash.slice(2, 42);
  for (let i = 0; i < 20; i++) {
    hashBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
  }
  return hashBytes;
};

export const derivePublicKeyHashByPublicKey = (
  publicKey: string,
): Uint8Array => {
  console.log(publicKey, "serverPulic,createPaymentChannel");
  // Convert hex string to Uint8Array
  const publicKeyHex = publicKey.startsWith("0x")
    ? publicKey.slice(2)
    : publicKey;
  const publicKeyBytes = new Uint8Array(publicKeyHex.length / 2);
  for (let i = 0; i < publicKeyBytes.length; i++) {
    publicKeyBytes[i] = parseInt(publicKeyHex.substr(i * 2, 2), 16);
  }
  return derivePublicKeyHashByPublicKeyUint8Array(publicKeyBytes);
};

export const createMultisigScript = (
  buyerPubkeyHash: Uint8Array,
  sellerPubkeyHash: Uint8Array,
) => {
  const ckbJsVmScript = systemScripts.devnet["ckb_js_vm"];
  const contractScript = scripts.devnet["2of2.bc"];

  const scriptArgs = new Uint8Array(42);
  scriptArgs[0] = 2; // threshold: both signatures required
  scriptArgs[1] = 2; // total pubkeys in the multisig
  scriptArgs.set(buyerPubkeyHash, 2); // buyer's pubkey hash at offset 2
  scriptArgs.set(sellerPubkeyHash, 22); // seller's pubkey hash at offset 22

  return {
    script: {
      codeHash: ckbJsVmScript.script.codeHash,
      hashType: ckbJsVmScript.script.hashType,
      args: hexFrom(
        "0x0000" +
          contractScript.codeHash.slice(2) +
          hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
          hexFrom(scriptArgs).slice(2),
      ),
    },
    cellDeps: [
      ...ckbJsVmScript.script.cellDeps.map((c) => c.cellDep),
      ...contractScript.cellDeps.map((c) => c.cellDep),
    ],
    buyerPubkeyHash,
    sellerPubkeyHash,
  };
};

export const createPaymentChannel = async ({
  sellerPublicKey,
  buyerPrivateKey,
  amount,
  seconds,
}: {
  sellerPublicKey: string;
  buyerPrivateKey: string;
  amount: number;
  seconds: number;
}) => {
  const { signer: buyerSigner } = buildClientAndSigner(buyerPrivateKey);
  const CKB_AMOUNT = ccc.fixedPointFrom(amount);
  const {
    script: multisigScript,
    cellDeps,
  } = createMultisigScript(
    derivePublicKeyHashByPrivateKey(buyerPrivateKey),
    derivePublicKeyHashByPublicKey(sellerPublicKey),
  );
  const fundingTx = ccc.Transaction.from({
    outputs: [
      {
        lock: multisigScript,
        capacity: CKB_AMOUNT,
      },
    ],
    cellDeps,
  });
  await fundingTx.completeFeeBy(buyerSigner, 1400);
  const fundingTxHash = fundingTx.hash();
  const DURATION_IN_SECONDS = seconds;
  const buyerAddress = await buyerSigner.getRecommendedAddressObj();
  const refundTx = ccc.Transaction.from({
    inputs: [
      {
        previousOutput: {
          txHash: fundingTxHash, // Reference the funding transaction
          index: 0,
        },
        since:
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
          ) + BigInt(DURATION_IN_SECONDS),
      },
    ],
    outputs: [
      {
        // Full refund to buyer's address (server will add fee handling)
        lock: buyerAddress.script,
        capacity: CKB_AMOUNT, // Full amount, fees handled by seller
      },
    ],
    cellDeps,
  });

  const refundMessageHash = getMessageHashFromTx(refundTx.hash());
  return {
    refundTx,
    fundingTx,
    refundMessageHash,
  };
};

// Helper function to convert transaction hash to message hash for signing
export const getMessageHashFromTx = (txHash: string): Uint8Array => {
  const messageHash = new Uint8Array(32);
  const hashStr = txHash.slice(2); // Remove '0x' prefix
  for (let i = 0; i < 32; i++) {
    messageHash[i] = parseInt(hashStr.substr(i * 2, 2), 16);
  }
  return messageHash;
};
export const generateCkbSecp256k1Signature = (
  privateKey: string,
  messageHash: Uint8Array,
): Uint8Array => {
  const privKeyBuffer = Buffer.from(privateKey.slice(2), "hex");
  const publicKey = secp256k1.getPublicKey(privKeyBuffer, false);
  const signature = secp256k1.sign(messageHash, privKeyBuffer);

  // Try different recovery IDs to find the correct one
  for (let recovery = 0; recovery < 4; recovery++) {
    try {
      const recoveredPubKey = signature
        .addRecoveryBit(recovery)
        .recoverPublicKey(messageHash);

      if (
        recoveredPubKey
          .toRawBytes(false)
          .every((val, idx) => val === publicKey[idx])
      ) {
        // CKB signature format: [r(32)] + [s(32)] + [recovery_id(1)]
        const finalSignature = new Uint8Array(65);
        finalSignature.set(signature.toBytes("compact"), 0);
        finalSignature[64] = recovery;
        return finalSignature;
      }
    } catch (e) {
      console.log(e, "error");
      continue;
    }
  }

  throw new Error("sign error");
};

export const generateCkbSecp256k1SignatureWithSince = (
  privateKey: string,
  transactionHash: Uint8Array,
  sinceValue: bigint,
): Uint8Array => {
  // Convert since value to 8-byte array (little endian)
  const sinceBytes = new Uint8Array(8);
  let since = sinceValue;
  for (let i = 0; i < 8; i++) {
    sinceBytes[i] = Number(since & BigInt(0xff));
    since = since >> BigInt(8);
  }

  // Combine transaction hash and since for signing
  const combinedMessage = new Uint8Array(
    transactionHash.length + sinceBytes.length,
  );
  combinedMessage.set(transactionHash, 0);
  combinedMessage.set(sinceBytes, transactionHash.length);

  // Hash the combined message
  const combinedHash = hashCkb(combinedMessage.buffer);
  // Convert hex string to Uint8Array
  const hashStr = combinedHash.slice(2); // Remove 0x prefix
  const finalMessageHash = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    finalMessageHash[i] = parseInt(hashStr.substr(i * 2, 2), 16);
  }

  // Generate signature using the combined hash
  return generateCkbSecp256k1Signature(privateKey, finalMessageHash);
};
export const jsonStr = (obj: unknown, replacer?: ((key: string, value: unknown) => unknown) | null, space?: string | number) => {
  const customReplacer = (key: string, value: unknown) => {
    if (typeof value === "bigint") {
      return value.toString(); // 或者 return Number(value)（注意精度！）
    }
    // If a custom replacer is provided, apply it after bigint handling
    return replacer ? replacer(key, value) : value;
  };
  
  return JSON.stringify(obj, replacer || customReplacer, space);
};

export const createWitnessData = (
  buyerSignature: Uint8Array,
  sellerSignature: Uint8Array,
): Uint8Array => {
  const witnessData = new Uint8Array(132);
  witnessData.set(buyerSignature, 0); // buyer signature at offset 0
  witnessData.set(sellerSignature, 65); // seller signature at offset 65
  witnessData[130] = 0; // buyer pubkey index
  witnessData[131] = 1; // seller pubkey index
  return witnessData;
};

/**
 * Creates a placeholder witness for transactions that require 132-byte witness
 * Commonly used for multisig transactions before actual signatures are added
 */
export const createPlaceholderWitness = (): `0x${string}` => {
  return ("0x" + "00".repeat(132)) as `0x${string}`;
};

/**
 * Generate CKB address and balance from private key
 * @param privateKey - Private key string
 * @returns Promise with address and balance information
 */
export const generateCkbAddress = async (
  privateKey: string,
): Promise<{
  address: string;
  balance: string;
}> => {
  const { client, signer } = buildClientAndSigner(privateKey);

  // Get recommended address
  const address = await signer.getRecommendedAddress();

  // Get balance
  const addressObj = await ccc.Address.fromString(address, client);
  const script = addressObj.script;
  const balanceBI = await client.getBalance([script]);
  const balance = ccc.fixedPointToString(balanceBI);

  return {
    address,
    balance,
  };
};

/**
 * Payment result interface for payment operations
 */
export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  channelStatus?: string;
}

/**
 * Executes the PayNow payment flow - sends funding transaction and confirms payment
 * This is a shared utility function used by multiple components
 */
export const executePayNow = async (paymentData: {
  channelId: string;
  fundingTx: Record<string, unknown>;
  amount: number;
}): Promise<PaymentResult> => {
  try {
    // Get buyer private key from localStorage
    const buyerPrivateKey = localStorage.getItem("private_key");

    if (!buyerPrivateKey) {
      throw new Error("Please connect your CKB wallet first in Profile settings.");
    }

    // Convert fundingTx to CCC transaction
    const fundingTx = ccc.Transaction.from(paymentData.fundingTx);

    // Create CKB client and buyer signer
    const { client: cccClient, signer: buyerSigner } = buildClientAndSigner(buyerPrivateKey);

    console.log("Sending funding transaction:", fundingTx);

    // Send the funding transaction
    const txHash = await buyerSigner.sendTransaction(fundingTx);

    console.log("Funding transaction sent successfully:", txHash);
    
    // Call confirm-funding API to verify transaction and activate channel
    try {
      const { channel } = await import('@/lib/client/api');
      const confirmResult = await channel.confirmFunding({
        txHash: txHash,
        channelId: paymentData.channelId,
      });
      console.log('Payment confirmed and channel activated:', confirmResult);
      
      return {
        success: true,
        txHash,
        channelStatus: (confirmResult as { data?: { statusText?: string } }).data?.statusText,
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
};

/**
 * Executes a refund transaction for a payment channel
 * This function handles the complete refund flow including multi-signature validation
 */
export const executeRefund = async (channelData: {
  refundTxData: string;
  sellerSignature: string;
  durationSeconds?: number;
  durationDays: number;
}): Promise<PaymentResult> => {
  try {
    // Get buyer private key from localStorage
    const buyerPrivateKey = localStorage.getItem("private_key");
    if (!buyerPrivateKey) {
      throw new Error("Please connect your CKB wallet first in Payment Channel settings.");
    }

    // Parse the refund transaction (already includes fees from creation time)
    const refundTxData = JSON.parse(channelData.refundTxData);
    const refundTx = ccc.Transaction.from(refundTxData);
    
    console.log('Using pre-calculated refund transaction:', refundTx);
    
    // Get transaction hash for signing
    const transactionHash = refundTx.hash();
    
    // Generate message hash from completed refund transaction
    const messageHash = getMessageHashFromTx(transactionHash);
    
    // Generate buyer signature with timelock (since this is a refund transaction)
    // Use the same duration that was used during channel creation
    const durationInSeconds = channelData.durationSeconds || (channelData.durationDays * 24 * 60 * 60);
    
    const sinceValue = ccc.numFromBytes(
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
    ) + BigInt(durationInSeconds);
    
    console.log(`Generating buyer signature with since value: ${sinceValue}`);
    console.log(`Duration in seconds: ${durationInSeconds}`);
    
    const buyerSignatureBytes = generateCkbSecp256k1SignatureWithSince(
      buyerPrivateKey,
      messageHash,
      sinceValue,
    );
    
    // Convert seller signature from hex to bytes
    const sellerSignatureHex = channelData.sellerSignature.startsWith('0x') 
      ? channelData.sellerSignature.slice(2) 
      : channelData.sellerSignature;
    
    if (sellerSignatureHex.length !== 130) {
      throw new Error(`Invalid seller signature length: ${sellerSignatureHex.length}, expected 130`);
    }
    
    const sellerSignatureBytes = new Uint8Array(
      sellerSignatureHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );
    
    // Validate signature lengths
    if (buyerSignatureBytes.length !== 65) {
      throw new Error(`Invalid buyer signature length: ${buyerSignatureBytes.length}, expected 65`);
    }
    if (sellerSignatureBytes.length !== 65) {
      throw new Error(`Invalid seller signature length: ${sellerSignatureBytes.length}, expected 65`);
    }

    // Create witness data with both signatures (buyer first, seller second)
    const witnessData = createWitnessData(
      buyerSignatureBytes,
      sellerSignatureBytes,
    );

    // Update the transaction witnesses
    const witnessArgs = new WitnessArgs(hexFrom(witnessData));
    refundTx.witnesses[0] = hexFrom(witnessArgs.toBytes());
    
    // Submit the transaction to CKB network
    const client = buildClient("devnet");
    console.log('Submitting refund transaction with multi-sig:', refundTx);
    
    const txHash = await client.sendTransaction(refundTx);
    
    console.log('Refund transaction submitted successfully:', txHash);
    
    return {
      success: true,
      txHash,
      channelStatus: 'Refunded',
    };
    
  } catch (error) {
    console.error('Refund error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown refund error',
    };
  }
};
