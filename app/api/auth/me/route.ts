import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Generate public key from server private key and seller address
    const publicKey = authService.getPublicKey();
    const sellerAddress = await authService.getSellerAddress();
    
    // Get user's active payment channel
    const activeChannel = authService.getActivePaymentChannel(user.id);

    // Return user data (excluding password hash) with public key and seller address
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
      is_active: user.is_active,
      public_key: publicKey,
      seller_address: sellerAddress,
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