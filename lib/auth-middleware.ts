// Edge Runtime compatible auth utilities for middleware
import { jwtVerify } from 'jose';

// JWT secret - same as in auth.ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
);

interface JWTPayload {
  userId: number;
  email: string;
  username: string;
  sessionId: string;
}

// Verify JWT token in middleware (Edge Runtime compatible)
export async function verifyJWTToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Check if user is authenticated (Edge Runtime compatible)
export async function requireAuthMiddleware(request: Request): Promise<boolean> {
  // Get token from cookies header
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }

  // Parse auth-token from cookie string
  const authTokenMatch = cookieHeader.match(/auth-token=([^;]+)/);
  const token = authTokenMatch?.[1];
  
  if (!token) {
    return false;
  }

  try {
    const payload = await verifyJWTToken(token);
    return !!payload;
  } catch {
    return false;
  }
}