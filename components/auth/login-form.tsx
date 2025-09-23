'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from './auth-context';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(formData.emailOrUsername, formData.password);
      
      // Success - user state is automatically updated by auth context
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="emailOrUsername" className="block text-sm font-medium text-gray-700 mb-1">
          Email or Username
        </label>
        <Input
          id="emailOrUsername"
          name="emailOrUsername"
          type="text"
          required
          value={formData.emailOrUsername}
          onChange={handleChange}
          placeholder="Enter your email or username"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}