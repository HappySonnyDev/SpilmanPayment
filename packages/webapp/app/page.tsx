"use client";

import { useAuth } from '@/features/auth/components/auth-context';
import { Assistant } from "./assistant";

export default function Home() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      {/* Always show the Assistant - auth is handled within */}
      <Assistant />
    </div>
  );
}
