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
// Supports both JWT token and public key authentication
export async function requireAuthMiddleware(request: Request): Promise<boolean> {
  // Method 1: Check JWT token from cookies (legacy auth)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const authTokenMatch = cookieHeader.match(/auth-token=([^;]+)/);
    const token = authTokenMatch?.[1];
    
    if (token) {
      try {
        const payload = await verifyJWTToken(token);
        if (payload) {
          return true; // Authenticated via JWT
        }
      } catch {
        // JWT verification failed, continue to public key check
      }
    }
  }

  // Method 2: Check public key authentication
  // For now, we'll accept any valid public key format and let individual routes validate
  // const publicKeyHeader = request.headers.get('x-public-key');
  // if (publicKeyHeader) {
  //   // Basic validation: check if it's a valid hex string of appropriate length
  //   const cleanKey = publicKeyHeader.startsWith('0x') ? publicKeyHeader.slice(2) : publicKeyHeader;
  //   const isValidFormat = /^[0-9a-fA-F]{130}$/.test(cleanKey) || /^[0-9a-fA-F]{66}$/.test(cleanKey);
    
  //   if (isValidFormat) {
  //     return true; // Valid public key format, let individual routes handle user lookup
  //   }
  // }

  return false; // No valid authentication found
}