import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ChunkPaymentRepository } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(req);
    const userId = user.id;
    
    const chunkRepo = new ChunkPaymentRepository();
    
    // Get the most recent session_id for this user
    const latestSession = chunkRepo.getLatestSessionForUser(userId);
    
    if (!latestSession) {
      return NextResponse.json({
        success: true,
        data: {
          sessionId: null,
          message: 'No sessions found'
        }
      });
    }
    
    // Get unpaid chunks count for this session
    const unpaidChunks = chunkRepo.getUnpaidChunksByUserSession(userId, latestSession);
    const unpaidTokensCount = chunkRepo.getUnpaidTokensCount(userId, latestSession);
    
    return NextResponse.json({
      success: true,
      data: {
        sessionId: latestSession,
        unpaidChunks: unpaidChunks.length,
        unpaidTokens: unpaidTokensCount
      }
    });
    
  } catch (error) {
    console.error('Current session API error:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}