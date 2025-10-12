import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuthMiddleware } from './lib/auth-middleware';

// Define routes that should be excluded from authentication
const publicRoutes = [
  '/api/auth/login',
  '/api/auth/register', 
  '/api/auth/me', // Allow /me to handle its own auth logic
  '/api/auth/logout',
  '/api/admin/auto-settle-expiring', // Cron job endpoint
  '/api/admin/check-expired-channels', // Cron job endpoint
];

// Define protected routes that require authentication
const protectedRoutes = [
  '/api/chat',
  '/api/channel',
  '/api/chunks',
  '/api/session',
  '/api/admin',
  '/dashboard',
  '/profile'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication for public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    // Check if user is authenticated
    const isAuthenticated = await requireAuthMiddleware(request);
    
    if (!isAuthenticated) {
      // Redirect to home page for web routes (they will see the auth modal)
      if (!pathname.startsWith('/api/')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      // Return 401 for API routes
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};