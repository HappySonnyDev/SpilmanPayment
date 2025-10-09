import { NextRequest, NextResponse } from 'next/server';
import { ScheduledTaskLogRepository } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskName = searchParams.get('taskName');
    const taskType = searchParams.get('taskType');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const limit = parseInt(searchParams.get('limit') || '50'); // Keep for backward compatibility

    const taskLogRepo = new ScheduledTaskLogRepository();
    
    // If pagination parameters are provided, use paginated response
    if (searchParams.get('page') || searchParams.get('pageSize')) {
      if (taskName) {
        const result = taskLogRepo.getTaskLogsByNamePaginated(taskName, page, pageSize);
        const stats = taskLogRepo.getTaskExecutionStats(taskName);
        
        return NextResponse.json({
          success: true,
          ...result,
          stats
        });
      } else {
        // For now, only support pagination for task name queries
        // Can extend to other filters later if needed
        return NextResponse.json(
          { 
            success: false,
            error: 'Pagination is currently only supported for taskName queries'
          },
          { status: 400 }
        );
      }
    } else {
      // Legacy non-paginated response
      let logs;

      if (taskName) {
        logs = taskLogRepo.getTaskLogsByName(taskName, limit);
      } else if (taskType) {
        logs = taskLogRepo.getTaskLogsByType(taskType, limit);
      } else if (status) {
        logs = taskLogRepo.getTaskLogsByStatus(status, limit);
      } else {
        logs = taskLogRepo.getAllTaskLogs(limit);
      }

      // Get execution statistics
      const stats = taskLogRepo.getTaskExecutionStats(taskName || undefined);

      return NextResponse.json({
        success: true,
        logs,
        stats,
        count: logs.length
      });
    }

  } catch (error) {
    console.error('Error fetching task logs:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch task logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}