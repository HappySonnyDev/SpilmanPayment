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

## Safety Features

Both scripts include important safety features:

- **Structure Preservation**: Table schemas remain intact
- **Validation**: Only supported tables can be cleared
- **Confirmation Info**: Clear warnings before execution
- **Verification**: Post-operation record counts
- **Error Handling**: Graceful failure handling

## Warning for Users Table

⚠️ **CAUTION**: Clearing the `users` table will delete all user accounts and cascade delete related data (sessions, payment channels, chunk payments). This action cannot be undone.

## Database Schema Compatibility

These scripts are compatible with database version 10 and include support for:
- Payment channel settlements ([Payment Channel Status Extension](memory://b322f24a-4382-46ad-a522-8ea8ca4df040))
- Chunk-level payment tracking
- User session management
- Transaction data storage