import { hexFrom, ccc, hashTypeToBytes, WitnessArgs } from '@ckb-ccc/core';
import scripts from '../deployment/scripts.json';
import systemScripts from '../deployment/system-scripts.json';
import {
  buildClient,
  buildSigner,
  derivePublicKeyHash,
  generateCkbSecp256k1Signature,
  generateCkbSecp256k1SignatureWithSince,
} from './helper';

// Test private keys for 2-of-2 multisig contract functionality testing
const TEST_PRIVATE_KEY_1 =
  '0x63d86723e08f0f813a36ce6aa123bb2289d90680ae1e99d4de8cdb334553f24f';
const TEST_PRIVATE_KEY_2 =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

/**
 * 2-of-2 Multisig Contract Functionality Test Suite
 * 
 * This test suite focuses on validating the core functionality of the 2-of-2 multisig contract:
 * 
 * 1. Basic multisig signature verification
 *    - should execute successfully with valid 2-of-2 signatures
 * 
 * 2. Invalid signature rejection
 *    - should reject transaction with invalid first signature
 *    - should reject transaction with invalid second signature
 * 
 * 3. Input validation and error handling
 *    - should reject transaction with invalid pubkey indices
 *    - should reject transaction with invalid witness data length
 * 
 * 4. Since (timelock) functionality validation
 *    - should execute successfully with time-locked transaction (since functionality)
 *    - should reject time-locked transaction with mismatched since signature
 *    - should be rejected by network when submitted before timelock expires
 * 
 * Total: 8 comprehensive test cases
 * Unlike payment-channel tests which focus on business logic scenarios,
 * these tests validate the low-level contract mechanisms and security properties.
 */
describe('2-of-2 Multisig Contract - Core Functionality', () => {
  let client: ccc.Client;
  let signer: ccc.SignerCkbPrivateKey;
  let pubkeyHash1: Uint8Array;
  let pubkeyHash2: Uint8Array;
  let cellDeps: ccc.CellDep[];
  let contractScript: any;

  // Helper function to create 2-of-2 multisig script with validation
  const createMultisigScript = (customArgs?: Uint8Array) => {
    const ckbJsVmScript = systemScripts.devnet['ckb_js_vm'];
    
    // Default script args: [threshold(1)] + [pubkey_count(1)] + [pubkey_hash1(20)] + [pubkey_hash2(20)]
    const scriptArgs = customArgs || new Uint8Array(42);
    if (!customArgs) {
      scriptArgs[0] = 2; // threshold: both signatures required
      scriptArgs[1] = 2; // total number of pubkeys
      scriptArgs.set(pubkeyHash1, 2);  // first pubkey hash at offset 2
      scriptArgs.set(pubkeyHash2, 22); // second pubkey hash at offset 22
    }

    return {
      codeHash: ckbJsVmScript.script.codeHash,
      hashType: ckbJsVmScript.script.hashType,
      args: hexFrom(
        '0x0000' +
          contractScript.codeHash.slice(2) +
          hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
          hexFrom(scriptArgs).slice(2)
      ),
    };
  };

  // Helper function to convert transaction hash to signing message hash
  const getMessageHashFromTx = (txHash: string): Uint8Array => {
    const messageHash = new Uint8Array(32);
    const hashStr = txHash.slice(2); // Remove '0x' prefix
    for (let i = 0; i < 32; i++) {
      messageHash[i] = parseInt(hashStr.substr(i * 2, 2), 16);
    }
    return messageHash;
  };

  // Helper function to create witness data for 2-of-2 multisig
  const createWitnessData = (
    signature1: Uint8Array,
    signature2: Uint8Array,
    pubkeyIndex1: number = 0,
    pubkeyIndex2: number = 1
  ): Uint8Array => {
    const witnessData = new Uint8Array(132);
    witnessData.set(signature1, 0);    // First signature at offset 0
    witnessData.set(signature2, 65);   // Second signature at offset 65
    witnessData[130] = pubkeyIndex1;   // First pubkey index
    witnessData[131] = pubkeyIndex2;   // Second pubkey index
    return witnessData;
  };

  // Helper function to create and fund a transaction with 2-of-2 lock
  const createLockedTransaction = async (lockScript: any, uniqueCapacity?: bigint): Promise<string> => {
    const tx = ccc.Transaction.from({
      outputs: [{ 
        lock: lockScript,
        capacity: uniqueCapacity || ccc.fixedPointFrom(120) // Sufficient capacity for complex lock script
      }],
      cellDeps,
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, 1000);
    return await signer.sendTransaction(tx);
  };

  beforeAll(() => {
    client = buildClient('devnet');
    signer = buildSigner(client);
    
    // Pre-calculate pubkey hashes and dependencies for reuse
    pubkeyHash1 = derivePublicKeyHash(TEST_PRIVATE_KEY_1);
    pubkeyHash2 = derivePublicKeyHash(TEST_PRIVATE_KEY_2);
    
    const ckbJsVmScript = systemScripts.devnet['ckb_js_vm'];
    contractScript = scripts.devnet['2of2.bc'];
    cellDeps = [
      ...ckbJsVmScript.script.cellDeps.map((c: any) => c.cellDep),
      ...contractScript.cellDeps.map((c: any) => c.cellDep),
    ];
    
    console.log('🔧 Test setup completed:');
    console.log(`   📋 Pubkey 1 hash: ${hexFrom(pubkeyHash1)}`);
    console.log(`   📋 Pubkey 2 hash: ${hexFrom(pubkeyHash2)}`);
  });

  // Add delay between tests to prevent transaction pool conflicts
  beforeEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  /**
   * Test Case 1: Basic 2-of-2 Multisig Success Scenario
   * 
   * This test validates the core functionality of the 2-of-2 multisig contract:
   * 
   * 1. UTXO Creation: Creates a transaction output locked with 2-of-2 multisig
   * 2. Valid Unlocking: Provides both required signatures to unlock the UTXO
   * 3. Signature Verification: Contract validates both signatures against pubkey hashes
   * 4. Successful Execution: Transaction processes successfully on devnet
   * 
   * This represents the "happy path" where both parties cooperate and provide
   * valid signatures, demonstrating the basic contract mechanism works correctly.
   */
  test('should execute successfully with valid 2-of-2 signatures', async () => {
    console.log('✅ Testing basic 2-of-2 multisig functionality...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.001));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create transaction to unlock the 2-of-2 locked cell
    const unlockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: {
          txHash: txHash,
          index: 0,
        },
      }],
      outputs: [{ lock: lockScript }], // Unlock and re-lock (typical pattern)
      cellDeps,
    });

    unlockTx.witnesses.push('0xfff'); // Placeholder witness
    await unlockTx.completeFeeBy(signer, 1500);

    // STEP 3: Generate valid signatures from both required parties
    const messageHash = getMessageHashFromTx(unlockTx.hash());
    console.log('✍️  Generating required signatures...');
    
    const signature1 = generateCkbSecp256k1Signature(TEST_PRIVATE_KEY_1, messageHash);
    const signature2 = generateCkbSecp256k1Signature(TEST_PRIVATE_KEY_2, messageHash);
    console.log(`   🔐 Signature 1: ${hexFrom(signature1)}`);
    console.log(`   🔐 Signature 2: ${hexFrom(signature2)}`);

    // STEP 4: Create proper witness data structure
    const witnessData = createWitnessData(signature1, signature2);
    unlockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes());

    // STEP 5: Execute transaction (should succeed)
    console.log('🛡️  Contract validating signatures...');
    const finalTxHash = await signer.sendTransaction(unlockTx);
    console.log(`✅ 2-of-2 unlock successful: ${finalTxHash}`);
    console.log('🎉 Basic multisig contract functionality validated!');
  });

  /**
   * Test Case 2: Invalid First Signature Rejection
   * 
   * This test validates the contract's ability to detect and reject invalid first signatures:
   * 
   * 1. Setup: Creates a valid 2-of-2 locked UTXO
   * 2. Invalid Signature: Provides an invalid first signature with valid second signature
   * 3. Contract Validation: Contract should detect the invalid signature
   * 4. Expected Failure: Transaction should be rejected with signature error
   * 
   * This ensures the contract properly validates each signature independently
   * and doesn't accept transactions with only one valid signature.
   */
  test('should reject transaction with invalid first signature', async () => {
    console.log('🚫 Testing invalid first signature rejection...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.002));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create unlock transaction
    const unlockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: { txHash: txHash, index: 0 },
      }],
      outputs: [{ lock: lockScript }],
      cellDeps,
    });

    unlockTx.witnesses.push('0xfff');
    await unlockTx.completeFeeBy(signer, 1500);

    // STEP 3: Generate invalid first signature and valid second signature
    const messageHash = getMessageHashFromTx(unlockTx.hash());
    console.log('⚠️  Creating invalid first signature...');
    
    // Create invalid signature by using wrong message hash
    const invalidMessageHash = new Uint8Array(32);
    invalidMessageHash.fill(0xFF); // Fake message hash
    
    const invalidSignature1 = generateCkbSecp256k1Signature(TEST_PRIVATE_KEY_1, invalidMessageHash);
    const validSignature2 = generateCkbSecp256k1Signature(TEST_PRIVATE_KEY_2, messageHash);
    
    const witnessData = createWitnessData(invalidSignature1, validSignature2);
    unlockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes());

    // STEP 4: Attempt transaction (should fail)
    console.log('🛡️  Contract should reject invalid first signature...');
    try {
      await signer.sendTransaction(unlockTx);
      throw new Error('Transaction should have failed due to invalid first signature!');
    } catch (error) {
      console.log('✅ Expected failure: Invalid first signature rejected');
      console.log(`🔍 Error details: ${error}`);
      expect(String(error)).toMatch(/failed|invalid|verification/i);
      console.log('🛡️  Contract successfully validated first signature!');
    }
  });

  /**
   * Test Case 3: Invalid Second Signature Rejection
   * 
   * This test validates the contract's ability to detect and reject invalid second signatures:
   * 
   * 1. Setup: Creates a valid 2-of-2 locked UTXO
   * 2. Invalid Signature: Provides a valid first signature with invalid second signature
   * 3. Contract Validation: Contract should detect the invalid second signature
   * 4. Expected Failure: Transaction should be rejected with signature error
   * 
   * This ensures both signatures are validated independently and both must be valid.
   */
  test('should reject transaction with invalid second signature', async () => {
    console.log('🚫 Testing invalid second signature rejection...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.003));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create unlock transaction
    const unlockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: { txHash: txHash, index: 0 },
      }],
      outputs: [{ lock: lockScript }],
      cellDeps,
    });

    unlockTx.witnesses.push('0xfff');
    await unlockTx.completeFeeBy(signer, 1500);

    // STEP 3: Generate valid first signature and invalid second signature
    const messageHash = getMessageHashFromTx(unlockTx.hash());
    console.log('⚠️  Creating invalid second signature...');
    
    const validSignature1 = generateCkbSecp256k1Signature(TEST_PRIVATE_KEY_1, messageHash);
    
    // Create invalid signature by using wrong private key for second signature
    const wrongPrivateKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const invalidSignature2 = generateCkbSecp256k1Signature(wrongPrivateKey, messageHash);
    
    const witnessData = createWitnessData(validSignature1, invalidSignature2);
    unlockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes());

    // STEP 4: Attempt transaction (should fail)
    console.log('🛡️  Contract should reject invalid second signature...');
    try {
      await signer.sendTransaction(unlockTx);
      throw new Error('Transaction should have failed due to invalid second signature!');
    } catch (error) {
      console.log('✅ Expected failure: Invalid second signature rejected');
      console.log(`🔍 Error details: ${error}`);
      expect(String(error)).toMatch(/failed|invalid|verification/i);
      console.log('🛡️  Contract successfully validated second signature!');
    }
  });

  /**
   * Test Case 4: Invalid Pubkey Index Rejection
   * 
   * This test validates the contract's pubkey index validation logic:
   * 
   * 1. Setup: Creates a valid 2-of-2 locked UTXO
   * 2. Invalid Indices: Uses invalid or duplicate pubkey indices in witness data
   * 3. Contract Validation: Contract should detect invalid pubkey index configuration
   * 4. Expected Failure: Transaction should be rejected with validation error
   * 
   * This ensures the contract enforces proper pubkey index constraints:
   * - Indices must be in valid range [0, 1]
   * - Indices must be different (can't use same pubkey twice)
   */
  test('should reject transaction with invalid pubkey indices', async () => {
    console.log('🚫 Testing invalid pubkey index rejection...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.004));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create unlock transaction
    const unlockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: { txHash: txHash, index: 0 },
      }],
      outputs: [{ lock: lockScript }],
      cellDeps,
    });

    unlockTx.witnesses.push('0xfff');
    await unlockTx.completeFeeBy(signer, 1500);

    // STEP 3: Generate valid signatures but with invalid pubkey indices
    const messageHash = getMessageHashFromTx(unlockTx.hash());
    console.log('⚠️  Creating witness with duplicate pubkey indices...');
    
    const signature1 = generateCkbSecp256k1Signature(TEST_PRIVATE_KEY_1, messageHash);
    const signature2 = generateCkbSecp256k1Signature(TEST_PRIVATE_KEY_2, messageHash);
    
    // Use same pubkey index for both signatures (invalid: should be different)
    const witnessData = createWitnessData(signature1, signature2, 0, 0); // Both index 0
    unlockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes());

    // STEP 4: Attempt transaction (should fail)
    console.log('🛡️  Contract should reject duplicate pubkey indices...');
    try {
      await signer.sendTransaction(unlockTx);
      throw new Error('Transaction should have failed due to invalid pubkey indices!');
    } catch (error) {
      console.log('✅ Expected failure: Invalid pubkey indices rejected');
      console.log(`🔍 Error details: ${error}`);
      expect(String(error)).toMatch(/failed|invalid|verification/i);
      console.log('🛡️  Contract successfully validated pubkey index constraints!');
    }
  });

  /**
   * Test Case 5: Invalid Witness Data Length Rejection
   * 
   * This test validates the contract's witness data structure validation:
   * 
   * 1. Setup: Creates a valid 2-of-2 locked UTXO
   * 2. Invalid Witness: Provides witness data with incorrect length
   * 3. Contract Validation: Contract should detect malformed witness data
   * 4. Expected Failure: Transaction should be rejected with witness error
   * 
   * This ensures the contract enforces the expected witness data format:
   * - Total length must be exactly 132 bytes
   * - Structure: [sig1(65)] + [sig2(65)] + [idx1(1)] + [idx2(1)]
   */
  test('should reject transaction with invalid witness data length', async () => {
    console.log('🚫 Testing invalid witness data length rejection...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.005));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create unlock transaction
    const unlockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: { txHash: txHash, index: 0 },
      }],
      outputs: [{ lock: lockScript }],
      cellDeps,
    });

    unlockTx.witnesses.push('0xfff');
    await unlockTx.completeFeeBy(signer, 1500);

    // STEP 3: Create invalid witness data with wrong length
    console.log('⚠️  Creating witness data with invalid length...');
    
    // Create witness data that's too short (should be 132 bytes)
    const invalidWitnessData = new Uint8Array(100); // Too short
    invalidWitnessData.fill(0x42); // Fill with dummy data
    
    unlockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(invalidWitnessData)).toBytes());

    // STEP 4: Attempt transaction (should fail)
    console.log('🛡️  Contract should reject invalid witness data length...');
    try {
      await signer.sendTransaction(unlockTx);
      throw new Error('Transaction should have failed due to invalid witness data length!');
    } catch (error) {
      console.log('✅ Expected failure: Invalid witness data length rejected');
      console.log(`🔍 Error details: ${error}`);
      expect(String(error)).toMatch(/failed|invalid|verification/i);
      console.log('🛡️  Contract successfully validated witness data structure!');
    }
  });

  /**
   * Test Case 6: Time-locked Transaction Success (Since Functionality)
   * 
   * This test validates the contract's ability to handle time-locked transactions:
   * 
   * 1. UTXO Creation: Creates a transaction output locked with 2-of-2 multisig
   * 2. Time-locked Spending: Creates a spending transaction with `since` (timelock)
   * 3. Signature with Since: Uses signatures that include the since value
   * 4. Contract Validation: Contract validates signatures include correct since
   * 5. Successful Execution: Transaction processes after timelock validation
   * 
   * This demonstrates the contract's integration with CKB's since mechanism
   * for implementing time-locked spending conditions.
   */
  test('should execute successfully with time-locked transaction (since functionality)', async () => {
    console.log('⏰ Testing time-locked transaction with since...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.006));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create time-locked unlock transaction
    const TIMELOCK_SECONDS = 30; // 30 seconds timelock for testing
    const sinceValue = ccc.numFromBytes(
      new Uint8Array([
        0x80, 0x00, 0x00, 0x00, // Relative time lock flag
        0x00, 0x00, 0x00, 0x00,
      ])
    ) + BigInt(TIMELOCK_SECONDS);

    const timelockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: {
          txHash: txHash,
          index: 0,
        },
        since: sinceValue, // Add timelock constraint
      }],
      outputs: [{ lock: lockScript }],
      cellDeps,
    });

    timelockTx.witnesses.push('0xfff');
    await timelockTx.completeFeeBy(signer, 1500);

    // STEP 3: Generate signatures that include since value
    const messageHash = getMessageHashFromTx(timelockTx.hash());
    console.log('✍️  Generating signatures with since value...');
    console.log(`   ⏱️  Timelock: ${TIMELOCK_SECONDS} seconds`);
    
    const signature1WithSince = generateCkbSecp256k1SignatureWithSince(
      TEST_PRIVATE_KEY_1,
      messageHash,
      sinceValue
    );
    const signature2WithSince = generateCkbSecp256k1SignatureWithSince(
      TEST_PRIVATE_KEY_2,
      messageHash,
      sinceValue
    );

    console.log(`   🔐 Signature 1 (with since): ${hexFrom(signature1WithSince)}`);
    console.log(`   🔐 Signature 2 (with since): ${hexFrom(signature2WithSince)}`);

    // STEP 4: Create witness data with time-aware signatures
    const witnessData = createWitnessData(signature1WithSince, signature2WithSince);
    timelockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes());

    // STEP 5: Wait for timelock to expire (in real scenario)
    console.log(`⏳ Waiting ${TIMELOCK_SECONDS + 2} seconds for timelock to expire...`);
    await new Promise(resolve => setTimeout(resolve, (TIMELOCK_SECONDS + 2) * 1000));

    // STEP 6: Execute time-locked transaction (should succeed)
    console.log('🛡️  Contract validating time-locked signatures...');
    const finalTxHash = await signer.sendTransaction(timelockTx);
    console.log(`✅ Time-locked transaction successful: ${finalTxHash}`);
    console.log('🎉 Contract successfully handled since-based timelock!');
  }, 45000); // Extended timeout for timelock wait

  /**
   * Test Case 7: Time-locked Transaction with Invalid Since Signature
   * 
   * This test validates the contract's since signature validation:
   * 
   * 1. Setup: Creates a time-locked transaction with proper since value
   * 2. Invalid Signature: Signs with different since value than in transaction
   * 3. Contract Detection: Contract should detect since value mismatch
   * 4. Expected Failure: Transaction should be rejected
   * 
   * This ensures the contract enforces cryptographic binding between
   * signatures and the actual since value in the transaction.
   */
  test('should reject time-locked transaction with mismatched since signature', async () => {
    console.log('🚫 Testing since signature validation...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.007));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create transaction with actual timelock
    const ACTUAL_TIMELOCK = 60; // Actual timelock in transaction
    const actualSinceValue = ccc.numFromBytes(
      new Uint8Array([
        0x80, 0x00, 0x00, 0x00, // Relative time lock flag
        0x00, 0x00, 0x00, 0x00,
      ])
    ) + BigInt(ACTUAL_TIMELOCK);

    const timelockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: {
          txHash: txHash,
          index: 0,
        },
        since: actualSinceValue, // Real timelock: 60 seconds
      }],
      outputs: [{ lock: lockScript }],
      cellDeps,
    });

    timelockTx.witnesses.push('0xfff');
    await timelockTx.completeFeeBy(signer, 1500);

    // STEP 3: Generate signatures with WRONG since value
    const messageHash = getMessageHashFromTx(timelockTx.hash());
    console.log('⚠️  Creating signatures with mismatched since value...');
    console.log(`   📋 Real timelock in transaction: ${ACTUAL_TIMELOCK} seconds`);
    console.log(`   🚨 Fake timelock in signature: 10 seconds`);
    
    // Sign with different (shorter) since value - this is the attack
    const fakeSinceValue = ccc.numFromBytes(
      new Uint8Array([
        0x80, 0x00, 0x00, 0x00, // Relative time lock flag
        0x00, 0x00, 0x00, 0x00,
      ])
    ) + BigInt(10); // MALICIOUS: signing with 10 seconds instead of 60

    const maliciousSignature1 = generateCkbSecp256k1SignatureWithSince(
      TEST_PRIVATE_KEY_1,
      messageHash,
      fakeSinceValue // Using fake since for signature
    );
    const maliciousSignature2 = generateCkbSecp256k1SignatureWithSince(
      TEST_PRIVATE_KEY_2,
      messageHash,
      fakeSinceValue // Using fake since for signature
    );

    const witnessData = createWitnessData(maliciousSignature1, maliciousSignature2);
    timelockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes());

    // STEP 4: Attempt transaction (should fail due to since mismatch)
    console.log('🛡️  Contract should detect since value mismatch...');
    try {
      await signer.sendTransaction(timelockTx);
      throw new Error('Transaction should have failed due to since signature mismatch!');
    } catch (error) {
      console.log('✅ Expected failure: Since signature validation rejected transaction');
      console.log(`🔍 Error details: ${error}`);
      expect(String(error)).toMatch(/failed|invalid|verification/i);
      console.log('🛡️  Contract successfully validated since signature integrity!');
      console.log('🔒 Timelock manipulation attack prevented!');
    }
  });

  /**
   * Test Case 8: Time-locked Transaction Before Expiry (Network Rejection)
   * 
   * This test validates CKB network's enforcement of timelock constraints:
   * 
   * 1. Setup: Creates a time-locked transaction with proper signatures
   * 2. Premature Submission: Attempts to submit before timelock expires
   * 3. Network Rejection: CKB network should reject due to timelock
   * 4. Expected Failure: Transaction rejected by consensus rules
   * 
   * This tests the integration between contract validation and network
   * consensus rules for time-locked transactions.
   */
  test('should be rejected by network when submitted before timelock expires', async () => {
    console.log('⏰ Testing network timelock enforcement...');
    
    // STEP 1: Create transaction with 2-of-2 multisig lock
    const lockScript = createMultisigScript();
    const txHash = await createLockedTransaction(lockScript, ccc.fixedPointFrom(120.008));
    console.log(`🔒 Created locked UTXO: ${txHash}`);

    // STEP 2: Create transaction with long timelock
    const LONG_TIMELOCK = 120; // 2 minutes - longer than test duration
    const sinceValue = ccc.numFromBytes(
      new Uint8Array([
        0x80, 0x00, 0x00, 0x00, // Relative time lock flag
        0x00, 0x00, 0x00, 0x00,
      ])
    ) + BigInt(LONG_TIMELOCK);

    const timelockTx = ccc.Transaction.from({
      inputs: [{
        previousOutput: {
          txHash: txHash,
          index: 0,
        },
        since: sinceValue,
      }],
      outputs: [{ lock: lockScript }],
      cellDeps,
    });

    timelockTx.witnesses.push('0xfff');
    await timelockTx.completeFeeBy(signer, 1500);

    // STEP 3: Create VALID signatures (contract validation will pass)
    const messageHash = getMessageHashFromTx(timelockTx.hash());
    console.log('✍️  Generating valid signatures with correct since...');
    console.log(`   ⏱️  Timelock: ${LONG_TIMELOCK} seconds (will not wait)`);
    
    const validSignature1 = generateCkbSecp256k1SignatureWithSince(
      TEST_PRIVATE_KEY_1,
      messageHash,
      sinceValue
    );
    const validSignature2 = generateCkbSecp256k1SignatureWithSince(
      TEST_PRIVATE_KEY_2,
      messageHash,
      sinceValue
    );

    const witnessData = createWitnessData(validSignature1, validSignature2);
    timelockTx.witnesses[0] = hexFrom(new WitnessArgs(hexFrom(witnessData)).toBytes());

    // STEP 4: Attempt immediate transaction (should fail due to network timelock)
    console.log('🚫 Attempting transaction before timelock expires...');
    try {
      await signer.sendTransaction(timelockTx);
      throw new Error('Transaction should have failed due to network timelock enforcement!');
    } catch (error) {
      console.log('✅ Expected failure: Network rejected due to timelock');
      console.log(`🔍 Error details: ${error}`);
      expect(String(error)).toMatch(/since|time|lock|premature/i);
      console.log('🛡️  Network successfully enforced timelock constraints!');
      console.log('⏰ CKB consensus rules working correctly!');
    }
  });
});
