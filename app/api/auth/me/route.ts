import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authService = new AuthService();
    let user = null;

    // First try to get user from JWT token (legacy auth)
    user = await authService.getCurrentUser(request);

    // If no JWT user, check for public key in request headers
    if (!user) {
      const publicKeyHeader = request.headers.get('x-public-key');
      if (publicKeyHeader) {
        // Find user by public key
        const userRepo = new (await import('@/lib/database')).UserRepository();
        user = userRepo.getUserByPublicKey(publicKeyHeader);
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Generate server public key and seller address
    const serverPublicKey = authService.getPublicKey();
    const sellerAddress = await authService.getSellerAddress();
    
    // Get user's active payment channel
    const activeChannel = authService.getActivePaymentChannel(user.id);

    // Return user data (excluding password hash) with appropriate public key
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
      is_active: Boolean(user.is_active), // Ensure boolean conversion from SQLite integer
      public_key: user.public_key,
      seller_address: sellerAddress,
      serverPublicKey,
      active_channel: activeChannel ? {
        channelId: activeChannel.channel_id,
        txHash: activeChannel.tx_hash,
        amount: activeChannel.amount,
        consumed_tokens: activeChannel.consumed_tokens,
        status: activeChannel.status
      } : null
    };

    return NextResponse.json({
      user: userData
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}