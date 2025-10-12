"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDbTimeToLocal } from "@/lib/shared/date-utils";

// Simple Card components
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card = ({ children, className = "" }: CardProps) => (
  <div
    className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
  >
    {children}
  </div>
);

const CardHeader = ({ children, className = "" }: CardProps) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const CardContent = ({ children, className = "" }: CardProps) => (
  <div className={`px-6 pb-6 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = "" }: CardProps) => (
  <h3 className={`leading-none font-semibold tracking-tight ${className}`}>
    {children}
  </h3>
);

const CardDescription = ({ children, className = "" }: CardProps) => (
  <p className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
    {children}
  </p>
);

// Simple Switch component
interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Switch = ({
  checked,
  onCheckedChange,
  disabled = false,
}: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

interface TaskStatus {
  name: string;
  description: string;
  schedule: string;
  running: boolean;
  lastRun?: string;
  nextRun?: string;
  status: "active" | "stopped" | "error";
  actualLastRun?: string; // From task logs
  executionCount?: number; // Total executions
  successRate?: number; // Success percentage
}

interface TaskLog {
  id: number;
  task_name: string;
  task_type: string;
  execution_status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  result_data: string | null;
  error_message: string | null;
  settled_count: number;
  checked_count: number;
  created_at: string;
}

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedTaskLogs, setSelectedTaskLogs] = useState<TaskLog[] | null>(
    null,
  );
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedTaskName, setSelectedTaskName] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const pageSize = 10; // Logs per page

  // Load task status on component mount
  useEffect(() => {
    loadTaskStatus();
  }, []);

  const loadTaskStatus = async () => {
    try {
      // Load task status
      const tasksResponse = await fetch("/api/admin/tasks");
      if (!tasksResponse.ok) {
        return;
      }

      const tasksData = await tasksResponse.json();

      // Load task logs for each task to get actual last run times
      const enrichedTasks = await Promise.all(
        tasksData.tasks.map(async (task: TaskStatus) => {
          try {
            const logsResponse = await fetch(
              `/api/admin/task-logs?taskName=${task.name}&limit=10`,
            );
            if (logsResponse.ok) {
              const logsData = await logsResponse.json();
              const logs = logsData.logs || [];
              const stats = logsData.stats || {};

              // Get the most recent successful execution
              const lastSuccessfulRun = logs.find(
                (log: TaskLog) => log.execution_status === "success",
              );

              return {
                ...task,
                actualLastRun:
                  lastSuccessfulRun?.completed_at ||
                  lastSuccessfulRun?.started_at,
                executionCount: stats.total || 0,
                successRate:
                  stats.total > 0
                    ? ((stats.success || 0) / stats.total) * 100
                    : 0,
              };
            }
          } catch (error) {
            // Silently handle log fetch errors
          }

          return task;
        }),
      );

      setTasks(enrichedTasks);
    } catch (error) {
      console.error("Error loading task status:", error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Update task status (start/stop)
  const updateTaskStatus = async (taskName: string, running: boolean) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskName,
          action: running ? "start" : "stop",
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Reload task status
        await loadTaskStatus();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to update task status");
      }
    } catch (error) {
      console.error("Failed to update task status:", error);
      alert(
        `Failed to ${running ? "start" : "stop"} task: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const runTaskManually = async (taskName: string) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskName,
          action: "execute",
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Reload task status
        await loadTaskStatus();

        alert(`Task executed successfully! ${result.message}`);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to execute task");
      }
    } catch (error) {
      console.error("Failed to run task manually:", error);
      alert(
        `Failed to execute task: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const viewTaskLogs = async (taskName: string, page: number = 1) => {
    setIsLoading(true);
    setSelectedTaskName(taskName);

    try {
      const response = await fetch(
        `/api/admin/task-logs?taskName=${taskName}&page=${page}&pageSize=${pageSize}`,
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedTaskLogs(data.logs || []);
        setCurrentPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setTotalLogs(data.total || 0);
        setShowLogsModal(true);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to load task logs");
      }
    } catch (error) {
      console.error("Failed to load task logs:", error);
      alert(
        `Failed to load logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && selectedTaskName) {
      await viewTaskLogs(selectedTaskName, newPage);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string, running: boolean) => {
    if (status === "error") {
      return <Badge variant="destructive">Error</Badge>;
    }
    if (running) {
      return (
        <Badge variant="default" className="bg-green-500">
          Running
        </Badge>
      );
    }
    return <Badge variant="secondary">Stopped</Badge>;
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "Never";
    return formatDbTimeToLocal(isoString, 'MMM DD, YYYY HH:mm:ss');
  };

  const getDisplayLastRun = (task: TaskStatus) => {
    // Prefer actual last run from logs over task manager's lastRun
    return task.actualLastRun || task.lastRun;
  };

  return (
    <div className="space-y-6">
      {/* Tasks List */}
      <div className="grid gap-6">
        {isInitialLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-lg text-gray-600 dark:text-gray-400">
              Loading payment channels...
            </div>
          </div>
        ) : //   <Card>
        //     <CardContent className="p-6">
        //       <div className="flex items-center justify-center py-8">
        //         <div className="flex items-center space-x-3">
        //           <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        //           <span className="text-gray-600 dark:text-gray-400">
        //             Loading scheduled tasks...
        //           </span>
        //         </div>
        //       </div>
        //     </CardContent>
        //   </Card>
        tasks.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
                    No Tasks Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    No scheduled tasks are currently configured.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        {task.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {task.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Schedule
                    </label>
                    <p className="mt-1 font-mono text-sm">{task.schedule}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Last Run (from logs)
                    </label>
                    <div className="mt-1">
                      <p className="text-sm">
                        {formatTime(getDisplayLastRun(task))}
                      </p>
                      {task.executionCount !== undefined && (
                        <p className="mt-1 text-xs text-gray-500">
                          {task.executionCount} executions •{" "}
                          {task.successRate?.toFixed(1)}% success
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Next Run
                    </label>
                    <p className="mt-1 text-sm">{formatTime(task.nextRun)}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </label>
                    <div className="mt-1">
                      {getStatusBadge(task.status, task.running)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={task.running}
                        onCheckedChange={(checked) =>
                          updateTaskStatus(task.name, checked)
                        }
                        disabled={isLoading}
                      />
                      <label className="text-sm font-medium">
                        {task.running ? "Running" : "Stopped"}
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewTaskLogs(task.name)}
                      disabled={isLoading}
                    >
                      <History className="mr-2 h-4 w-4" />
                      View Logs
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runTaskManually(task.name)}
                      disabled={isLoading}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Run Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Card */}
      {isInitialLoading ? (
        <div></div>
      ) : (
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold">
                <AlertCircle className="mr-2 h-5 w-5 text-blue-500" />
                Task Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  • <strong>Auto-settle Expiring:</strong> Monitors payment
                  channels and automatically settles those expiring within 15
                  minutes.
                </p>
                <p>
                  • <strong>Check Expired Channels:</strong> Checks active payment
                  channels every 10 minutes and marks expired ones as &quot;Expired&quot; status.
                </p>
                <p>
                  • <strong>Manual Execution:</strong> Use &quot;Run Now&quot;
                  to execute a task immediately for testing or immediate
                  settlement.
                </p>
                <p>
                  • <strong>Schedule:</strong> Tasks run automatically based on
                  their configured schedule when enabled.
                </p>
                <p>
                  • <strong>Timezone:</strong> All times are displayed in
                  Asia/Shanghai timezone (UTC+8).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Task Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 p-6 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Task Execution Logs: {selectedTaskName}
                  </h2>
                  {totalLogs > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      Showing {totalLogs} total executions
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowLogsModal(false);
                    setCurrentPage(1);
                    setSelectedTaskLogs(null);
                    setSelectedTaskName("");
                  }}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {selectedTaskLogs && selectedTaskLogs.length > 0 ? (
                <div className="space-y-4">
                  {selectedTaskLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`h-3 w-3 rounded-full ${
                              log.execution_status === "success"
                                ? "bg-green-500"
                                : log.execution_status === "failed"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                            }`}
                          />
                          <span className="font-medium capitalize">
                            {log.execution_status}
                          </span>
                          <span className="text-sm text-gray-500">
                            ID: {log.id}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatTime(log.started_at)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">
                            Duration:
                          </span>
                          <p>
                            {log.duration_ms !== null
                              ? `${log.duration_ms}ms`
                              : "N/A"}
                          </p>
                        </div>

                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">
                            Settled:
                          </span>
                          <p>{log.settled_count}</p>
                        </div>

                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">
                            Checked:
                          </span>
                          <p>{log.checked_count}</p>
                        </div>

                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">
                            Completed:
                          </span>
                          <p>
                            {log.completed_at
                              ? formatTime(log.completed_at)
                              : "Running..."}
                          </p>
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                          <span className="font-medium text-red-800 dark:text-red-200">
                            Error:
                          </span>
                          <p className="mt-1 text-red-700 dark:text-red-300">
                            {log.error_message}
                          </p>
                        </div>
                      )}

                      {log.result_data && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400">
                            View Result Data
                          </summary>
                          <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-900">
                            {JSON.stringify(
                              JSON.parse(log.result_data),
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  No execution logs found for this task.
                </div>
              )}
            </div>

            {/* Fixed Footer with Pagination */}
            {totalPages > 1 && (
              <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages} ({totalLogs} total)
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || isLoading}
                    >
                      Previous
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={
                                pageNum === currentPage ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              disabled={isLoading}
                              className="h-8 w-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        },
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || isLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
