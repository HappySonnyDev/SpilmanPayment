"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  loginWithWallet as loginWithWalletAPI,
  logoutUser,
  getCurrentUser,
  getStoredPrivateKey,
  clearStoredCredentials,
} from "@/lib/auth-client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithWallet: (privateKey: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    
    try {
      const storedPrivateKey = getStoredPrivateKey();
      
      if (!storedPrivateKey) {
        setUser(null);
        return;
      }
      const userData = await getCurrentUser();
      if (userData) {
        setUser(userData);
      } else {
        clearStoredCredentials();
        setUser(null);
      }
    } catch {
      clearStoredCredentials();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithWallet = async (privateKey: string) => {
    // Process private key locally and authenticate with server using derived public key
    const userData = await loginWithWalletAPI(privateKey);

    // Store private key in localStorage for persistent authentication
    localStorage.setItem("private_key", privateKey);

    setUser(userData);
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Continue with logout even if request fails
    }

    // Remove private key from localStorage
    clearStoredCredentials();

    setUser(null);
  };

  const value = {
    user,
    isLoading,
    loginWithWallet,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
