"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to user management by default
    router.push('/admin/users');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg text-gray-600 dark:text-gray-400">
        Redirecting to admin dashboard...
      </div>
    </div>
  );
}