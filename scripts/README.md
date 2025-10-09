# Database Table Clearing Scripts

This directory contains scripts to safely clear database table data while preserving table structures.

## Available Scripts

### 1. clear-database-tables.js (Flexible/Reusable)

A flexible script that can clear multiple database tables based on [Chunk-based Payment Tracking](memory://e0cf1bd6-bebf-4288-b8aa-ffe1e9b1c74c) requirements.

**Supported Tables:**
- `payment_channels` - Payment channel records
- `chunk_payments` - Chunk payment tracking records  
- `users` - User accounts (use with caution!)
- `sessions` - User session data
- `all` - Clear all supported tables

**Usage Examples:**

```bash
# Clear chunk payments only
npm run clear-tables chunk_payments

# Clear payment channels only  
npm run clear-tables payment_channels

# Clear multiple tables
npm run clear-tables payment_channels,chunk_payments

# Clear all supported tables
npm run clear-tables all

# Direct node execution
node scripts/clear-database-tables.js chunk_payments
node scripts/clear-database-tables.js payment_channels,chunk_payments
```

**Features:**
- ✅ Preserves table structures
- ✅ Shows before/after record counts
- ✅ Validates table names
- ✅ Provides clear warnings for destructive operations
- ✅ Displays detailed operation summary
- ✅ Handles multiple tables in one command

### 2. clear-payment-channels.js (Legacy/Specific)

Original script focused specifically on payment channels table.

```bash
npm run clear-channels
# or
node scripts/clear-payment-channels.js
```

### 3. cron-auto-settle.js (Automated Settlement)

🆕 **New!** Simple cron job that calls dedicated API endpoints for automated tasks.

**Features:**
- ✅ Auto-settle payment channels expiring within 15 minutes
- ✅ Calls server-side API endpoints for actual logic
- ✅ Minimal cron code - just HTTP requests
- ✅ Clean separation of concerns
- ✅ Easy to monitor and debug

**Usage Examples:**

```bash
# Run auto-settlement check manually
npm run cron-auto-settle

# Run the scheduler (runs auto-settlement every minute)
npm run cron-scheduler

# Direct node execution
node scripts/cron-auto-settle.js
node scripts/cron-scheduler.js
```

**Architecture:**
- `cron-auto-settle.js` - Simple HTTP client that calls the API
- `cron-scheduler.js` - Cron scheduler that runs the auto-settle script every minute
- `POST /api/admin/auto-settle-expiring` - Server-side API with actual settlement logic

**Environment Variables:**
- `API_BASE_URL` - Base URL for API calls (default: http://localhost:3000)

## Warning for Users Table

⚠️ **CAUTION**: Clearing the `users` table will delete all user accounts and cascade delete related data (sessions, payment channels, chunk payments). This action cannot be undone.

## Database Schema Compatibility

These scripts are compatible with database version 11 and include support for:
- Payment channel settlements with settle_hash tracking
- Chunk-level payment tracking with transaction data
- User session management
- Transaction data storage for blockchain operations