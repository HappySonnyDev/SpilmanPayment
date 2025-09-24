# Payment Channel API Documentation

## POST /api/channel/create

Creates a payment channel with seller signature.

### Request

**Headers:**
- `Content-Type: application/json`
- `Cookie: auth-token=<token>` (authentication required)

**Body:**
```json
{
  "refundTx": {
    // CKB refund transaction structure
  },
  "amount": 1000,
  "day": 1
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "channelId": "channel_1_1640995200000_abc123",
    "sellerSignature": "0x...",
    "refundTx": {
      // Original refund transaction structure
    },
    "amount": 1000,
    "duration": 1,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error (400/401/500):**
```json
{
  "error": "Error message"
}
```

### Database Schema

**payment_channels table:**
- `id` - Auto-increment primary key
- `user_id` - Foreign key to users table
- `channel_id` - Unique channel identifier
- `amount` - Payment amount in CKB
- `duration_days` - Channel duration in days
- `is_active` - Channel active status
- `seller_signature` - Hex-encoded seller signature
- `refund_tx_data` - JSON stringified refund transaction
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp