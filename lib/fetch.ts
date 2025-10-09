/**
 * Enhanced fetch wrapper with automatic error handling and response parsing
 */

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response: Response
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Wrapper around fetch with enhanced error handling and automatic JSON parsing
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Parsed response data
 */
export async function apiFetch<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // Parse response as JSON
    let data: unknown;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new APIError(
        'Invalid JSON response from server',
        response.status,
        response
      );
    }

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = data as { error?: string; message?: string };
      throw new APIError(
        errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response
      );
    }

    return data as T;
  } catch (error) {
    // Re-throw APIError as-is
    if (error instanceof APIError) {
      throw error;
    }
    
    // Wrap other errors (network issues, etc.)
    throw new APIError(
      error instanceof Error ? error.message : 'Network request failed',
      0,
      {} as Response
    );
  }
}

/**
 * GET request helper
 */
export async function apiGet<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  return apiFetch<T>(url, { method: 'GET', headers });
}

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    headers,
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T = unknown>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
    headers,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE', headers });
}