"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, CreditCard, LayoutDashboard, ChevronLeft, Menu, Clock } from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  {
    name: "User Management",
    href: "/admin/users",
    icon: Users,
  },
  {
    name: "Payment Channels",
    href: "/admin/channels",
    icon: CreditCard,
  },
  {
    name: "Scheduled Tasks",
    href: "/admin/tasks",
    icon: Clock,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar - Collapsible with max width */}
      <div className={cn(
        "bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300",
        isSidebarCollapsed ? "w-16" : "w-72"
      )}>
        {/* Header */}
        <div className={cn(
          "border-b border-gray-200 dark:border-gray-700 transition-all duration-300",
          isSidebarCollapsed ? "px-2 py-4" : "px-6 py-6"
        )}>
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                  <LayoutDashboard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Admin Dashboard
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Management System
                  </p>
                </div>
              </div>
              
              {/* Collapse Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              
              {/* Expand Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-6 transition-all duration-300",
          isSidebarCollapsed ? "px-2" : "px-6"
        )}>
          <div className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-colors group relative",
                    isSidebarCollapsed ? "justify-center p-3" : "space-x-3 px-4 py-3",
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  )}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isSidebarCollapsed && (
                    <span>{item.name}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className={cn(
          "px-6 py-4 border-t border-gray-200 dark:border-gray-700 transition-opacity duration-300",
          isSidebarCollapsed ? "opacity-0" : "opacity-100"
        )}>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Admin Panel v1.0
          </p>
        </div>
      </div>

      {/* Main Content - Flexible width */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                {pathname === "/admin/users" && (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      User Management
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Manage system users and their permissions
                    </p>
                  </>
                )}
                {pathname === "/admin/channels" && (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Payment Channels
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Monitor and manage payment channels
                    </p>
                  </>
                )}
                {pathname === "/admin/tasks" && (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Scheduled Tasks
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Manage automated tasks and cron jobs
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}