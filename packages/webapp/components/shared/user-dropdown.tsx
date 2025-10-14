"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, BarChart3, CreditCard, LogOut, ChevronDown, Wallet } from "lucide-react";

interface UserInfo {
  username: string;
  email?: string;
}

interface UserDropdownProps {
  user: UserInfo;
  onMenuClick: (tab: 'profile' | 'usage' | 'billing' | 'recharge') => void;
  onLogout: () => void;
}

export function UserDropdown({ user, onMenuClick, onLogout }: UserDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-3 px-4 py-2 hover:bg-muted [&:focus-visible]:ring-0 [&:focus]:outline-none [&:focus]:ring-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900">{user.username}</p>
              {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuItem onClick={() => onMenuClick('profile')}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMenuClick('usage')}>
          <BarChart3 className="mr-2 h-4 w-4" />
          <span>Usage</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMenuClick('billing')}>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Payment Channel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMenuClick('recharge')}>
          <Wallet className="mr-2 h-4 w-4" />
          <span>Recharge</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}