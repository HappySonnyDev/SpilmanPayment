import { NextRequest, NextResponse } from 'next/server';

/**
 * Generic API handler wrapper that provides consistent error handling
 * for authentication and other common errors across all API routes
 */
export function withErrorHandling(
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      console.error('API error:', error);

      // Handle authentication errors
      if (error instanceof Error && error.message === 'Authentication required') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Handle other known errors with specific messages
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      // Handle unknown errors
      return NextResponse.json(
        { 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Specialized wrapper for API handlers that require authentication
 * Automatically handles auth errors and provides cleaner handler signatures
 */
export function withAuth(
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>
) {
  return withErrorHandling(handler);
}

/**
 * Response helper functions for consistent API responses
 */
export const ApiResponse = {
  success: (data?: unknown, status: number = 200) => {
    return NextResponse.json({ success: true, data }, { status });
  },

  error: (message: string, status: number = 400, details?: Record<string, unknown>) => {
    return NextResponse.json(
      { 
        error: message,
        ...(details && { details })
      },
      { status }
    );
  },

  authRequired: () => {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  },

  notFound: (resource: string = 'Resource') => {
    return NextResponse.json(
      { error: `${resource} not found` },
      { status: 404 }
    );
  },

  serverError: (details?: string) => {
    return NextResponse.json(
      { 
        error: 'Internal server error',
        ...(details && { details })
      },
      { status: 500 }
    );
  }
};