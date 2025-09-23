'use client';

import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { UIMessage } from 'ai';

interface AuthAwareTransportConfig {
  api: string;
  onAuthRequired: () => void;
  isAuthenticated: () => boolean;
}

export class AuthAwareTransport extends AssistantChatTransport<UIMessage> {
  private onAuthRequired: () => void;
  private isAuthenticated: () => boolean;

  constructor(config: AuthAwareTransportConfig) {
    super({ api: config.api });
    this.onAuthRequired = config.onAuthRequired;
    this.isAuthenticated = config.isAuthenticated;
  }

  // Override the request method to check auth before sending
  async request(body: Record<string, unknown>, options?: RequestInit) {
    // Check authentication before making the request
    if (!this.isAuthenticated()) {
      this.onAuthRequired();
      throw new Error('Authentication required');
    }
    
    try {
      return await super.request(body, options);
    } catch (error: unknown) {
      // Also handle 401 errors from the server
      if ((error as { status?: number })?.status === 401 || (error as Error)?.message?.includes('Authentication required')) {
        this.onAuthRequired();
      }
      throw error;
    }
  }
}