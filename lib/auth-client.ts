// Client-side authentication utilities (Edge Runtime compatible)

export interface User {
  id: number;
  email?: string; // Optional for backward compatibility
  username: string;
  created_at: string;
  is_active: boolean;
  public_key?: string;
  seller_address?: string;
  serverPublicKey?: string; // Server's public key
  active_channel?: {
    channelId: string;
    txHash: string | null;
    amount: number;
    consumed_tokens: number;
    status: number;
  } | null;
}

// JWT payload interface
export interface JWTPayload {
  userId: number;
  username: string;
  publicKey?: string;
  sessionId: string;
}

// Client-side authentication functions

/**
 * Authenticates user using wallet private key
 * - Private key is processed locally to derive public key
 * - Only public key is sent to server for authentication
 * - Private key never leaves the client for maximum security
 */
export async function loginWithWallet(privateKey: string): Promise<User> {
  // Import utility function to convert private key to public key
  const { privateKeyToPublicKeyHex } = await import('@/lib/ckb');
  const { auth } = await import('@/lib/api');
  
  // Convert private key to public key hex (client-side only)
  const publicKeyHex = privateKeyToPublicKeyHex(privateKey);
  
  // Send only the public key to the server (private key never transmitted)
  const response = await auth.login({ publicKey: publicKeyHex });

  return response.user;
}



export async function logoutUser(): Promise<void> {
  const { auth } = await import('@/lib/api');
  await auth.logout();
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const headers: Record<string, string> = {};
    
    // If we have a private key in localStorage, generate public key locally and send that
    // (private key never leaves the client for security)
    const privateKey = getStoredPrivateKey();
    if (privateKey) {
      try {
        // Import utility function to convert private key to public key
        const { privateKeyToPublicKeyHex } = await import('@/lib/ckb');
        const publicKeyHex = privateKeyToPublicKeyHex(privateKey);
        
        headers['x-public-key'] = publicKeyHex;
      } catch (error) {
        console.error('Error generating public key:', error);
        return null;
      }
    }
    
    const { auth } = await import('@/lib/api');
    const response = await auth.me(headers);
    return response.user;
  } catch {
    return null;
  }
}

// Check if user is logged in based on localStorage private key
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('private_key');
}

// Get stored private key
export function getStoredPrivateKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('private_key');
}

// Clear stored credentials
export function clearStoredCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('private_key');
}