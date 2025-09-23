import { NextRequest, NextResponse } from 'next/server';
import { AuthService, clearAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (token) {
      const authService = new AuthService();
      await authService.logout(token);
    }

    const response = NextResponse.json({
      message: 'Logout successful'
    });

    // Clear authentication cookie
    response.headers.set('Set-Cookie', clearAuthCookie());

    return response;

  } catch {
    const response = NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );

    // Clear cookie anyway
    response.headers.set('Set-Cookie', clearAuthCookie());
    return response;
  }
}