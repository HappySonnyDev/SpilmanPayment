# CKB Spilman Payment Channel - AI Assistant Demo

[中文文档](./README_CN.md) | English

A demonstration application showcasing Spilman unidirectional payment channels on CKB (Nervos) blockchain, integrated with AI chat assistant for real-time chunk-level micropayments.

## 🏛️ Monorepo Architecture

This project is organized as a **pnpm workspace monorepo** with the following packages:

```
dapp_2/
├── packages/
│   ├── webapp/              # Next.js web application
│   ├── contracts/           # CKB smart contracts (2of2 multi-sig)
│   └── shared/              # Shared utilities and types
├── pnpm-workspace.yaml      # Workspace configuration
├── package.json             # Root package with workspace scripts
└── tsconfig.json            # Root TypeScript configuration
```

### Package Overview

- **`packages/webapp`**: Next.js-based web application with AI chat and payment channel UI
- **`packages/contracts`**: CKB JavaScript smart contracts for 2-of-2 multi-signature payment channels
- **`packages/shared`**: Shared TypeScript utilities and type definitions used across packages

### Workspace Commands

```bash
# Run commands in all packages
pnpm -r <command>

# Run commands in specific package
pnpm --filter webapp <command>
pnpm --filter contracts <command>
pnpm --filter shared <command>

# Examples:
pnpm --filter webapp dev          # Start webapp dev server
pnpm --filter contracts build     # Build contracts
pnpm --filter contracts test      # Run contract tests
pnpm build                        # Build all packages
```

## 📋 Project Overview

This is an innovative decentralized application (DApp) that demonstrates how to implement micropayments in AI conversation scenarios using CKB blockchain's Spilman payment channels. Users can create payment channels, chat with AI assistants, and make real-time payments for each data chunk received from AI responses, showcasing the characteristics of small amounts and high frequency transactions.

### Core Features

- 🔐 **Wallet Authentication**: Secure authentication system based on CKB private keys
- 💰 **Payment Channel Management**: Create, activate, and settle Spilman unidirectional payment channels
- 🤖 **AI Chat Assistant**: Intelligent conversation system integrated with OpenAI API
- 📊 **Chunk-level Payment**: Real-time tracking and payment for each AI response data chunk
- ⚡ **Auto Payment**: Support for both automatic and manual payment modes
- 🔄 **Real-time Updates**: Real-time synchronization of payment status and balance
- 📈 **Admin Dashboard**: Complete management system for users, channels, and scheduled tasks
- ⏰ **Scheduled Tasks**: Automatic settlement of payment channels nearing expiration

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 15.5.2 (App Router)
- **UI Components**: 
  - Radix UI - Accessible component library
  - Tailwind CSS 4.0 - Atomic CSS
  - Lucide React - Icon library
- **AI Assistant**: 
  - assistant-ui - AI conversation interface components
  - AI SDK - Streaming response handling
- **State Management**: Zustand
- **Date Processing**: Day.js (with timezone support)

### Backend
- **Runtime**: Next.js API Routes (Edge Runtime)
- **Database**: Better-SQLite3 (Local SQLite)
- **Authentication**: JWT (jose)
- **Scheduled Tasks**: node-cron
- **Encryption**: bcryptjs

### Blockchain
- **Network**: CKB Devnet (Testnet)
- **SDK**: @ckb-ccc/core v1.12.1
- **Cryptographic Algorithm**: @noble/curves (secp256k1)
- **Payment Protocol**: Spilman Unidirectional Payment Channel

## 📁 Project Structure

### Monorepo Layout

```
dapp_2/                           # Monorepo root
├── packages/
│   ├── webapp/                   # Next.js web application
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── admin/           # Admin dashboard
│   │   │   │   ├── channels/    # Payment channel management
│   │   │   │   ├── tasks/       # Scheduled task management
│   │   │   │   └── users/       # User management
│   │   │   ├── api/             # API routes
│   │   │   │   ├── admin/       # Admin APIs
│   │   │   │   ├── auth/        # Authentication APIs
│   │   │   │   ├── channel/     # Payment channel APIs
│   │   │   │   ├── chat/        # AI chat APIs
│   │   │   │   └── chunks/      # Chunk-level payment APIs
│   │   │   ├── assistant.tsx    # AI assistant main page
│   │   │   └── page.tsx         # Home page
│   │   ├── components/          # Reusable components
│   │   │   ├── shared/          # Shared business components
│   │   │   └── ui/              # UI base components
│   │   ├── features/            # Feature modules
│   │   │   ├── admin/           # Admin features
│   │   │   ├── assistant/       # AI assistant features
│   │   │   ├── auth/            # Authentication features
│   │   │   ├── payment/         # Payment features
│   │   │   └── settings/        # Settings features
│   │   ├── lib/                 # Utility libraries
│   │   │   ├── client/          # Client-side utilities
│   │   │   ├── server/          # Server-side utilities
│   │   │   └── shared/          # Shared utilities
│   │   ├── scripts/             # Script files
│   │   └── package.json         # Webapp dependencies
│   ├── contracts/               # CKB Smart Contracts
│   │   ├── contracts/2of2/      # 2-of-2 multi-sig contract
│   │   │   └── src/index.ts     # Contract source code
│   │   ├── tests/               # Contract tests
│   │   ├── scripts/             # Build and deploy scripts
│   │   ├── deployment/          # Deployment configurations
│   │   └── package.json         # Contract dependencies
│   └── shared/                  # Shared Package
│       ├── src/
│       │   ├── types.ts         # Shared type definitions
│       │   ├── utils.ts         # Shared utility functions
│       │   └── index.ts         # Package exports
│       └── package.json         # Shared dependencies
├── pnpm-workspace.yaml          # Workspace configuration
├── package.json                 # Root package (workspace scripts)
└── tsconfig.json                # Root TypeScript config
```

## 🚀 Quick Start

### Requirements

- Node.js 22.19 or higher
- pnpm (recommended) or npm/yarn
- CKB Devnet environment (started with offckb) - see installation step 3

### Installation Steps

1. **Clone the project**
   ```bash
   git clone <repository-url>
   cd dapp_2
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Start CKB Devnet Node**
   ```bash
   # Use offckb to start local CKB development network
   offckb node
   ```
   
   > **Note**: Make sure [offckb](https://github.com/RetricSu/offckb) is installed. If not, run:
   > ```bash
   > npm install -g @offckb/cli
   > ```
   > 
   > The node runs on `http://localhost:28114` by default. Keep this terminal window running.

4. **Configure environment variables**
   
   Create `.env.local` file:
   ```env
   # OpenAI API Configuration
   OPENROUTER_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   
   # CKB Blockchain Configuration
   SELLER_PRIVATE_KEY=0xxxxxxxxxxxxx     # Seller (server-side) private key
   
   # JWT Secret (for authentication)
   JWT_SECRET=your-secret-key-here
   

5. **Initialize database**
   
   The database will be created automatically on first run. To clear data:
   ```bash
   # Clear payment channel data
   pnpm run clear-channels
   
   # Clear all database tables
   pnpm run clear-tables
   ```

6. **Start development server**
   ```bash
   pnpm dev
   # or start webapp only
   pnpm --filter webapp dev
   ```
   
   **Additional commands**:
   ```bash
   # Build all packages
   pnpm build
   
   # Build contracts only
   pnpm build:contracts
   
   # Test contracts
   pnpm test:contracts
   
   # Deploy contracts to devnet
   pnpm deploy:contracts
   ```

7. **Access the application**
   
   Open [http://localhost:3000](http://localhost:3000) in your browser

## 💡 User Guide

### 1. User Login

- Enter your CKB private key in the login form on the main page
- Click "Login" to complete login

> **Security Notice**: 
> - 🔒 **We never send your private key to the server** - private keys are processed locally on the client only
> - 🔑 Only the public key derived from your private key is sent to the server for identity verification
> - 💾 **For demonstration purposes**: Private keys are stored in browser's localStorage
> - 🚫 **Do not use this storage method in production environments**
>
> **Get test accounts**:
> ```bash
> # View available test accounts (requires offckb node to be running)
> offckb accounts
> ```
> Choose a private key from one of the accounts for testing.

### 2. Create Payment Channel

- After successful authentication, go to "Payment Channels" tab
- Click "Create New Channel"
- Set channel parameters:
  - **Amount**: Funding amount (CKB)
  - **Duration**: Channel validity period (days)
- Click "Create Channel" to create the channel
- Wait for on-chain confirmation, then channel status becomes "Active"

### 3. Activate Payment Channel

- In the payment channel list, click "Confirm Funding"
- The system will automatically submit funding transaction to CKB network
- After confirmation, channel becomes "Active" status
- Set as default channel to start using

### 4. Chat with AI and Pay

- Return to the main page and start chatting with AI assistant
- Enable "Auto Pay" switch for automatic payment
- Each AI response generates data chunks
- Payment status panel shows:
  - Current consumed Tokens
  - Remaining Tokens
  - Payment record list
- View transaction details for each payment

### 5. Settle Payment Channel

- In Payment Channels, select the channel to settle
- Click "Settle Channel"
- The system will submit the last payment transaction to the blockchain
- After successful settlement, remaining funds are returned to the buyer's address

> **Note**: For demonstration, we added settlement functionality on the client side. In practice, the server also runs a scheduled task that automatically settles channels nearing expiration.

## 🔧 Admin Features

Visit [http://localhost:3000/admin](http://localhost:3000/admin) to access the admin dashboard (requires admin privileges)

### Feature Modules

- **User Management**: View all users, disable/enable users
- **Payment Channel Management**: View all channels, force settlement, modify status
- **Scheduled Task Management**: 
  - Auto-settle channels expiring within 15 minutes
  - Check and mark expired channels (mainly to allow client UI to withdraw deposits; even without this scheduled task, you can still extract deposits using transaction data after expiration)
  - View task execution logs

## 📊 Database Structure

### Main Tables

1. **users** - User table
   - Stores user information, public keys, associated addresses

2. **payment_channels** - Payment channel table
   - Channel ID, amount, status, timestamps
   - Signature data, transaction data

3. **chunk_payments** - Chunk-level payment records
   - Chunk ID, token count, payment status
   - Transaction data, buyer signatures

4. **task_logs** - Scheduled task log table
   - Task execution records, status, results

## 🔐 Security Features

- ✅ Private keys processed client-side only, never sent to server
- ✅ JWT-based secure authentication
- ✅ Payment channels protected by multi-signature scripts
- ✅ All transactions require buyer and seller signatures
- ✅ Relative time locks protect refund transactions

## 🎯 Core Concepts

### Spilman Payment Channel

Spilman channel is a type of unidirectional payment channel that allows buyers to make multiple payments to sellers, but only requires final settlement on-chain once:

1. **Creation Phase**: 
   - Buyer creates funding transaction to lock funds
   - Seller signs refund transaction (with timelock)
   
2. **Payment Phase**:
   - Buyer signs new payment transactions to update allocation
   - Seller holds the latest payment transaction
   
3. **Settlement Phase**:
   - Seller submits the last payment transaction to blockchain
   - Or buyer can refund after timeout

### Chunk-level Payment Flow

1. User sends message to AI assistant
2. AI starts streaming response data
3. When each data chunk arrives:
   - Calculate chunk token count
   - Calculate cumulative payment amount
   - Construct and sign payment transaction
   - Send to server for verification
4. Server validates signature and stores
5. Frontend updates payment status

## 🛠️ Development Commands

```bash
# Development
pnpm dev              # Start development server

# Build
pnpm build            # Production build
pnpm start            # Start production server

# Code Quality
pnpm lint             # ESLint check
pnpm prettier         # Prettier format check
pnpm prettier:fix     # Auto format

# Database Management
pnpm clear-channels   # Clear payment channels
pnpm clear-tables     # Clear all tables

# Scheduled Tasks
pnpm cron-auto-settle # Run auto-settlement task
pnpm cron-scheduler   # Run scheduled task scheduler
```

## 📝 Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|----------|
| `OPENAI_API_KEY` | OpenAI API key | Yes | `sk-xxx...` |
| `SELLER_PRIVATE_KEY` | Seller private key | Yes | `0x...` |
| `JWT_SECRET` | JWT signing secret | Yes | `your-secret` |

## 🐛 Troubleshooting

### Common Issues

**Q: Wallet connection failed**
- Check if private key format is correct (needs 0x prefix)
- Ensure the private key's corresponding address has sufficient CKB balance

**Q: Payment channel creation failed**
- Check if CKB node is running properly
- Verify seller private key and address configuration
- Check browser console and server logs

**Q: AI chat no response**
- Check if OPENAI_API_KEY is configured correctly
- Ensure network connection is stable
- Check if API quota is exhausted

**Q: Scheduled tasks not executing**
- Go to admin dashboard to check task status
- Manually start tasks for testing
- Review task execution logs

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [CKB (Nervos Network)](https://nervos.org/) - Blockchain infrastructure
- [assistant-ui](https://github.com/Yonom/assistant-ui) - AI conversation interface
- [Next.js](https://nextjs.org/) - React framework
- [Radix UI](https://www.radix-ui.com/) - UI component library

## 📞 Contact

For questions or suggestions, please contact:

- Submit GitHub Issues
- Email: [happy.sonny.dev@gmail.com]

---

**Note**: This project is for demonstration and learning purposes only. Please do not use unaudited code in production environments.
