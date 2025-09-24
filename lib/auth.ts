import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { UserRepository, SessionRepository, User } from './database';
import { secp256k1 } from '@noble/curves/secp256k1';

// JWT secret - in production, use a strong secret from environment variables
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
);
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface JWTPayload {
  userId: number;
  email: string;
  username: string;
  sessionId: string;
}

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.sessionRepo = new SessionRepository();
  }

  // Generate public key from server private key
  private generatePublicKey(): string {
    const privateKey = process.env.SELLER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SELLER_PRIVATE_KEY not found in environment variables');
    }
    
    // Remove 0x prefix if present
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    const privKeyBuffer = Buffer.from(cleanPrivateKey, 'hex');
    const publicKey = secp256k1.getPublicKey(privKeyBuffer, false);
    return Buffer.from(publicKey).toString('hex');
  }

  // Public method to get the public key
  getPublicKey(): string {
    return this.generatePublicKey();
  }

  // Generate session ID
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Create JWT token
  private async createJWTToken(payload: JWTPayload): Promise<string> {
    return await new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(JWT_SECRET);
  }

  // Verify JWT token
  private async verifyJWTToken(token: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return payload as unknown as JWTPayload;
    } catch {
      return null;
    }
  }

  // Register new user
  async register(email: string, username: string, password: string): Promise<{ user: User; token: string }> {
    try {
      const user = await this.userRepo.createUser({ email, username, password });
      
      // Create session
      const sessionId = this.generateSessionId();
      const expiresAt = new Date(Date.now() + SESSION_DURATION);
      this.sessionRepo.createSession(user.id, sessionId, expiresAt);

      // Create JWT token
      const tokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        sessionId
      };
      const token = await this.createJWTToken(tokenPayload);

      return { user, token };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login(emailOrUsername: string, password: string): Promise<{ user: User; token: string }> {
    // Try to find user by email first, then by username
    let user = this.userRepo.getUserByEmail(emailOrUsername);
    if (!user) {
      user = this.userRepo.getUserByUsername(emailOrUsername);
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.userRepo.verifyPassword(user, password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    this.userRepo.updateLastLogin(user.id);

    // Create new session
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    this.sessionRepo.createSession(user.id, sessionId, expiresAt);

    // Create JWT token
    const tokenPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      sessionId
    };
    const token = await this.createJWTToken(tokenPayload);

    return { user, token };
  }

  // Logout user
  async logout(token: string): Promise<void> {
    const payload = await this.verifyJWTToken(token);
    if (payload) {
      this.sessionRepo.deleteSession(payload.sessionId);
    }
  }

  // Verify authentication
  async verifyAuth(token: string): Promise<User | null> {
    const payload = await this.verifyJWTToken(token);
    if (!payload) {
      return null;
    }

    // Check if session exists and is valid
    const session = this.sessionRepo.getSession(payload.sessionId);
    if (!session || new Date(session.expires_at) < new Date()) {
      return null;
    }

    // Get user data
    const user = this.userRepo.getUserById(payload.userId);
    return user;
  }

  // Get current user from request
  async getCurrentUser(request: NextRequest): Promise<User | null> {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return null;
    }

    return this.verifyAuth(token);
  }

  // Get current user from server-side cookies
  async getCurrentUserFromCookies(): Promise<User | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return null;
    }

    return this.verifyAuth(token);
  }

  // Clean up expired sessions
  cleanupExpiredSessions(): void {
    this.sessionRepo.deleteExpiredSessions();
  }
}

// Utility functions for authentication
export function setAuthCookie(token: string): string {
  const maxAge = SESSION_DURATION / 1000; // Convert to seconds
  return `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}

export function clearAuthCookie(): string {
  return 'auth-token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/';
}

// Server-side helper (Node.js Runtime)
export async function requireAuth(request: NextRequest): Promise<User> {
  const authService = new AuthService();
  const user = await authService.getCurrentUser(request);
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}