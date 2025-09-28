// Client-side authentication utilities (Edge Runtime compatible)

export interface User {
  id: number;
  email: string;
  username: string;
  created_at: string;
  is_active: boolean;
  public_key?: string;
  seller_address?: string;
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
  email: string;
  username: string;
  sessionId: string;
}

// Client-side authentication functions
export async function loginUser(emailOrUsername: string, password: string): Promise<User> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emailOrUsername, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data.user;
}

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
    throw new Error(data.error || 'Registration failed');
  }

  return data.user;
}

export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
  });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}