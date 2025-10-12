/**
 * API Layer - Centralized API functions for backend communication
 */

import { apiGet, apiPost, APIError } from './fetch';
import { User } from './auth-client';

// API Response Types
interface LoginResponse {
  message: string;
  user: User;
}

interface MeResponse {
  user: User;
}

interface ChannelCreateRequest {
  refundTx: unknown;
  fundingTx: unknown;
  amount: number;
  seconds: number;
}

interface ChannelCreateResponse {
  data: {
    channelId: string;
    status: number;
    statusText: string;
    sellerSignature: string;
    refundTx: unknown;
    fundingTx: unknown;
    amount: number;
    duration: number;
    createdAt: string;
  };
}

interface ChannelListResponse {
  data: {
    channels: unknown[];
  };
}

interface ChannelSettleRequest {
  channelId: string;
}

interface ChannelSettleResponse {
  txHash: string;
  channelStatus: string;
}

interface ChannelSetDefaultRequest {
  channelId: string;
}

// Authentication API
export const auth = {
  /**
   * Login with public key
   */
  async login(data: { publicKey: string }): Promise<LoginResponse> {
    return apiPost<LoginResponse>('/api/auth/login', data);
  },

  /**
   * Get current user info
   */
  async me(headers?: Record<string, string>): Promise<MeResponse> {
    return apiGet<MeResponse>('/api/auth/me', headers);
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    return apiPost<void>('/api/auth/logout');
  },

  /**
   * Register user (legacy - kept for compatibility)
   */
  async register(data: { email: string; username: string; password: string }): Promise<LoginResponse> {
    return apiPost<LoginResponse>('/api/auth/register', data);
  },
};

// Channel API
export const channel = {
  /**
   * Create payment channel
   */
  async create(data: ChannelCreateRequest): Promise<ChannelCreateResponse> {
    return apiPost<ChannelCreateResponse>('/api/channel/create', data);
  },

  /**
   * List payment channels
   */
  async list(): Promise<ChannelListResponse> {
    return apiGet<ChannelListResponse>('/api/channel/list');
  },

  /**
   * Settle payment channel
   */
  async settle(data: ChannelSettleRequest): Promise<ChannelSettleResponse> {
    return apiPost<ChannelSettleResponse>('/api/channel/settle', data);
  },

  /**
   * Set default payment channel
   */
  async setDefault(data: ChannelSetDefaultRequest): Promise<{ message: string }> {
    return apiPost<{ message: string }>('/api/channel/set-default', data);
  },

  /**
   * Confirm funding for channel
   */
  async confirmFunding(data: unknown): Promise<unknown> {
    return apiPost('/api/channel/confirm-funding', data);
  },

  /**
   * Update channel
   */
  async update(data: unknown): Promise<unknown> {
    return apiPost('/api/channel/update', data);
  },
};

// Chat/Session API
export const chat = {
  /**
   * Send chat message
   */
  async send(data: unknown): Promise<unknown> {
    return apiPost('/api/chat', data);
  },
};

// Session API
export const session = {
  /**
   * Get current session
   */
  async current(): Promise<unknown> {
    return apiGet('/api/session/current');
  },

  /**
   * Pay for session
   */
  async pay(data: unknown): Promise<unknown> {
    return apiPost('/api/session/pay', data);
  },
};

// Chunks API
export const chunks = {
  /**
   * Enhanced chunk payment
   */
  async payEnhanced(data: unknown): Promise<unknown> {
    return apiPost('/api/chunks/pay-enhanced', data);
  },

  /**
   * Get latest chunk
   */
  async latest(): Promise<unknown> {
    return apiGet('/api/chunks/latest');
  },

  /**
   * Get chunks
   */
  async get(): Promise<unknown> {
    return apiGet('/api/chunks');
  },
};

// Admin API
export const admin = {
  /**
   * Get all users
   */
  async getUsers(): Promise<unknown> {
    return apiGet('/api/admin/users');
  },

  /**
   * Toggle user status
   */
  async toggleUserStatus(userId: string): Promise<unknown> {
    return apiPost(`/api/admin/users/${userId}/toggle-status`);
  },

  /**
   * Get all channels
   */
  async getChannels(): Promise<unknown> {
    return apiGet('/api/admin/channels');
  },

  /**
   * Settle channel (admin)
   */
  async settleChannel(channelId: string): Promise<unknown> {
    return apiPost(`/api/admin/channels/${channelId}/settle`);
  },

  /**
   * Update channel status
   */
  async updateChannelStatus(channelId: string): Promise<unknown> {
    return apiPost(`/api/admin/channels/${channelId}/status`);
  },

  /**
   * Get tasks
   */
  async getTasks(): Promise<unknown> {
    return apiGet('/api/admin/tasks');
  },

  /**
   * Get task logs
   */
  async getTaskLogs(): Promise<unknown> {
    return apiGet('/api/admin/task-logs');
  },

  /**
   * Auto settle expiring channels
   */
  async autoSettleExpiring(): Promise<unknown> {
    return apiPost('/api/admin/auto-settle-expiring');
  },

  /**
   * Check expired channels
   */
  async checkExpiredChannels(): Promise<unknown> {
    return apiPost('/api/admin/check-expired-channels');
  },
};

// Debug API
export const debug = {
  /**
   * Check payment status
   */
  async paymentStatus(): Promise<unknown> {
    return apiGet('/api/debug/payment-status');
  },
};

// Export APIError for error handling
export { APIError };