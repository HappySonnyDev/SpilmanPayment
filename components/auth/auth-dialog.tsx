'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

interface AuthDialogProps {
  trigger?: React.ReactNode;
  defaultTab?: 'login' | 'register';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AuthDialog({ trigger, defaultTab = 'login', open: controlledOpen, onOpenChange }: AuthDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);
  
  // Use controlled or internal open state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const handleSuccess = () => {
    setOpen(false);
    setActiveTab('login'); // Reset to login tab for next time
  };

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {activeTab === 'login' ? 'Sign In to Your Account' : 'Create New Account'}
          </DialogTitle>
        </DialogHeader>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`flex-1 py-2 px-4 text-center border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'login'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'register'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => switchTab('register')}
          >
            Sign Up
          </button>
        </div>

        {/* Form Content */}
        <div className="space-y-4">
          {activeTab === 'login' ? (
            <LoginForm onSuccess={handleSuccess} />
          ) : (
            <RegisterForm onSuccess={handleSuccess} />
          )}
        </div>

        {/* Switch Link */}
        <div className="text-center text-sm text-gray-600 mt-4">
          {activeTab === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                className="text-blue-600 hover:text-blue-500 font-medium"
                onClick={() => switchTab('register')}
              >
                Sign up here
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                className="text-blue-600 hover:text-blue-500 font-medium"
                onClick={() => switchTab('login')}
              >
                Sign in here
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}