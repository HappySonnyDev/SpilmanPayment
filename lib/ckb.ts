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
import systemScripts from "../deployment/system-scripts.json";
import dotenv from "dotenv";
import { secp256k1 } from "@noble/curves/secp256k1";
import scripts from "../deployment/scripts.json";
dotenv.config({ quiet: true });
export const buildClient = (network: "devnet" | "testnet" | "mainnet") => {
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
  console.log(publicKey,'serverPulic,createPaymentChannel')
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
  const client = buildClient("devnet");
  const buyerSigner = new ccc.SignerCkbPrivateKey(client, buyerPrivateKey);
  const CKB_AMOUNT = ccc.fixedPointFrom(amount);
  const {
    script: multisigScript,
    cellDeps,
    buyerPubkeyHash,
    sellerPubkeyHash,
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
  await fundingTx.completeInputsByCapacity(buyerSigner);
  await fundingTx.completeFeeBy(buyerSigner, 1400);
  console.log(jsonStr(fundingTx), "fundingTx===========");
  const fundingTxHash = fundingTx.hash();
  console.log(`📋 Funding transaction hash calculated: ${fundingTxHash}`);

  // STEP 2: Create time-locked refund transaction
  // This ensures buyer can recover funds if seller becomes uncooperative
  console.log("📝 Step 2: Creating time-locked refund transaction...");

  const currentTime = Math.floor(Date.now() / 1000);
  const DURATION_IN_SECONDS = seconds;
  const refundTime = currentTime + DURATION_IN_SECONDS;
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
        // Refund goes back to buyer's address after timelock
        lock: (await buyerSigner.getRecommendedAddressObj()).script,
        capacity: CKB_AMOUNT,
      },
    ],
    cellDeps,
  });
  console.log("✍️  Step 3: Both parties signing refund transaction...");
  const refundMessageHash = getMessageHashFromTx(refundTx.hash());
  console.log(refundTx);

  // Return the refund transaction for API processing
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
    sinceBytes[i] = Number(since & 0xffn);
    since = since >> 8n;
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
export const jsonStr = (obj: unknown) => {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "bigint") {
      return value.toString(); // 或者 return Number(value)（注意精度！）
    }
    return value;
  });
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
