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
import { generateCkbAddress } from "@/lib/ckb";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  ckbAddress: string | null;
  ckbBalance: string | null;
  isCkbLoading: boolean;
  loginWithWallet: (privateKey: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCkbAddress: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ckbAddress, setCkbAddress] = useState<string | null>(null);
  const [ckbBalance, setCkbBalance] = useState<string | null>(null);
  const [isCkbLoading, setIsCkbLoading] = useState(false);

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
        setCkbAddress(null);
        setCkbBalance(null);
        return;
      }
      const userData = await getCurrentUser();
      if (userData) {
        setUser(userData);
        // Load CKB address after successful authentication
        loadCkbAddress(storedPrivateKey);
      } else {
        clearStoredCredentials();
        setUser(null);
        setCkbAddress(null);
        setCkbBalance(null);
      }
    } catch {
      clearStoredCredentials();
      setUser(null);
      setCkbAddress(null);
      setCkbBalance(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCkbAddress = async (privateKey: string) => {
    try {
      setIsCkbLoading(true);
      const result = await generateCkbAddress(privateKey);
      setCkbAddress(result.address);
      setCkbBalance(result.balance);
    } catch (error) {
      console.error("Error generating CKB address:", error);
      setCkbAddress(null);
      setCkbBalance(null);
    } finally {
      setIsCkbLoading(false);
    }
  };

  const refreshCkbAddress = async () => {
    const storedPrivateKey = getStoredPrivateKey();
    if (storedPrivateKey) {
      await loadCkbAddress(storedPrivateKey);
    }
  };

  const loginWithWallet = async (privateKey: string) => {
    // Process private key locally and authenticate with server using derived public key
    const userData = await loginWithWalletAPI(privateKey);

    // Store private key in localStorage for persistent authentication
    localStorage.setItem("private_key", privateKey);

    setUser(userData);
    
    // Load CKB address after successful login
    loadCkbAddress(privateKey);
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
    setCkbAddress(null);
    setCkbBalance(null);
  };

  const value = {
    user,
    isLoading,
    ckbAddress,
    ckbBalance,
    isCkbLoading,
    loginWithWallet,
    logout,
    refreshCkbAddress,
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
