# sign_2of2

A TypeScript implementation of a 2-of-2 multisignature smart contract with time-lock support for the CKB blockchain.

## Overview

This project implements a secure 2-of-2 multisignature contract using the CKB JavaScript VM (ckb-js-vm). The contract requires both signatures to be valid for a transaction to succeed, with optional time-lock (since) functionality for enhanced security in payment channels and escrow scenarios.

### Key Features

- **2-of-2 Multisig Security**: Requires signatures from both parties to authorize transactions
- **Time-lock Support**: Optional since field support for payment channels and time-delayed transactions
- **Signature-Timelock Binding**: Cryptographically binds signatures to specific timelock values to prevent manipulation
- **Comprehensive Validation**: Input validation for script args, witness data, and cryptographic parameters
- **Error Handling**: Detailed error codes for different failure scenarios
- **Extensive Testing**: Mock tests, devnet integration tests, and payment channel scenarios
- **TypeScript Development**: Type-safe smart contract development

## Project Structure

```
sign_2of2/
├── contracts/              # Smart contract source code
│   └── 2of2/
│       └── src/
│           └── index.ts    # 2-of-2 multisig contract implementation
├── tests/                    # Contract tests
│   ├── 2of2.mock.test.ts     # Unit tests with mock CKB environment (13 test cases)
│   ├── 2of2.devnet.test.ts   # Integration tests on local devnet (8 test cases)
│   ├── payment-channel.devnet.test.ts # Payment channel scenarios (5 test cases)
│   └── helper.ts             # Test utility functions
├── scripts/                # Build and utility scripts
│   ├── build-all.js        # Build all contracts
│   ├── build-contract.js   # Build specific contract
│   ├── add-contract.js     # Add new contract template
│   └── deploy.js           # Deploy contracts to CKB networks
├── deployment/             # Deployment artifacts
│   ├── scripts.json        # Deployed contract information
│   ├── system-scripts.json # System script configurations
│   └── devnet/             # Network-specific deployment data
├── dist/                   # Compiled output (generated)
│   ├── 2of2.js            # Bundled JavaScript
│   └── 2of2.bc            # Compiled bytecode
├── package.json
├── tsconfig.json           # TypeScript configuration
├── tsconfig.base.json      # Base TypeScript settings
├── jest.config.cjs         # Jest testing configuration
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- pnpm package manager

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

### Building Contracts

Build all contracts:
```bash
pnpm run build
```

Build the 2of2 contract specifically:
```bash
pnpm run build:contract 2of2
```

### Running Tests

Run all tests (including both mock and devnet tests):
```bash
pnpm test
```

Run only mock tests:
```bash
pnpm test -- 2of2.mock.test.ts
```

Run devnet integration tests (requires local CKB devnet):
```bash
pnpm test -- 2of2.devnet.test.ts
```

Run payment channel tests:
```bash
pnpm test -- payment-channel.devnet.test.ts
```

### Adding New Contracts

Create a new contract:
```bash
pnpm run add-contract my-new-contract
```

This will:
- Create a new contract directory under `contracts/`
- Generate a basic contract template
- Create a corresponding test file

## 2-of-2 Multisig Contract with Time-lock Support

### Contract Overview

The 2-of-2 multisig contract implements a secure multi-party signature verification system with optional time-lock functionality:

- **Two signatures required**: Both parties must sign for transaction validation
- **Public key validation**: Signatures are verified against predefined public key hashes
- **Time-lock support**: Optional since field for payment channels and time-delayed transactions
- **Signature-timelock binding**: Prevents since value manipulation by binding signatures to specific timelock values
- **Comprehensive error handling**: Detailed error codes for different failure scenarios
- **Input validation**: Thorough validation of script args and witness data

### Time-lock (Since) Functionality

When a transaction includes a 'since' field (time-lock), the contract enforces additional security:

#### Signature Message Construction
- **Without since**: `message = transaction_hash`
- **With since**: `message = hash(transaction_hash + since_bytes)`

#### Since Field Format (8 bytes, little-endian)
```
┌─────────────┬─────────────┬──────────────────────────────────────┐
│ Metric Flag │ Type Flag   │              Value                  │
│  (1 bit)    │ (2 bits)    │            (29 bits)                │
└─────────────┴─────────────┴──────────────────────────────────────┘
```

- **Absolute time**: `0x0000000000000000 + timestamp`
- **Relative time**: `0x8000000000000000 + seconds`  
- **Block height**: `0x4000000000000000 + block_number`

#### External User Signature Process
```javascript
// Step 1: Get transaction hash
const txHash = transaction.hash();

// Step 2: If transaction has since field, combine with since
if (hasSince) {
    const sinceBytes = new Uint8Array(8);
    // Convert since value to little-endian bytes
    let since = sinceValue;
    for (let i = 0; i < 8; i++) {
        sinceBytes[i] = Number(since & 0xffn);
        since = since >> 8n;
    }
    
    // Combine transaction hash + since bytes
    const combined = new Uint8Array(txHash.length + sinceBytes.length);
    combined.set(txHash, 0);
    combined.set(sinceBytes, txHash.length);
    
    // Hash the combined message
    const messageHash = hashCkb(combined.buffer);
    
    // Sign the final message hash
    const signature = sign(privateKey, messageHash);
} else {
    // Sign transaction hash directly
    const signature = sign(privateKey, txHash);
}
```

### Contract Structure

#### Script Args (42 bytes total)
```
┌────────┬──────────────────┬───────────┬───────────┬──────────────┬─────────────────┬─────────────────┐
│ Prefix │   Code Hash      │ Hash Type │ Threshold │ Pubkey Count │ First Pubkey    │ Second Pubkey   │
│(2 bytes)│   (32 bytes)     │ (1 byte)  │ (1 byte)  │  (1 byte)    │ Hash (20 bytes) │ Hash (20 bytes) │
└────────┴──────────────────┴───────────┴───────────┴──────────────┴─────────────────┴─────────────────┘
Offset:   0        2              34         35         36             37               57
```
- Prefix: Standard CKB script args prefix
- Code Hash: ckb-js-vm code hash for contract execution  
- Hash Type: Script hash type (typically 1 for type)
- Threshold: Number of required signatures (always 2 for 2-of-2)
- Pubkey Count: Total number of public keys (always 2)
- Pubkey Hashes: blake160 hashes of the public keys for verification

#### Witness Data (132 bytes total)
```
┌─────────────────┬─────────────────┬──────────────┬──────────────┐
│   Signature 1   │   Signature 2   │ Pubkey Index │ Pubkey Index │
│    (65 bytes)   │    (65 bytes)   │      1       │      2       │
│                 │                 │   (1 byte)   │   (1 byte)   │
└─────────────────┴─────────────────┴──────────────┴──────────────┘
Offset:    0              65             130           131
```

#### Error Codes
- `0`: Success
- `1`: Invalid signature
- `2`: Invalid script args length
- `3`: Invalid witness data length
- `4`: Invalid pubkey index
- `5`: Signature recovery failed
- `6`: Invalid since value (timelock manipulation detected)

## Use Cases

### Payment Channels
The contract supports unidirectional payment channels where:
- Buyer locks funds in 2-of-2 multisig with timelock refund
- Seller can cooperatively close channel at any time
- Buyer can reclaim funds after timelock expires if seller is uncooperative
- Since functionality prevents timelock manipulation attacks

### Escrow Services
- Two parties can create time-locked escrow arrangements
- Funds automatically become available after specified time
- Both parties must agree for early release

### Multi-party Wallets
- Secure storage of digital assets requiring two signatures
- Enhanced security compared to single-signature wallets
- Optional time-locked recovery mechanisms

## Development

### Contract Development

1. Edit the 2of2 contract in `contracts/2of2/src/index.ts`
2. Build the contract: `pnpm run build:contract 2of2`
3. Run tests: `pnpm test`

### Build Output

All contracts are built to the global `dist/` directory:
- `dist/2of2.js` - Bundled JavaScript code
- `dist/2of2.bc` - Compiled bytecode for CKB execution

### Testing

The project includes comprehensive test coverage with three types of tests:

#### Mock Tests (`2of2.mock.test.ts`)
- Use `ckb-testtool` framework to simulate CKB blockchain execution
- Fast execution with comprehensive edge case testing
- **13 test cases** covering success and failure scenarios:
  - Valid signature scenarios (2 tests)
  - Invalid signature scenarios (5 tests)
  - Script argument validation (1 test)
  - Witness data validation (1 test)
  - Public key index validation (2 tests)
  - Signature recovery validation (1 test)
  - Robustness and edge case testing (1 test)

#### Contract Functionality Tests (`2of2.devnet.test.ts`)
- Connect to actual local CKB devnet
- Test real transaction execution and contract mechanisms
- **8 test cases** covering:
  - Basic multisig signature verification (1 test)
  - Invalid signature rejection (2 tests)
  - Input validation and error handling (2 tests)
  - Since (timelock) functionality validation (3 tests)

#### Payment Channel Tests (`payment-channel.devnet.test.ts`)
- Real-world payment channel implementation scenarios
- **5 test cases** covering:
  - Channel setup and lifecycle (1 test)
  - Timelock enforcement and security (2 tests)
  - Security against manipulation attacks (1 test)
  - Cooperative channel operations (1 test)

## Available Scripts

- `build` - Build all contracts
- `build:contract <name>` - Build a specific contract
- `test` - Run all tests (mock + devnet)
- `add-contract <name>` - Add a new contract template
- `deploy` - Deploy contracts to CKB network
- `clean` - Remove all build outputs
- `format` - Format code with Prettier

## Deployment

Deploy your contracts to CKB networks using the built-in deploy script:

### Basic Usage

```bash
# Deploy to devnet (default)
pnpm run deploy

# Deploy to testnet
pnpm run deploy -- --network testnet

# Deploy to mainnet
pnpm run deploy -- --network mainnet
```

### Advanced Options

```bash
# Deploy with upgradable type ID
pnpm run deploy -- --network testnet --type-id

# Deploy with custom private key
pnpm run deploy -- --network testnet --privkey 0x...

# Combine multiple options
pnpm run deploy -- --network testnet --type-id --privkey 0x...
```

### Available Options

- `--network <network>` - Target network: `devnet`, `testnet`, or `mainnet` (default: `devnet`)
- `--privkey <privkey>` - Private key for deployment (default: uses offckb's deployer account)
- `--type-id` - Enable upgradable type ID for contract updates

### Deployment Artifacts

After successful deployment, artifacts are saved to the `deployment/` directory:
- `deployment/scripts.json` - Contract script information
- `deployment/<network>/<contract>/deployment.toml` - Deployment configuration
- `deployment/<network>/<contract>/migrations/` - Migration history

## Dependencies

### Core Dependencies
- `@ckb-js-std/bindings` - CKB JavaScript VM bindings
- `@ckb-js-std/core` - Core CKB JavaScript utilities
- `dotenv` - Environment variable management
- `@noble/curves` - Cryptographic curve operations for secp256k1

### Development Dependencies
- `@ckb-ccc/core` - CKB Client SDK for devnet testing
- `ckb-testtool` - Testing framework for CKB contracts
- `esbuild` - Fast JavaScript bundler
- `jest` - JavaScript testing framework
- `typescript` - TypeScript compiler
- `ts-jest` - TypeScript support for Jest
- `prettier` - Code formatter
- `rimraf` - Cross-platform file removal

## Resources

### Helper Functions

The project includes comprehensive utility functions in `tests/helper.ts`:

- **`generateCkbSecp256k1Signature`**: Generate standard ECDSA signatures for CKB
- **`generateCkbSecp256k1SignatureWithSince`**: Generate signatures with timelock binding
- **`derivePublicKeyHash`**: Convert private keys to CKB public key hashes
- **`buildClient`** / **`buildSigner`**: CKB network client setup utilities
- **Contract testing utilities**: Transaction setup, script args creation, witness data formatting

### Documentation

- [CKB JavaScript VM Documentation](https://github.com/nervosnetwork/ckb-js-vm)
- [CKB Developer Documentation](https://docs.nervos.org/docs/script/js/js-quick-start)
- [The Little Book of ckb-js-vm](https://nervosnetwork.github.io/ckb-js-vm/)
- [CKB Timelock Documentation](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md)

## License

MIT
