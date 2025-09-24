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
  loginUser,
  registerUser,
  logoutUser,
  getCurrentUser,
} from "@/lib/auth-client";
import { useUserInfo } from "@/lib/user-info-context";


interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { updatePublicKey } = useUserInfo();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      setUser(user);
      // Update public key state
      if (user?.public_key) {
        updatePublicKey(user.public_key);
      } else {
        updatePublicKey(null);
      }
    } catch {
      setUser(null);
      updatePublicKey(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (emailOrUsername: string, password: string) => {
    const user = await loginUser(emailOrUsername, password);
    setUser(user);
    // Update public key state
    if (user?.public_key) {
      updatePublicKey(user.public_key);
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string,
  ) => {
    const user = await registerUser(email, username, password);
    setUser(user);
    // Update public key state
    if (user?.public_key) {
      updatePublicKey(user.public_key);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Continue with logout even if request fails
    }
    setUser(null);
    updatePublicKey(null);
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const value = {
    user,
    isLoading,
    login,
    register,
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
