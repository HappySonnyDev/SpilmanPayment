import { hexFrom, hashTypeToBytes, WitnessArgs } from '@ckb-ccc/core';
import { Verifier } from 'ckb-testtool';
import {
  generateCkbSecp256k1Signature,
  generateCkbSecp256k1SignatureWithSince,
  setupContractTransaction,
  setupScriptArgs,
  setupTransactionCells,
  getTransactionMessageHash,
  createWitnessData,
  verifyContractExecution,
} from './helper';

// Test keys for consistent multisig scenarios
const TEST_PRIVATE_KEY_1 =
  '0x63d86723e08f0f813a36ce6aa123bb2289d90680ae1e99d4de8cdb334553f24f';
const TEST_PRIVATE_KEY_2 =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

/**
 * 2-of-2 Multisig Mock Contract Test Suite
 * 
 * This test suite validates the core functionality of the 2-of-2 multisig contract
 * in a controlled mock environment using ckb-testtool. The tests focus on:
 * 
 * 1. Valid signature scenarios (success cases)
 *    - should succeed with valid 2-of-2 multisig signatures
 *    - should succeed with standard signatures (no since)
 * 
 * 2. Invalid signature scenarios (various failure modes)
 *    - should fail when first signature is invalid
 *    - should fail when second signature is invalid
 *    - should fail with signatures for different transaction
 *    - should fail with mixed valid and invalid signatures
 *    - should fail with empty signatures
 * 
 * 3. Script argument validation
 *    - should fail with invalid script args length
 * 
 * 4. Witness data validation
 *    - should fail with invalid witness data length
 * 
 * 5. Public key index validation
 *    - should fail with duplicate pubkey indices
 *    - should fail with out-of-range pubkey index
 * 
 * 6. Signature recovery validation
 *    - should fail with invalid signature recovery ID
 * 
 * 7. Robustness and edge case testing
 *    - should handle threshold validation in script args
 * 
 * Total: 13 comprehensive test cases covering all contract exit codes (0-5)
 * Each test verifies that the contract returns the correct exit code for different
 * scenarios, ensuring robust validation of multisig transactions.
 */
describe('2of2 mock contract tests', () => {
  // Helper function to create a standard transaction setup
  const createStandardTransaction = () => {
    const { resource, tx, mainScript, alwaysSuccessScript, contractScript } =
      setupContractTransaction();
    
    setupScriptArgs(
      mainScript,
      contractScript,
      TEST_PRIVATE_KEY_1,
      TEST_PRIVATE_KEY_2
    );
    setupTransactionCells(tx, mainScript, alwaysSuccessScript, resource);
    
    return { resource, tx, mainScript, alwaysSuccessScript, contractScript };
  };
  
  // Helper function to create valid signatures for a transaction
  const createValidSignatures = (tx: any) => {
    const messageHash = getTransactionMessageHash(tx);
    const signature1 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_1,
      messageHash
    );
    const signature2 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_2,
      messageHash
    );
    return { signature1, signature2, messageHash };
  };
  
  // Helper function to add witness data to transaction
  const addWitnessData = (tx: any, signature1: Uint8Array, signature2: Uint8Array, index1: number = 0, index2: number = 1) => {
    const witnessData = createWitnessData(signature1, signature2, index1, index2);
    tx.witnesses.push(hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes()));
  };
  
  // Helper function to verify contract execution result
  const expectContractResult = (resource: any, tx: any, expectedExitCode: number, testDescription: string) => {
    const verifier = Verifier.from(resource, tx);
    const contractExitCode = verifyContractExecution(verifier);
    
    if (contractExitCode !== expectedExitCode) {
      throw new Error(
        `${testDescription}: Expected exit code ${expectedExitCode}, got: ${contractExitCode}`
      );
    }
    
    console.log(`✅ ${testDescription}: Contract returned exit code ${expectedExitCode}`);
  };
  /**
   * Test Case 1: Valid 2-of-2 Multisig Transaction
   * 
   * Verifies that a properly constructed 2-of-2 multisig transaction succeeds.
   * Both signatures are valid and correspond to the correct public keys.
   * This is the baseline success case for the contract.
   */
  test('should succeed with valid 2-of-2 multisig signatures', async () => {
    const { resource, tx } = createStandardTransaction();
    const { signature1, signature2 } = createValidSignatures(tx);
    
    addWitnessData(tx, signature1, signature2);
    expectContractResult(resource, tx, 0, 'Valid 2-of-2 multisig transaction');
  });

  /**
   * Test Case 2: First Signature Validation Failure
   * 
   * Tests the contract's validation of the first signature. When signature1
   * is created with the wrong private key, the recovered public key won't
   * match the expected public key hash, causing validation to fail.
   */
  test('should fail when first signature is invalid', async () => {
    const { resource, tx } = createStandardTransaction();
    const messageHash = getTransactionMessageHash(tx);
    
    // Create signature1 with wrong private key (should use TEST_PRIVATE_KEY_1)
    const invalidSignature1 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_2,
      messageHash
    );
    const validSignature2 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_2,
      messageHash
    );
    
    addWitnessData(tx, invalidSignature1, validSignature2);
    expectContractResult(resource, tx, 1, 'First signature validation failure');
  });

  /**
   * Test Case 3: Second Signature Validation Failure
   * 
   * Tests the contract's validation of the second signature. When signature2
   * is created with the wrong private key, the contract should detect this
   * and fail with signature validation error.
   */
  test('should fail when second signature is invalid', async () => {
    const { resource, tx } = createStandardTransaction();
    const messageHash = getTransactionMessageHash(tx);
    
    const validSignature1 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_1,
      messageHash
    );
    // Create signature2 with wrong private key (should use TEST_PRIVATE_KEY_2)
    const invalidSignature2 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_1,
      messageHash
    );
    
    addWitnessData(tx, validSignature1, invalidSignature2);
    expectContractResult(resource, tx, 1, 'Second signature validation failure');
  });

  /**
   * Test Case 4: Script Arguments Length Validation
   * 
   * Tests the contract's validation of script arguments structure.
   * The script args must contain the threshold, pubkey count, and both
   * public key hashes. If the args are too short, the contract should
   * fail with INVALID_SCRIPT_ARGS_LENGTH error.
   */
  test('should fail with invalid script args length', async () => {
    const { resource, tx, mainScript, alwaysSuccessScript, contractScript } =
      setupContractTransaction();

    // Create script args that are too short (missing pubkey hashes)
    const shortArgs = new Uint8Array(30); // Too short, should be at least 42 bytes
    shortArgs[0] = 2; // threshold
    shortArgs[1] = 2; // pubkey count

    mainScript.args = hexFrom(
      '0x0000' +
        contractScript.codeHash.slice(2) +
        hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
        hexFrom(shortArgs).slice(2)
    );

    setupTransactionCells(tx, mainScript, alwaysSuccessScript, resource);
    const { signature1, signature2 } = createValidSignatures(tx);
    
    addWitnessData(tx, signature1, signature2);
    expectContractResult(resource, tx, 2, 'Invalid script args length');
  });

  /**
   * Test Case 5: Witness Data Length Validation
   * 
   * Tests the contract's validation of witness data structure.
   * The witness data must be exactly 132 bytes: two 65-byte signatures
   * and two 1-byte public key indices. Invalid length should trigger
   * INVALID_WITNESS_DATA_LENGTH error.
   */
  test('should fail with invalid witness data length', async () => {
    const { resource, tx } = createStandardTransaction();

    // Create witness data with wrong length (too short)
    const invalidWitnessData = new Uint8Array(100); // Should be 132 bytes
    tx.witnesses.push(
      hexFrom(new WitnessArgs(hexFrom(invalidWitnessData)).toBytes())
    );

    expectContractResult(resource, tx, 3, 'Invalid witness data length');
  });

  /**
   * Test Case 6: Duplicate Public Key Index Validation
   * 
   * Tests the contract's validation that both signatures must reference
   * different public keys. In a 2-of-2 multisig, both pubkey indices
   * must be unique. Using the same index for both signatures should
   * trigger INVALID_PUBKEY_INDEX error.
   */
  test('should fail with duplicate pubkey indices', async () => {
    const { resource, tx } = createStandardTransaction();
    const { signature1, signature2 } = createValidSignatures(tx);

    // Use same pubkey index for both signatures (both point to index 0)
    addWitnessData(tx, signature1, signature2, 0, 0);
    expectContractResult(resource, tx, 4, 'Duplicate pubkey indices');
  });

  /**
   * Test Case 7: Out-of-Range Public Key Index Validation
   * 
   * Tests the contract's validation of pubkey index bounds. In a 2-of-2
   * multisig, valid indices are 0 and 1. Any index >= 2 is out of range
   * and should trigger INVALID_PUBKEY_INDEX error.
   */
  test('should fail with out-of-range pubkey index', async () => {
    const { resource, tx } = createStandardTransaction();
    const { signature1, signature2 } = createValidSignatures(tx);

    // Use out-of-range pubkey index (5 is beyond valid range [0,1])
    addWitnessData(tx, signature1, signature2, 0, 5);
    expectContractResult(resource, tx, 4, 'Out-of-range pubkey index');
  });

  /**
   * Test Case 8: Invalid Signature Recovery ID
   * 
   * Tests the contract's handling of corrupted signature recovery IDs.
   * ECDSA signatures include a recovery ID (0-3) used to recover the
   * public key. Invalid recovery IDs (>3) should cause signature
   * recovery to fail, triggering SIGNATURE_RECOVERY_FAILED error.
   */
  test('should fail with invalid signature recovery ID', async () => {
    const { resource, tx } = createStandardTransaction();
    const { signature1, signature2 } = createValidSignatures(tx);

    // Corrupt the recovery ID in signature1 (set to invalid value > 3)
    const corruptedSignature1 = new Uint8Array(signature1);
    corruptedSignature1[64] = 7; // Invalid recovery ID

    addWitnessData(tx, corruptedSignature1, signature2);
    expectContractResult(resource, tx, 5, 'Invalid signature recovery ID');
  });
  
  /**
   * Test Case 9: Valid Signatures without Since (Standard Mode)
   * 
   * Tests successful validation of standard signatures without timelock.
   * This test verifies that when no since field is present, the contract
   * properly validates signatures created with just the transaction hash.
   */
  test('should succeed with standard signatures (no since)', async () => {
    const { resource, tx } = createStandardTransaction();
    const { signature1, signature2 } = createValidSignatures(tx);
    
    addWitnessData(tx, signature1, signature2);
    expectContractResult(resource, tx, 0, 'Standard signatures without since');
  });
  
  /**
   * Test Case 10: Signature-Transaction Hash Mismatch
   * 
   * Tests the contract's detection of signature-transaction mismatch.
   * If signatures are created for a different transaction hash than
   * the actual transaction, the contract should reject them.
   */
  test('should fail with signatures for different transaction', async () => {
    const { resource, tx } = createStandardTransaction();
    
    // Create signatures for a fake transaction hash
    const fakeMessageHash = new Uint8Array(32);
    fakeMessageHash.fill(0xAB); // Fill with fake data
    
    const invalidSignature1 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_1,
      fakeMessageHash
    );
    const invalidSignature2 = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_2,
      fakeMessageHash
    );
    
    addWitnessData(tx, invalidSignature1, invalidSignature2);
    expectContractResult(resource, tx, 1, 'Signatures for different transaction');
  });
  
  /**
   * Test Case 11: Mixed Valid and Invalid Signatures
   * 
   * Tests the contract's ability to detect when one signature is valid
   * but the other is not. The contract should fail even if only one
   * signature is invalid, as both signatures are required for 2-of-2.
   */
  test('should fail with mixed valid and invalid signatures', async () => {
    const { resource, tx } = createStandardTransaction();
    const messageHash = getTransactionMessageHash(tx);
    
    // Create one valid signature and one invalid signature
    const validSignature = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_1,
      messageHash
    );
    const invalidSignature = generateCkbSecp256k1Signature(
      TEST_PRIVATE_KEY_1, // Wrong key for second signature
      messageHash
    );
    
    addWitnessData(tx, validSignature, invalidSignature);
    expectContractResult(resource, tx, 1, 'Mixed valid and invalid signatures');
  });
  
  /**
   * Test Case 12: Empty Signature Validation
   * 
   * Tests the contract's handling of empty or zero signatures.
   * All-zero signatures should fail validation as they cannot
   * produce valid public key recovery.
   */
  test('should fail with empty signatures', async () => {
    const { resource, tx } = createStandardTransaction();
    
    // Create empty signatures (all zeros)
    const emptySignature1 = new Uint8Array(65); // All zeros
    const emptySignature2 = new Uint8Array(65); // All zeros
    
    addWitnessData(tx, emptySignature1, emptySignature2);
    expectContractResult(resource, tx, 5, 'Empty signatures causing recovery failure');
  });
  
  /**
   * Test Case 13: Invalid Threshold Configuration Test
   * 
   * Tests behavior when script args contain unexpected threshold values.
   * While the contract is designed for 2-of-2, this test verifies robustness
   * against malformed script arguments during contract execution.
   */
  test('should handle threshold validation in script args', async () => {
    const { resource, tx, mainScript, alwaysSuccessScript, contractScript } =
      setupContractTransaction();
    
    // Create script args with different threshold (still providing 2 pubkeys)
    const modifiedArgs = new Uint8Array(42);
    modifiedArgs[0] = 3; // Invalid threshold for 2-pubkey setup
    modifiedArgs[1] = 2; // pubkey count
    
    // Add the pubkey hashes
    const pubkeyHash1 = new Uint8Array(20).fill(0x11);
    const pubkeyHash2 = new Uint8Array(20).fill(0x22);
    modifiedArgs.set(pubkeyHash1, 2);
    modifiedArgs.set(pubkeyHash2, 22);
    
    mainScript.args = hexFrom(
      '0x0000' +
        contractScript.codeHash.slice(2) +
        hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
        hexFrom(modifiedArgs).slice(2)
    );
    
    setupTransactionCells(tx, mainScript, alwaysSuccessScript, resource);
    const { signature1, signature2 } = createValidSignatures(tx);
    
    addWitnessData(tx, signature1, signature2);
    // The contract should still validate the 2 signatures provided
    // This test verifies the contract's behavior with threshold/pubkey count mismatch
    expectContractResult(resource, tx, 1, 'Threshold configuration validation');
  });
});
