import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { UserRepository, SessionRepository, User, PaymentChannelRepository, PAYMENT_CHANNEL_STATUS } from './database';
import { secp256k1 } from '@noble/curves/secp256k1';

// Utility function to validate public key format
function isValidPublicKey(publicKey: string): boolean {
  try {
    // Remove 0x prefix if present
    const cleanKey = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
    
    // Check if it's a valid hex string of correct length (130 characters = 65 bytes uncompressed)
    // or 66 characters = 33 bytes compressed
    return /^[0-9a-fA-F]{130}$/.test(cleanKey) || /^[0-9a-fA-F]{66}$/.test(cleanKey);
  } catch {
    return false;
  }
}

// Utility function to validate private key format (kept for backward compatibility)
function isValidPrivateKey(privateKey: string): boolean {
  try {
    // Remove 0x prefix if present
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // Check if it's a valid hex string of correct length (64 characters = 32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      return false;
    }
    
    // Try to generate public key to validate the private key
    const privKeyBuffer = Buffer.from(cleanKey, 'hex');
    secp256k1.getPublicKey(privKeyBuffer, false);
    return true;
  } catch {
    return false;
  }
}

// Utility function to generate public key from private key
async function generatePublicKeyFromPrivateKey(privateKey: string): Promise<string> {
  // Use the centralized utility function from ckb module
  const { privateKeyToPublicKeyHex } = await import('./ckb');
  return privateKeyToPublicKeyHex(privateKey);
}

// JWT secret - in production, use a strong secret from environment variables
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
);
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface JWTPayload {
  userId: number;
  username: string;
  publicKey?: string; // Updated to use public key instead of email
  sessionId: string;
}

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;
  private channelRepo: PaymentChannelRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.sessionRepo = new SessionRepository();
    this.channelRepo = new PaymentChannelRepository();
  }

  // Generate public key from server private key
  private async generatePublicKey(): Promise<string> {
    const privateKey = process.env.SELLER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SELLER_PRIVATE_KEY not found in environment variables');
    }
    
    // Use the centralized utility function from ckb module
    const { privateKeyToPublicKeyHex } = await import('./ckb');
    return privateKeyToPublicKeyHex(privateKey);
  }

  // Generate seller address from server private key
  private async generateSellerAddress(): Promise<string> {
    const { ccc } = await import('@ckb-ccc/core');
    const { DEVNET_SCRIPTS } = await import('./ckb');
    
    const privateKey = process.env.SELLER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SELLER_PRIVATE_KEY not found in environment variables');
    }
    
    const client = new ccc.ClientPublicTestnet({
      url: "http://localhost:28114",
      scripts: DEVNET_SCRIPTS,
    });
    const sellerSigner = new ccc.SignerCkbPrivateKey(client, privateKey);
    const sellerAddress = await sellerSigner.getRecommendedAddress();
    
    return sellerAddress;
  }

  // Public method to get the public key
  async getPublicKey(): Promise<string> {
    return this.generatePublicKey();
  }

  // Public method to get seller address
  async getSellerAddress(): Promise<string> {
    return this.generateSellerAddress();
  }

  // Get user's active payment channel
  getActivePaymentChannel(userId: number) {
    const channels = this.channelRepo.getPaymentChannelsByUserId(userId);
    return channels.find(channel => channel.status === PAYMENT_CHANNEL_STATUS.ACTIVE);
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

  // Legacy login method (for backward compatibility)
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
      username: user.username,
      publicKey: user.public_key || undefined, // Handle null public_key
      sessionId
    };
    const token = await this.createJWTToken(tokenPayload);

    return { user, token };
  }

  // Authenticate user with public key (secure method - private key never transmitted)
  async loginWithPublicKey(publicKey: string): Promise<{ user: User; token: string }> {
    // Validate public key format
    if (!isValidPublicKey(publicKey)) {
      throw new Error('Invalid public key format');
    }

    // Try to find user by public key
    let user = this.userRepo.getUserByPublicKey(publicKey);

    if (!user) {
      // Auto-create user with public key if not exists
      // Generate a more unique username using more characters from public key
      let username = `user_${publicKey.slice(0, 12)}`; // Use 12 characters for better uniqueness
      
      // Check if username already exists and add suffix if needed
      let counter = 1;
      const originalUsername = username;
      while (this.userRepo.getUserByUsername(username)) {
        username = `${originalUsername}_${counter}`;
        counter++;
      }
      
      user = await this.userRepo.createUserFromPrivateKey({ username, public_key: publicKey });
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
      username: user.username,
      publicKey: publicKey,
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

// New utility function to validate public key
export function validatePublicKey(publicKey: string): boolean {
  return isValidPublicKey(publicKey);
}