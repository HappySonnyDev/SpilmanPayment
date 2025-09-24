"use client";

import React, { createContext, useContext, ReactNode } from 'react';

// 用户信息状态类型
interface UserInfo {
  publicKey: string | null;
  // 可以添加更多用户相关信息
  // userId?: number;
  // preferences?: any;
}

// Context 类型定义
interface UserInfoContextType {
  userInfo: UserInfo;
  updatePublicKey: (publicKey: string | null) => void;
  // 可以添加更多更新方法
  // updateUserId: (userId: number) => void;
  // updatePreferences: (preferences: any) => void;
}

// 创建 Context
const UserInfoContext = createContext<UserInfoContextType | undefined>(undefined);

// Provider 组件
export function UserInfoProvider({ children }: { children: ReactNode }) {
  const [userInfo, setUserInfo] = React.useState<UserInfo>({
    publicKey: null,
  });

  const updatePublicKey = (publicKey: string | null) => {
    setUserInfo(prev => ({
      ...prev,
      publicKey,
    }));
  };

  // 可以添加更多更新方法
  // const updateUserId = (userId: number) => {
  //   setUserInfo(prev => ({
  //     ...prev,
  //     userId,
  //   }));
  // };

  const value = {
    userInfo,
    updatePublicKey,
    // updateUserId,
  };

  return (
    <UserInfoContext.Provider value={value}>
      {children}
    </UserInfoContext.Provider>
  );
}

// Hook 方便组件使用
export function useUserInfo() {
  const context = useContext(UserInfoContext);
  if (context === undefined) {
    throw new Error('useUserInfo must be used within a UserInfoProvider');
  }
  return context;
}