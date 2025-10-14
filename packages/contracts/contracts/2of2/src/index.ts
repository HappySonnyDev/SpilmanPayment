/**
 * 2-of-2 Multisig Contract with Time-lock Support
 *
 * This contract implements basic 2-of-2 multisig verification logic with optional time-lock (since) functionality.
 * Both signatures must be valid for the transaction to succeed.
 *
 * =====================================================================================
 * SINCE (TIME-LOCK) FUNCTIONALITY
 * =====================================================================================
 *
 * When a transaction includes a 'since' field (time-lock), the contract enforces additional validation:
 *
 * 1. SIGNATURE MESSAGE CONSTRUCTION:
 *    - WITHOUT since: message = transaction_hash
 *    - WITH since: message = hash(transaction_hash + since_bytes)
 *
 * 2. SINCE FIELD FORMAT (8 bytes, little-endian):
 *    ┌─────────────┬─────────────┬─────────────────────────────────────┐
 *    │ Metric Flag │ Type Flag   │              Value                  │
 *    │  (1 bit)    │ (2 bits)    │            (29 bits)                │
 *    └─────────────┴─────────────┴─────────────────────────────────────┘
 *    
 *    - Absolute time: 0x0000000000000000 + timestamp
 *    - Relative time: 0x8000000000000000 + seconds
 *    - Block height:  0x4000000000000000 + block_number
 *
 * 3. EXTERNAL USER SIGNATURE PROCESS:
 *    ```javascript
 *    // Step 1: Get transaction hash
 *    const txHash = transaction.hash();
 *    
 *    // Step 2: If transaction has since field, combine with since
 *    if (hasSince) {
 *        const sinceBytes = new Uint8Array(8);
 *        // Convert since value to little-endian bytes
 *        let since = sinceValue;
 *        for (let i = 0; i < 8; i++) {
 *            sinceBytes[i] = Number(since & 0xffn);
 *            since = since >> 8n;
 *        }
 *        
 *        // Combine transaction hash + since bytes
 *        const combined = new Uint8Array(txHash.length + sinceBytes.length);
 *        combined.set(txHash, 0);
 *        combined.set(sinceBytes, txHash.length);
 *        
 *        // Hash the combined message
 *        const messageHash = hashCkb(combined.buffer);
 *        
 *        // Sign the final message hash
 *        const signature = sign(privateKey, messageHash);
 *    } else {
 *        // Sign transaction hash directly
 *        const signature = sign(privateKey, txHash);
 *    }
 *    ```
 *
 * 4. CONTRACT VALIDATION PROCESS:
 *    - Detects if input has non-zero since field
 *    - Recreates expected message hash using tx_hash + since
 *    - Validates that provided signatures were created with correct message
 *    - Prevents since value manipulation attacks
 *
 * 5. SECURITY GUARANTEES:
 *    - Signatures are cryptographically bound to specific timelock values
 *    - Cannot reuse signatures with different timelock settings
 *    - Network enforces timelock constraints at consensus level
 *    - Contract ensures signature-timelock consistency
 *
 * =====================================================================================
 * SCRIPT ARGS STRUCTURE
 * =====================================================================================
 *
 * Script Args Detailed Structure:
 * ┌────────┬──────────────────┬───────────┬───────────┬──────────────┬─────────────────┬─────────────────┐
 * │ Prefix │   Code Hash      │ Hash Type │ Threshold │ Pubkey Count │ First Pubkey    │ Second Pubkey   │
 * │(2 bytes)│   (32 bytes)     │ (1 byte)  │ (1 byte)  │  (1 byte)    │ Hash (20 bytes) │ Hash (20 bytes) │
 * └────────┴──────────────────┴───────────┴───────────┴──────────────┴─────────────────┴─────────────────┘
 * Offset:   0        2              34         35         36             37               57
 *
 * - Prefix: Standard CKB script args prefix
 * - Code Hash: ckb-js-vm code hash for contract execution
 * - Hash Type: Script hash type (typically 1 for type)
 * - Threshold: Number of required signatures (always 2 for 2-of-2)
 * - Pubkey Count: Total number of public keys (always 2)
 * - Pubkey Hashes: blake160 hashes of the public keys for verification
 *
 * =====================================================================================
 * WITNESS ARGS STRUCTURE
 * =====================================================================================
 *
 * Witness Args Structure:
 * - lock field contains multisig witness data with 132 bytes total length
 * - Binary layout: [signature1(65)] + [signature2(65)] + [pubkey_index1(1)] + [pubkey_index2(1)]
 *
 * Detailed Structure:
 * ┌─────────────────┬─────────────────┬──────────────┬──────────────┐
 * │   Signature 1   │   Signature 2   │ Pubkey Index │ Pubkey Index │
 * │    (65 bytes)   │    (65 bytes)   │      1       │      2       │
 * │                 │                 │   (1 byte)   │   (1 byte)   │
 * └─────────────────┴─────────────────┴──────────────┴──────────────┘
 * Offset:    0              65             130           131
 *
 * Each signature contains:
 * - r component: 32 bytes (signature data)
 * - s component: 32 bytes (signature data)
 * - recovery ID: 1 byte (0-3, used for public key recovery)
 *
 * Pubkey indices must:
 * - Be in range [0, 1] (referencing first or second pubkey hash)
 * - Be different from each other (2-of-2 requirement)
 * - Map to corresponding pubkey hashes in script args
 */

import * as bindings from '@ckb-js-std/bindings';
import { HighLevel, log, hashCkb, bytesEq } from '@ckb-js-std/core';

// Script Args layout constants
const SCRIPT_ARGS_PREFIX_LENGTH = 2;
const CKB_JS_VM_CODE_HASH_LENGTH = 32;
const HASH_TYPE_LENGTH = 1;
const THRESHOLD_LENGTH = 1;
const PUBKEY_COUNT_LENGTH = 1;
const PUBKEY_HASH_LENGTH = 20;

// Calculate offsets for pubkey hashes in script args
const PUBKEY_HASH_START_OFFSET =
  SCRIPT_ARGS_PREFIX_LENGTH +
  CKB_JS_VM_CODE_HASH_LENGTH +
  HASH_TYPE_LENGTH +
  THRESHOLD_LENGTH +
  PUBKEY_COUNT_LENGTH;
const FIRST_PUBKEY_HASH_OFFSET = PUBKEY_HASH_START_OFFSET;
const SECOND_PUBKEY_HASH_OFFSET = FIRST_PUBKEY_HASH_OFFSET + PUBKEY_HASH_LENGTH;

// Witness data layout constants
const SIGNATURE_LENGTH = 65; // 64 bytes signature data + 1 byte recovery ID
const PUBKEY_INDEX_LENGTH = 1;
const WITNESS_DATA_TOTAL_LENGTH =
  SIGNATURE_LENGTH * 2 + PUBKEY_INDEX_LENGTH * 2;

// Witness data offsets
const FIRST_SIGNATURE_OFFSET = 0;
const SECOND_SIGNATURE_OFFSET = SIGNATURE_LENGTH;
const FIRST_PUBKEY_INDEX_OFFSET = SIGNATURE_LENGTH * 2;
const SECOND_PUBKEY_INDEX_OFFSET =
  FIRST_PUBKEY_INDEX_OFFSET + PUBKEY_INDEX_LENGTH;

// Signature verification constants
const SIGNATURE_DATA_LENGTH = 64; // Signature data without recovery ID
const RECOVERY_ID_OFFSET = 64;
const BLAKE160_HASH_LENGTH = 20;

// Contract exit codes
const SUCCESS_CODE = 0;
const INVALID_SIGNATURE = 1;
const INVALID_SCRIPT_ARGS_LENGTH = 2;
const INVALID_WITNESS_DATA_LENGTH = 3;
const INVALID_PUBKEY_INDEX = 4;
const SIGNATURE_RECOVERY_FAILED = 5;
const INVALID_SINCE_VALUE = 6;

// Public key indices
const FIRST_PUBKEY_INDEX = 0;
const SECOND_PUBKEY_INDEX = 1;

// Expected data lengths for validation
const EXPECTED_SCRIPT_ARGS_LENGTH =
  PUBKEY_HASH_START_OFFSET + PUBKEY_HASH_LENGTH * 2;
const EXPECTED_WITNESS_DATA_LENGTH = WITNESS_DATA_TOTAL_LENGTH;

function main(): number {
  log.setLevel(log.LogLevel.Debug);

  // Load and validate input data
  const inputData = loadAndValidateInputs();
  if (typeof inputData === 'number') {
    return inputData; // Return error code
  }

  const { pubkeyHashes, signatures, pubkeyIndices, hasSince, sinceValue } =
    inputData;
  log.debug(`sinceValue: ${sinceValue},hasSince: ${hasSince}`)
  // Generate signing message hash based on whether transaction has since
  let signingMessageHash: Uint8Array;
  if (hasSince && sinceValue) {
    const result = getSigningMessageHashWithSince(sinceValue);
    if (typeof result === 'number') {
      return result; // Return error code if since validation failed
    }
    signingMessageHash = result;
  } else {
    signingMessageHash = getSigningMessageHash();
  }

  log.debug(`Transaction has since: ${hasSince}`);
  log.debug(
    `Signing message hash: ${signingMessageHash} length=${signingMessageHash.length}`
  );

  // Verify both signatures
  const firstSigResult = verifySignature({
    messageHash: signingMessageHash,
    signature: signatures[0],
    pubkeyHashes,
    pubkeyIndex: pubkeyIndices[0],
    signatureName: 'signature1',
    hasSince: hasSince,
    sinceValue: sinceValue,
  });
  log.debug(`Signature verification result for signature1: ${firstSigResult}`)
  if (firstSigResult !== SUCCESS_CODE) {
    log.debug(`Signature verification failed for ${firstSigResult}`);
    return firstSigResult;
  }

  const secondSigResult = verifySignature({
    messageHash: signingMessageHash,
    signature: signatures[1],
    pubkeyHashes,
    pubkeyIndex: pubkeyIndices[1],
    signatureName: 'signature2',
    hasSince: hasSince,
    sinceValue: sinceValue,
  });
  log.debug(`Signature verification result for signature2: ${secondSigResult}`)
  if (secondSigResult !== SUCCESS_CODE) {
    return secondSigResult;
  }
  log.debug('Both signatures verified successfully');
  return SUCCESS_CODE;
}

// Input validation and parsing functions
function loadAndValidateInputs():
  | {
      pubkeyHashes: Uint8Array[];
      signatures: Uint8Array[];
      pubkeyIndices: number[];
      hasSince: boolean;
      sinceValue?: Uint8Array;
    }
  | number {
  const scriptArgs = new Uint8Array(HighLevel.loadScript().args);

  // Validate script args length
  if (scriptArgs.length < EXPECTED_SCRIPT_ARGS_LENGTH) {
    log.debug(
      `Invalid script args length: ${scriptArgs.length}, expected: ${EXPECTED_SCRIPT_ARGS_LENGTH}`
    );
    return INVALID_SCRIPT_ARGS_LENGTH;
  }

  const pubkeyHashes = [
    scriptArgs.slice(
      FIRST_PUBKEY_HASH_OFFSET,
      FIRST_PUBKEY_HASH_OFFSET + PUBKEY_HASH_LENGTH
    ),
    scriptArgs.slice(
      SECOND_PUBKEY_HASH_OFFSET,
      SECOND_PUBKEY_HASH_OFFSET + PUBKEY_HASH_LENGTH
    ),
  ];

  const witnessArgs = HighLevel.loadWitnessArgs(0, bindings.SOURCE_GROUP_INPUT);

  const witnessData = new Uint8Array(witnessArgs.lock!);
  log.debug(`Witness data: ${witnessData}`);

  // Validate witness data length
  if (witnessData.length !== EXPECTED_WITNESS_DATA_LENGTH) {
    log.debug(
      `Invalid witness data length: ${witnessData.length}, expected: ${EXPECTED_WITNESS_DATA_LENGTH}`
    );
    return INVALID_WITNESS_DATA_LENGTH;
  }

  const signatures = [
    witnessData.slice(
      FIRST_SIGNATURE_OFFSET,
      FIRST_SIGNATURE_OFFSET + SIGNATURE_LENGTH
    ),
    witnessData.slice(
      SECOND_SIGNATURE_OFFSET,
      SECOND_SIGNATURE_OFFSET + SIGNATURE_LENGTH
    ),
  ];

  const pubkeyIndices = [
    witnessData[FIRST_PUBKEY_INDEX_OFFSET],
    witnessData[SECOND_PUBKEY_INDEX_OFFSET],
  ];

  // Validate pubkey indices
  const validationResult = validatePubkeyIndices(pubkeyIndices);
  if (validationResult !== SUCCESS_CODE) {
    return validationResult;
  }

  log.debug(`Signatures: [${signatures[0]}, ${signatures[1]}]`);
  log.debug(`Pubkey indices: [${pubkeyIndices[0]}, ${pubkeyIndices[1]}]`);

  // Check if transaction has since field
  let hasSince = false;
  let sinceValue: Uint8Array | undefined;
  try {
    /**
     * Since Field Detection
     * 
     * This section detects whether the current transaction includes a since (timelock) field.
     * The since field is an 8-byte value in the transaction input that can specify:
     * 
     * 1. Absolute timestamp: Transaction valid after specific Unix timestamp
     * 2. Relative timelock: Transaction valid after N seconds from input creation
     * 3. Block height: Transaction valid after specific block number
     * 
     * Detection process:
     * 1. Read the since field from the first input in the current input group
     * 2. Check if any byte is non-zero (zero means no timelock)
     * 3. Store the since value for later validation if timelock is present
     * 
     * If since is detected, signature validation will require additional checks
     * to ensure signatures were created with the correct timelock value.
     */
    const inputIndex = 0;
    const since = bindings.loadInputByField(
      inputIndex,
      bindings.SOURCE_GROUP_INPUT,
      bindings.INPUT_FIELD_SINCE
    );
    const sinceBytes = new Uint8Array(since);

    // Check if since is non-zero (has timelock)
    for (let i = 0; i < sinceBytes.length; i++) {
      if (sinceBytes[i] !== 0) {
        hasSince = true;
        sinceValue = sinceBytes; // Store the since value for later use
        break;
      }
    }
    log.debug(`Transaction has since: ${hasSince}`);
  } catch (error) {
    log.debug(`Error checking since field: ${error}`);
    hasSince = false;
  }

  return { pubkeyHashes, signatures, pubkeyIndices, hasSince, sinceValue };
}

function validatePubkeyIndices(indices: number[]): number {
  if (indices[0] > SECOND_PUBKEY_INDEX || indices[1] > SECOND_PUBKEY_INDEX) {
    log.debug(
      `Invalid pubkey indices: index1=${indices[0]}, index2=${indices[1]}`
    );
    return INVALID_PUBKEY_INDEX;
  }

  // Ensure both signatures reference different public keys (2-of-2 requirement)
  if (indices[0] === indices[1]) {
    log.debug(`Both signatures reference the same pubkey index: ${indices[0]}`);
    return INVALID_PUBKEY_INDEX;
  }

  return SUCCESS_CODE;
}

// Type definition for signature verification parameters
interface SignatureVerificationParams {
  messageHash: Uint8Array;
  signature: Uint8Array;
  pubkeyHashes: Uint8Array[];
  pubkeyIndex: number;
  signatureName: string;
  hasSince?: boolean; // Whether to validate since in signature
  sinceValue?: Uint8Array; // The since value for validation
}

function verifySignature(params: SignatureVerificationParams): number {
  const {
    messageHash,
    signature,
    pubkeyHashes,
    pubkeyIndex,
    signatureName,
    hasSince,
    sinceValue,
  } = params;

  const recoveredPubkey = recoverPublicKey(messageHash, signature);
  if (recoveredPubkey == null) {
    log.debug(`Failed to recover public key from ${signatureName}`);
    return SIGNATURE_RECOVERY_FAILED;
  }

  const recoveredHash = hashPublicKey(recoveredPubkey);
  const expectedHash = getExpectedHash(pubkeyHashes, pubkeyIndex);
  log.debug(
    `${signatureName} recovered public key hash: ${recoveredHash}!!!!!`
  );
  if (!bytesEq(recoveredHash.buffer, expectedHash.buffer)) {
    log.debug(
      `Invalid ${signatureName} hash: ${recoveredHash}, expected: ${expectedHash}`
    );
    return INVALID_SIGNATURE;
  }
  log.debug(`sssssss!!!!!`);
  // Additional validation for transactions with since
  if (hasSince && sinceValue) {
    const sinceValidationResult = validateSignatureWithSince(
      messageHash,
      signature,
      sinceValue
    );
    if (sinceValidationResult !== SUCCESS_CODE) {
      log.debug(`${signatureName} failed since validation`);
      return sinceValidationResult;
    }
  }
  log.debug(`bbb!!!!!`);
  return SUCCESS_CODE;
}

function validateSignatureWithSince(
  messageHash: Uint8Array,
  signature: Uint8Array,
  sinceBytes: Uint8Array
): number {
  try {
    /**
     * Since Value Validation Logic
     * 
     * This function prevents since value manipulation attacks by ensuring that:
     * 1. The provided messageHash was created using the correct since value
     * 2. The signature was actually created for this specific timelock setting
     * 3. Users cannot reuse signatures with different timelock values
     * 
     * Process:
     * 1. Get the actual transaction hash from the blockchain context
     * 2. Reconstruct the expected message hash: hash(tx_hash + since_bytes)
     * 3. Compare with the provided messageHash to ensure consistency
     * 4. This proves the signature was created specifically for this timelock
     */
    
    // Recreate the expected message hash using transaction hash + since
    const txHash = bindings.loadTxHash();
    const txHashBytes = new Uint8Array(txHash);

    const expectedCombinedMessage = new Uint8Array(
      txHashBytes.length + sinceBytes.length
    );
    expectedCombinedMessage.set(txHashBytes, 0);
    expectedCombinedMessage.set(sinceBytes, txHashBytes.length);

    const expectedMessageHash = new Uint8Array(
      hashCkb(expectedCombinedMessage.buffer)
    );

    // Check if the provided messageHash matches what we expect for this since value
    if (!bytesEq(messageHash.buffer, expectedMessageHash.buffer)) {
      log.debug('Signature was not created with correct since value');
      log.debug(`Expected message hash: ${expectedMessageHash}`);
      log.debug(`Provided message hash: ${messageHash}`);
      return INVALID_SINCE_VALUE;
    }

    log.debug(
      'Since validation passed - signature includes correct since value'
    );
    return SUCCESS_CODE;
  } catch (error) {
    log.debug(`Error validating signature with since: ${error}`);
    return INVALID_SINCE_VALUE;
  }
}

function getExpectedHash(
  pubkeyHashes: Uint8Array[],
  pubkeyIndex: number
): Uint8Array {
  return pubkeyIndex === FIRST_PUBKEY_INDEX ? pubkeyHashes[0] : pubkeyHashes[1];
}

function getSigningMessageHash(): Uint8Array {
  const txHash = bindings.loadTxHash();
  log.debug(`Transaction hash: ${txHash}`);
  return new Uint8Array(txHash);
}

function getSigningMessageHashWithSince(
  sinceBytes: Uint8Array
): Uint8Array | number {
  try {
    /**
     * Message Hash Generation for Time-locked Transactions
     * 
     * This function creates the message hash that external users must sign when
     * their transaction includes a since (timelock) field. The process ensures
     * that signatures are cryptographically bound to specific timelock values.
     * 
     * Process:
     * 1. Get the current transaction hash from blockchain context
     * 2. Validate that since field is actually non-zero (has real timelock)
     * 3. Combine transaction_hash + since_bytes into single message
     * 4. Hash the combined message to create final signing hash
     * 
     * This prevents:
     * - Signature reuse with different timelock values  
     * - Timelock bypass attacks
     * - Inconsistent signature-timelock binding
     * 
     * External users must follow the same process when creating signatures!
     */
    
    const txHash = bindings.loadTxHash();

    log.debug(`Creating signing message with since field`);
    log.debug(`Transaction hash: ${txHash}`);
    log.debug(`Since field: ${sinceBytes}`);

    // Create combined message that includes both transaction hash and since field
    const txHashBytes = new Uint8Array(txHash);

    // Validate that since is actually non-zero (double check)
    let hasNonZeroSince = false;
    for (let i = 0; i < sinceBytes.length; i++) {
      if (sinceBytes[i] !== 0) {
        hasNonZeroSince = true;
        break;
      }
    }

    if (!hasNonZeroSince) {
      log.debug(
        'Since field is zero but hasSince was true - inconsistent state'
      );
      return INVALID_SINCE_VALUE;
    }

    // Combine transaction hash and since for signature verification
    const combinedMessage = new Uint8Array(
      txHashBytes.length + sinceBytes.length
    );
    combinedMessage.set(txHashBytes, 0);
    combinedMessage.set(sinceBytes, txHashBytes.length);

    // Hash the combined message to create final signing hash
    const finalHash = hashCkb(combinedMessage.buffer);
    log.debug(`Combined signing hash: ${finalHash}`);

    return new Uint8Array(finalHash);
  } catch (error) {
    log.debug(`Error creating signing hash with since: ${error}`);
    return INVALID_SINCE_VALUE;
  }
}

function recoverPublicKey(
  message_hash: Uint8Array,
  signature: Uint8Array
): Uint8Array | null {
  // Validate signature length
  if (signature.length !== SIGNATURE_LENGTH) {
    log.debug(
      `Invalid signature length: ${signature.length}, expected: ${SIGNATURE_LENGTH}`
    );
    return null;
  }

  let signature_data = signature.slice(0, SIGNATURE_DATA_LENGTH);
  let recovery_id = signature[RECOVERY_ID_OFFSET];

  // Validate recovery ID range (0-3 for secp256k1)
  if (recovery_id > 3) {
    log.debug(`Invalid recovery ID: ${recovery_id}, must be 0-3`);
    return null;
  }

  try {
    let recovered_pubkey = bindings.secp256k1.recover(
      signature_data.buffer,
      recovery_id,
      message_hash.buffer
    );

    // Serialize recovered public key to uncompressed format
    let serialized = bindings.secp256k1.serializePubkey(
      recovered_pubkey,
      false
    );
    return new Uint8Array(serialized);
  } catch (error) {
    log.debug(`Signature recovery failed: ${error}`);
    return null;
  }
}

function hashPublicKey(pubkey: Uint8Array): Uint8Array {
  let hash = hashCkb(pubkey.buffer);
  return new Uint8Array(hash.slice(0, BLAKE160_HASH_LENGTH));
}

bindings.exit(main());
