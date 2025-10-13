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
} from "@/lib/client/auth-client";
import { generateCkbAddress } from "@/lib/shared/ckb";

interface AuthContextType {
  user: User | null;
  privateKey: string | null;
  isLoading: boolean;
  ckbAddress: string | null;
  ckbBalance: string | null;
  isCkbLoading: boolean;
  loginWithWallet: (privateKey: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCkbAddress: () => Promise<void>;
  refreshUser: () => Promise<void>; // Add method to refresh user data
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
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
        setPrivateKey(null);
        setCkbAddress(null);
        setCkbBalance(null);
        return;
      }
      const userData = await getCurrentUser();
      if (userData) {
        setUser(userData);
        setPrivateKey(storedPrivateKey);
        // Load CKB address after successful authentication
        loadCkbAddress(storedPrivateKey);
      } else {
        clearStoredCredentials();
        setUser(null);
        setPrivateKey(null);
        setCkbAddress(null);
        setCkbBalance(null);
      }
    } catch {
      clearStoredCredentials();
      setUser(null);
      setPrivateKey(null);
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
    if (privateKey) {
      await loadCkbAddress(privateKey);
    }
  };

  // Refresh user data from server (useful when payment channels change)
  const refreshUser = async () => {
    if (!privateKey) return;
    
    try {
      const userData = await getCurrentUser();
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  // Listen for default channel changes and refresh user data
  useEffect(() => {
    const handleDefaultChannelChanged = () => {
      console.log('🔄 AuthContext: Default channel changed, refreshing user data');
      refreshUser();
    };

    const handleChannelActivated = () => {
      console.log('🔄 AuthContext: Payment channel activated, refreshing user data');
      refreshUser();
    };

    window.addEventListener('defaultChannelChanged', handleDefaultChannelChanged);
    window.addEventListener('channelActivated', handleChannelActivated);
    
    return () => {
      window.removeEventListener('defaultChannelChanged', handleDefaultChannelChanged);
      window.removeEventListener('channelActivated', handleChannelActivated);
    };
  }, [refreshUser]);

  const loginWithWallet = async (privateKey: string) => {
    // Process private key locally and authenticate with server using derived public key
    const userData = await loginWithWalletAPI(privateKey);

    // Store private key in localStorage for persistent authentication
    localStorage.setItem("private_key", privateKey);

    setUser(userData);
    setPrivateKey(privateKey);
    
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
    setPrivateKey(null);
    setCkbAddress(null);
    setCkbBalance(null);
  };

  const value = {
    user,
    privateKey,
    isLoading,
    ckbAddress,
    ckbBalance,
    isCkbLoading,
    loginWithWallet,
    logout,
    refreshCkbAddress,
    refreshUser,
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
