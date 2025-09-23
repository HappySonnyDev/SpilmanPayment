import { NextRequest, NextResponse } from 'next/server';
import { AuthService, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { emailOrUsername, password } = await request.json();

    // Validate input
    if (!emailOrUsername || !password) {
      return NextResponse.json(
        { error: 'Email/username and password are required' },
        { status: 400 }
      );
    }

    const authService = new AuthService();
    const { user, token } = await authService.login(emailOrUsername, password);

    // Create response with user data (excluding password hash)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at
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
      if (error.message === 'Invalid credentials') {
        return NextResponse.json(
          { error: 'Invalid email/username or password' },
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