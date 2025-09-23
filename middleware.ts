import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuthMiddleware } from './lib/auth-middleware';

// Define protected routes
const protectedRoutes = [
  '/api/chat',
  '/dashboard',
  '/profile'
];

// Since we now use modal auth, we don't need separate auth routes to redirect from

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if user is authenticated
  const isAuthenticated = await requireAuthMiddleware(request);

  // Handle protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
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