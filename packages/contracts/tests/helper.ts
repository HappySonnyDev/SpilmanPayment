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
} from '@ckb-ccc/core';
import { readFileSync } from 'fs';
import {
  Resource,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
  DEFAULT_SCRIPT_CKB_JS_VM,
} from 'ckb-testtool';
import systemScripts from '../deployment/system-scripts.json';
import dotenv from 'dotenv';
import { secp256k1 } from '@noble/curves/secp256k1';

dotenv.config({ quiet: true });

export const buildSigner = (client: ccc.Client) => {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'PRIVATE_KEY is not set in environment variables or .env file'
    );
  }
  const signer = new ccc.SignerCkbPrivateKey(client, privateKey);
  return signer;
};

export const buildClient = (network: 'devnet' | 'testnet' | 'mainnet') => {
  switch (network) {
    case 'devnet':
      return new ccc.ClientPublicTestnet({
        url: 'http://localhost:28114',
        scripts: DEVNET_SCRIPTS,
      });
    case 'testnet':
      return new ccc.ClientPublicTestnet();
    case 'mainnet':
      return new ccc.ClientPublicMainnet();

    default:
      throw new Error(`Unsupported network: ${network}`);
  }
};

export type KnownScriptType = Pick<Script, 'codeHash' | 'hashType'> & {
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

export const derivePublicKeyHash = (privateKey: string): Uint8Array => {
  const privKeyBuffer = Buffer.from(privateKey.slice(2), 'hex');
  const publicKey = secp256k1.getPublicKey(privKeyBuffer, false);
  const publicKeyHex = '0x' + Buffer.from(publicKey).toString('hex');
  const hash = hashCkb(publicKeyHex);

  // Extract first 20 bytes as public key hash
  const hashBytes = new Uint8Array(20);
  const hexStr = hash.slice(2, 42);
  for (let i = 0; i < 20; i++) {
    hashBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
  }
  return hashBytes;
};

export const generateCkbSecp256k1Signature = (
  privateKey: string,
  messageHash: Uint8Array
): Uint8Array => {
  const privKeyBuffer = Buffer.from(privateKey.slice(2), 'hex');
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
        finalSignature.set(signature.toBytes('compact'), 0);
        finalSignature[64] = recovery;
        return finalSignature;
      }
    } catch (e) {
      console.log(e, 'error');
      continue;
    }
  }

  throw new Error('sign error');
};

// Generate signature with since field included (for timelock scenarios)
export const generateCkbSecp256k1SignatureWithSince = (
  privateKey: string,
  transactionHash: Uint8Array,
  sinceValue: bigint
): Uint8Array => {
  // Convert since value to 8-byte array (little endian)
  const sinceBytes = new Uint8Array(8);
  let since = sinceValue;
  for (let i = 0; i < 8; i++) {
    sinceBytes[i] = Number(since & 0xffn);
    since = since >> 8n;
  }
  
  // Combine transaction hash and since for signing
  const combinedMessage = new Uint8Array(transactionHash.length + sinceBytes.length);
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

export const setupContractTransaction = () => {
  const resource = Resource.default();
  const tx = Transaction.default();

  const mainScript = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)),
    tx,
    false
  );
  const alwaysSuccessScript = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
    tx,
    false
  );
  const contractScript = resource.deployCell(
    hexFrom(readFileSync('dist/2of2.bc')),
    tx,
    false
  );

  return { resource, tx, mainScript, alwaysSuccessScript, contractScript };
};

export const setupScriptArgs = (mainScript: any, contractScript: any, privateKey1: string, privateKey2: string) => {
  const pubkeyHash1 = derivePublicKeyHash(privateKey1);
  const pubkeyHash2 = derivePublicKeyHash(privateKey2);

  const simpleArgs = new Uint8Array(42);
  simpleArgs[0] = 2; // threshold
  simpleArgs[1] = 2; // pubkey count
  simpleArgs.set(pubkeyHash1, 2);
  simpleArgs.set(pubkeyHash2, 22);

  mainScript.args = hexFrom(
    '0x0000' +
      contractScript.codeHash.slice(2) +
      hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
      hexFrom(simpleArgs).slice(2)
  );

  return { pubkeyHash1, pubkeyHash2 };
};

export const setupTransactionCells = (
  tx: any,
  mainScript: any,
  alwaysSuccessScript: any,
  resource: any
) => {
  const inputCell = resource.mockCell(mainScript, undefined, '0x');
  tx.inputs.push(Resource.createCellInput(inputCell));

  tx.outputs.push(Resource.createCellOutput(alwaysSuccessScript));
  tx.outputsData.push(hexFrom('0xFE000000000000000000000000000000'));
  tx.outputs.push(Resource.createCellOutput(alwaysSuccessScript));
  tx.outputsData.push(hexFrom('0x01000000000000000000000000000000'));
};

export const getTransactionMessageHash = (tx: any): Uint8Array => {
  const txHashHex = tx.hash();
  const messageHash = new Uint8Array(32);
  const hashStr = txHashHex.slice(2);
  for (let i = 0; i < 32; i++) {
    messageHash[i] = parseInt(hashStr.substr(i * 2, 2), 16);
  }
  return messageHash;
};

export const createWitnessData = (
  signature1: Uint8Array,
  signature2: Uint8Array,
  pubkeyIndex1: number = 0,
  pubkeyIndex2: number = 1
): Uint8Array => {
  // Format: [signature1(65)] + [signature2(65)] + [index1(1)] + [index2(1)] = 132 bytes
  const witnessData = new Uint8Array(132);
  witnessData.set(signature1, 0);
  witnessData.set(signature2, 65);
  witnessData[130] = pubkeyIndex1;
  witnessData[131] = pubkeyIndex2;
  return witnessData;
};

export const verifyContractExecution = (verifier: any): number => {
  const results = verifier.verify();

  const lockResult = results.find(
    (result: any) => result.groupType === 'lock' && result.cellType === 'input'
  );

  if (!lockResult) {
    throw new Error('No lock script verification result found');
  }

  return lockResult.scriptErrorCode;
};
