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

    // Generate public key from server private key
    const publicKey = authService.getPublicKey();

    // Return user data (excluding password hash) with public key
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
      is_active: user.is_active,
      public_key: publicKey
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