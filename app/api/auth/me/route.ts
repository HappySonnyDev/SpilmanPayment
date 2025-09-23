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

    // Return user data (excluding password hash)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
      is_active: user.is_active
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