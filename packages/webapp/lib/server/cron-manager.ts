import * as cron from 'node-cron';

interface TaskConfig {
  name: string;
  description: string;
  schedule: string;
  taskFunction: () => Promise<void>;
}

interface TaskStatus {
  name: string;
  description: string;
  schedule: string;
  running: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'stopped' | 'error';
}

class CronManager {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private taskConfigs: Map<string, TaskConfig> = new Map();

  constructor() {
    this.initializeTasks();
  }

  private initializeTasks() {
    // Define available tasks
    const taskConfigs: TaskConfig[] = [
      {
        name: 'auto-settle-expiring',
        description: 'Auto-settle payment channels expiring within 15 minutes',
        schedule: '* * * * *', // Every minute
        taskFunction: this.autoSettleTask.bind(this)
      },
      {
        name: 'check-expired-channels',
        description: 'Check and expire payment channels that have passed their duration',
        schedule: '*/10 * * * *', // Every 10 minutes
        taskFunction: this.checkExpiredChannelsTask.bind(this)
      }
    ];

    // Register task configs but don't start them
    taskConfigs.forEach(config => {
      this.taskConfigs.set(config.name, config);
    });
  }

  private async autoSettleTask(): Promise<void> {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                    process.env.NODE_ENV === 'production' 
                      ? 'https://your-domain.com' 
                      : 'http://localhost:3000';
      
      const portsToTry = [3000, 3001, 3002];
      let lastError: Error | null = null;
      
      for (const port of portsToTry) {
        try {
          const url = apiUrl.includes('localhost') 
            ? `http://localhost:${port}/api/admin/auto-settle-expiring`
            : `${apiUrl}/api/admin/auto-settle-expiring`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            console.log('[CRON] Auto-settlement completed:', result.settledCount, '/', result.checkedCount);
            return;
          } else {
            lastError = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      throw lastError || new Error('All API endpoints failed');
      
    } catch (error) {
      console.error('[CRON] Auto-settlement error:', error);
      throw error;
    }
  }

  private async checkExpiredChannelsTask(): Promise<void> {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                    process.env.NODE_ENV === 'production' 
                      ? 'https://your-domain.com' 
                      : 'http://localhost:3000';
      
      const portsToTry = [3000, 3001, 3002];
      let lastError: Error | null = null;
      
      for (const port of portsToTry) {
        try {
          const url = apiUrl.includes('localhost') 
            ? `http://localhost:${port}/api/admin/check-expired-channels`
            : `${apiUrl}/api/admin/check-expired-channels`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            console.log('[CRON] Check expired channels:', result.data?.expired_count || 0, '/', result.data?.checked_count || 0);
            return;
          } else {
            lastError = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      throw lastError || new Error('All API endpoints failed');
      
    } catch (error) {
      console.error('[CRON] Check expired channels error:', error);
      throw error;
    }
  }

  async startTask(taskName: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const config = this.taskConfigs.get(taskName);
      if (!config) {
        return { success: false, message: `Task ${taskName} not found` };
      }

      // Check if task is already running
      const existingTask = this.tasks.get(taskName);
      if (existingTask) {
        const status = await existingTask.getStatus();
        if (status !== 'stopped') {
          return { success: false, message: `Task ${taskName} is already running` };
        }
        // Stop existing task before creating new one
        await existingTask.stop();
      }

      // Create new task (will be started manually)
      const task = cron.schedule(config.schedule, config.taskFunction, {
        timezone: 'Asia/Shanghai'
      });

      this.tasks.set(taskName, task);
      await task.start();

      return { success: true, message: `Task ${taskName} started successfully` };

    } catch (error) {
      console.error(`[CRON-MANAGER] ❌ Failed to start task ${taskName}:`, error);
      return { 
        success: false, 
        message: `Failed to start task ${taskName}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async stopTask(taskName: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const task = this.tasks.get(taskName);
      if (!task) {
        return { success: false, message: `Task ${taskName} not found or not running` };
      }

      await task.stop();
      return { success: true, message: `Task ${taskName} stopped successfully` };

    } catch (error) {
      console.error(`[CRON-MANAGER] ❌ Failed to stop task ${taskName}:`, error);
      return { 
        success: false, 
        message: `Failed to stop task ${taskName}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getTaskStatus(taskName: string): Promise<TaskStatus | null> {
    try {
      const config = this.taskConfigs.get(taskName);
      if (!config) {
        return null;
      }

      const task = this.tasks.get(taskName);
      let running = false;
      let status: 'active' | 'stopped' | 'error' = 'stopped';

      if (task) {
        const taskStatus = await task.getStatus();
        running = taskStatus === 'idle' || taskStatus === 'running';
        status = running ? 'active' : 'stopped';
      }

      return {
        name: config.name,
        description: config.description,
        schedule: config.schedule,
        running,
        status,
        lastRun: running ? new Date().toISOString() : undefined,
        nextRun: running && task ? task.getNextRun()?.toISOString() : undefined
      };

    } catch (error) {
      console.error(`[CRON-MANAGER] ❌ Failed to get status for task ${taskName}:`, error);
      return {
        name: taskName,
        description: 'Unknown task',
        schedule: 'Unknown',
        running: false,
        status: 'error'
      };
    }
  }

  async getAllTaskStatus(): Promise<TaskStatus[]> {
    const statuses: TaskStatus[] = [];
    
    for (const taskName of this.taskConfigs.keys()) {
      const status = await this.getTaskStatus(taskName);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  async executeTaskManually(taskName: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const config = this.taskConfigs.get(taskName);
      if (!config) {
        return { success: false, message: `Task ${taskName} not found` };
      }

      await config.taskFunction();
      
      return { success: true, message: `Task ${taskName} executed successfully` };

    } catch (error) {
      console.error(`[CRON-MANAGER] ❌ Failed to execute task ${taskName}:`, error);
      return { 
        success: false, 
        message: `Failed to execute task ${taskName}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async stopAllTasks(): Promise<void> {
    for (const [taskName, task] of this.tasks) {
      try {
        await task.stop();
      } catch (error) {
        console.error(`[CRON] Failed to stop task ${taskName}:`, error);
      }
    }
    
    this.tasks.clear();
  }

  getAvailableTaskNames(): string[] {
    return Array.from(this.taskConfigs.keys());
  }
}

// Export singleton instance
export const cronManager = new CronManager();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  await cronManager.stopAllTasks();
});

process.on('SIGINT', async () => {
  await cronManager.stopAllTasks();
});