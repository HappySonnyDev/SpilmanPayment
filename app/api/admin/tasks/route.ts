import { NextRequest, NextResponse } from 'next/server';
import { cronManager } from '@/lib/cron-manager';

export async function GET(request: NextRequest) {
  try {
    const tasks = await cronManager.getAllTaskStatus();
    return NextResponse.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Error fetching task status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch task status'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { taskName, action } = await request.json();

    if (!taskName || !action) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing taskName or action'
        },
        { status: 400 }
      );
    }

    // Check if task exists
    const availableTasks = cronManager.getAvailableTaskNames();
    if (!availableTasks.includes(taskName)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Task ${taskName} not found`
        },
        { status: 404 }
      );
    }

    let result;
    switch (action) {
      case 'start':
        result = await cronManager.startTask(taskName);
        break;

      case 'stop':
        result = await cronManager.stopTask(taskName);
        break;

      case 'execute':
        result = await cronManager.executeTaskManually(taskName);
        break;

      default:
        return NextResponse.json(
          { 
            success: false,
            error: `Invalid action: ${action}. Use 'start', 'stop', or 'execute'`
          },
          { status: 400 }
        );
    }

    if (result.success) {
      const taskStatus = await cronManager.getTaskStatus(taskName);
      return NextResponse.json({
        success: true,
        message: result.message,
        task: taskStatus
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.message,
          details: result.error
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating task status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update task status'
      },
      { status: 500 }
    );
  }
}