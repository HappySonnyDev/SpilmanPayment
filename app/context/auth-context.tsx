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
  loginWithPrivateKey as loginWithPrivateKeyAPI,
  logoutUser,
  getCurrentUser,
  getStoredPrivateKey,
  clearStoredCredentials,
} from "@/lib/auth-client";


interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithPrivateKey: (privateKey: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
    try {
      // Check if there's a private key in localStorage
      const storedPrivateKey = getStoredPrivateKey();
      
      if (storedPrivateKey) {
        // If private key exists, get user info from server
        try {
          const userData = await getCurrentUser();
          if (userData) {
            setUser(userData);
          } else {
            // If server doesn't return user info, clear invalid credentials
            clearStoredCredentials();
            setUser(null);
          }
        } catch (error) {
          // If request fails, clear invalid credentials
          clearStoredCredentials();
          setUser(null);
        }
      } else {
        // No private key in localStorage, user is not logged in
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPrivateKey = async (privateKey: string) => {
    const userData = await loginWithPrivateKeyAPI(privateKey);
    
    // Store private key in localStorage for persistent login
    localStorage.setItem('private_key', privateKey);
    
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

  const refreshUser = async () => {
    await checkAuth();
  };

  const value = {
    user,
    isLoading,
    loginWithPrivateKey,
    logout,
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

