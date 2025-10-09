"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "../../app/context/auth-context";

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [formData, setFormData] = useState({
    privateKey: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { loginWithPrivateKey } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate private key format client-side
      if (!formData.privateKey.trim()) {
        setError("Private key is required");
        setIsLoading(false);
        return;
      }

      // Basic validation - let server handle detailed validation
      if (formData.privateKey.length < 64) {
        setError(
          "Private key should be at least 64 characters (32 bytes in hex)",
        );
        setIsLoading(false);
        return;
      }

      await loginWithPrivateKey(formData.privateKey);

      // Success - user state is automatically updated by auth context
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="privateKey"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Private Key
        </label>
        <Input
          id="privateKey"
          name="privateKey"
          type="password"
          required
          value={formData.privateKey}
          onChange={handleChange}
          placeholder="Enter your private key (64 hex characters)"
          disabled={isLoading}
          className="font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Your private key will be stored locally for automatic login. Your account will be created automatically using your public key.
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
