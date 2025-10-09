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
      }
    ];

    // Register task configs but don't start them
    taskConfigs.forEach(config => {
      this.taskConfigs.set(config.name, config);
    });
  }

  private async autoSettleTask(): Promise<void> {
    try {
      console.log('[CRON-MANAGER] 🕐 Running auto-settlement task...');
      
      // Determine the correct API URL (use environment variable or default)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                    process.env.NODE_ENV === 'production' 
                      ? 'https://your-domain.com' 
                      : 'http://localhost:3000';
      
      // Try different ports if the default fails
      const portsToTry = [3000, 3001, 3002];
      let lastError: Error | null = null;
      
      for (const port of portsToTry) {
        try {
          const url = apiUrl.includes('localhost') 
            ? `http://localhost:${port}/api/admin/auto-settle-expiring`
            : `${apiUrl}/api/admin/auto-settle-expiring`;
            
          console.log(`[CRON-MANAGER] Trying API URL: ${url}`);
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            console.log('[CRON-MANAGER] ✅ Auto-settlement completed:', {
              settledCount: result.settledCount,
              checkedCount: result.checkedCount
            });
            return; // Success, exit the function
          } else {
            console.log(`[CRON-MANAGER] API responded with status ${response.status} for port ${port}`);
            lastError = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.log(`[CRON-MANAGER] Failed to connect to port ${port}:`, error instanceof Error ? error.message : error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      
      // If we get here, all ports failed
      throw lastError || new Error('All API endpoints failed');
      
    } catch (error) {
      console.error('[CRON-MANAGER] ❌ Auto-settlement task error:', error);
      throw error; // Re-throw to ensure proper error handling
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

      console.log(`[CRON-MANAGER] 🚀 Started task: ${taskName}`);
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
      console.log(`[CRON-MANAGER] 🛑 Stopped task: ${taskName}`);
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

      // Execute the task function directly, regardless of scheduling status
      console.log(`[CRON-MANAGER] 🔧 Manually executing task: ${taskName}`);
      await config.taskFunction();
      
      console.log(`[CRON-MANAGER] ✅ Manually executed task: ${taskName}`);
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
    console.log('[CRON-MANAGER] 🛑 Stopping all tasks...');
    
    for (const [taskName, task] of this.tasks) {
      try {
        await task.stop();
        console.log(`[CRON-MANAGER] ⏹️ Stopped task: ${taskName}`);
      } catch (error) {
        console.error(`[CRON-MANAGER] ❌ Failed to stop task ${taskName}:`, error);
      }
    }
    
    this.tasks.clear();
    console.log('[CRON-MANAGER] ✅ All tasks stopped');
  }

  getAvailableTaskNames(): string[] {
    return Array.from(this.taskConfigs.keys());
  }
}

// Export singleton instance
export const cronManager = new CronManager();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('[CRON-MANAGER] Received SIGTERM, stopping all tasks...');
  await cronManager.stopAllTasks();
});

process.on('SIGINT', async () => {
  console.log('[CRON-MANAGER] Received SIGINT, stopping all tasks...');
  await cronManager.stopAllTasks();
});