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
import systemScripts from '../deployment/system-scripts.json';
import dotenv from 'dotenv';
// import { secp256k1 } from '@noble/curves/secp256k1';

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