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

// New private key login function
export async function loginWithPrivateKey(privateKey: string): Promise<User> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ privateKey }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data.user;
}


// Registration is no longer needed - users are auto-created on private key login
export async function registerUser(email: string, username: string, password: string): Promise<User> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Registration is no longer available');
  }

  // This will now just return info about the new authentication system
  throw new Error(data.message || 'Registration is no longer required. Please login with your private key.');
}

export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
  });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const headers: HeadersInit = {};
    
    // If we have a private key in localStorage, generate public key and send that
    const privateKey = getStoredPrivateKey();
    if (privateKey) {
      try {
        // Import secp256k1 to generate public key locally
        const { secp256k1 } = await import('@noble/curves/secp256k1');
        const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
        const privKeyBuffer = Buffer.from(cleanPrivateKey, 'hex');
        const publicKey = secp256k1.getPublicKey(privKeyBuffer, false);
        const publicKeyHex = Buffer.from(publicKey).toString('hex');
        
        headers['x-public-key'] = publicKeyHex;
      } catch (error) {
        console.error('Error generating public key:', error);
        return null;
      }
    }
    
    const response = await fetch('/api/auth/me', { headers });
    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
    return null;
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