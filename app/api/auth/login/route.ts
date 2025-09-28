import { NextRequest, NextResponse } from 'next/server';
import { AuthService, setAuthCookie, validatePrivateKey } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privateKey, emailOrUsername, password } = body;

    const authService = new AuthService();
    let user, token;

    if (privateKey) {
      // New private key authentication
      if (!validatePrivateKey(privateKey)) {
        return NextResponse.json(
          { error: 'Invalid private key format' },
          { status: 400 }
        );
      }

      const result = await authService.loginWithPrivateKey(privateKey);
      user = result.user;
      token = result.token;
    } else if (emailOrUsername && password) {
      // Legacy email/password authentication
      const result = await authService.login(emailOrUsername, password);
      user = result.user;
      token = result.token;
    } else {
      return NextResponse.json(
        { error: 'Either private key or email/username and password are required' },
        { status: 400 }
      );
    }

    // Get public key and seller address
    const publicKey = user.public_key || authService.getPublicKey();
    const sellerAddress = await authService.getSellerAddress();
    
    // Get user's active payment channel
    const activeChannel = authService.getActivePaymentChannel(user.id);

    // Create response with user data (excluding password hash) including public key and seller address
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
      is_active: Boolean(user.is_active), // Ensure boolean conversion from SQLite integer
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

    const response = NextResponse.json({
      message: 'Login successful',
      user: userData
    });

    // Set authentication cookie
    response.headers.set('Set-Cookie', setAuthCookie(token));

    return response;

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials' || error.message === 'Invalid private key format') {
        return NextResponse.json(
          { error: 'Invalid credentials or private key' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}