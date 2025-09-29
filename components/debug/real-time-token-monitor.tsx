import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Coins, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  TrendingDown, 
  TrendingUp,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-context';

interface TokenUsageData {
  channelId: string;
  totalAmount: number;
  consumedTokens: number;
  remainingTokens: number;
  lastUpdated: string;
}

interface ApiCallRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  tokensConsumed: number;
  status: 'success' | 'failed' | 'pending';
  transactionHash?: string;
  details?: Record<string, unknown>;
}

interface RealTimeTokenMonitorProps {
  className?: string;
}

export const RealTimeTokenMonitor: React.FC<RealTimeTokenMonitorProps> = ({ 
  className = '' 
}) => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [tokenData, setTokenData] = useState<TokenUsageData | null>(null);
  const [apiCalls, setApiCalls] = useState<ApiCallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCall, setSelectedCall] = useState<ApiCallRecord | null>(null);

  // Fetch current token usage
  const fetchTokenUsage = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/debug/payment-status');
      if (response.ok) {
        const data = await response.json();
        const debug = data.debug;
        
        setTokenData({
          channelId: debug.channelId,
          totalAmount: debug.channelAmount,
          consumedTokens: debug.consumedTokens,
          remainingTokens: debug.remainingTokens,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to fetch token usage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Add new API call record
  const addApiCall = useCallback((callData: {
    endpoint: string;
    tokensConsumed: number;
    status: 'success' | 'failed' | 'pending';
    transactionHash?: string;
    details?: Record<string, unknown>;
  }) => {
    const newCall: ApiCallRecord = {
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...callData
    };
    
    setApiCalls(prev => [newCall, ...prev.slice(0, 9)]); // Keep last 10 calls
    
    // Auto-refresh token data after API call
    setTimeout(fetchTokenUsage, 500);
  }, [fetchTokenUsage]);

  // Listen for chat API calls
  useEffect(() => {
    if (!user) return;

    // Monitor fetch requests to chat API
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [input, init] = args;
      const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
      
      // Track chat API calls
      if (url.includes('/api/chat')) {
        const startTime = Date.now();
        
        try {
          const response = await originalFetch(...args);
          const responseClone = response.clone();
          
          // Track successful chat calls
          addApiCall({
            endpoint: 'POST /api/chat',
            tokensConsumed: 0, // Will be updated via streaming
            status: response.ok ? 'success' : 'failed',
            details: {
              duration: Date.now() - startTime,
              statusCode: response.status
            }
          });
          
          return response;
        } catch (error) {
          addApiCall({
            endpoint: 'POST /api/chat',
            tokensConsumed: 0,
            status: 'failed',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
          throw error;
        }
      }
      
      // Track pay-enhanced API calls
      if (url.includes('/api/chunks/pay-enhanced')) {
        const startTime = Date.now();
        
        try {
          const response = await originalFetch(...args);
          const responseData = await response.clone().json();
          
          addApiCall({
            endpoint: 'POST /api/chunks/pay-enhanced',
            tokensConsumed: responseData.data?.paidTokens || 0,
            status: response.ok ? 'success' : 'failed',
            transactionHash: responseData.data?.transactionHash,
            details: {
              duration: Date.now() - startTime,
              statusCode: response.status,
              paidTokens: responseData.data?.paidTokens,
              chunkId: responseData.data?.chunkId
            }
          });
          
          return response;
        } catch (error) {
          addApiCall({
            endpoint: 'POST /api/chunks/pay-enhanced',
            tokensConsumed: 0,
            status: 'failed',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
          throw error;
        }
      }
      
      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [user, addApiCall]);

  // Auto-refresh token data
  useEffect(() => {
    if (user && isVisible) {
      fetchTokenUsage();
      const interval = setInterval(fetchTokenUsage, 3000); // Refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [user, isVisible, fetchTokenUsage]);

  // Update token consumption from streaming data
  useEffect(() => {
    const handleStreamingData = (event: CustomEvent) => {
      const { chunkId, tokens, cumulativePayment, remainingBalance } = event.detail;
      
      // Update token data from streaming
      if (tokenData) {
        setTokenData(prev => prev ? {
          ...prev,
          consumedTokens: cumulativePayment,
          remainingTokens: remainingBalance,
          lastUpdated: new Date().toISOString()
        } : null);
      }
      
      // Update the latest chat API call with token info
      setApiCalls(prev => {
        const updated = [...prev];
        const latestChatCall = updated.find(call => 
          call.endpoint === 'POST /api/chat' && 
          call.tokensConsumed === 0
        );
        
        if (latestChatCall) {
          latestChatCall.tokensConsumed += tokens;
          latestChatCall.details = {
            ...latestChatCall.details,
            chunkId,
            totalTokensFromStream: latestChatCall.tokensConsumed
          };
        }
        
        return updated;
      });
    };

    window.addEventListener('tokenStreamUpdate', handleStreamingData as EventListener);
    return () => {
      window.removeEventListener('tokenStreamUpdate', handleStreamingData as EventListener);
    };
  }, [tokenData]);

  if (!user || !isVisible) {
    return null;
  }

  const usagePercentage = tokenData ? 
    Math.min((tokenData.consumedTokens / tokenData.totalAmount) * 100, 100) : 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Token Monitor - Similar to Simulate Chunk style */}
      <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">Real-time Token Monitor</span>
            </div>
            
            {tokenData && (
              <div className="flex items-center gap-4 text-xs text-green-600 dark:text-green-400">
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  <span>Used: {tokenData.consumedTokens.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  <span>Remaining: {tokenData.remainingTokens.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`inline-flex h-2 w-2 rounded-full ${
                    usagePercentage > 90 ? 'bg-red-500' : 
                    usagePercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <span>{usagePercentage.toFixed(1)}% used</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchTokenUsage}
              size="sm"
              variant="outline"
              disabled={isLoading}
              className="h-6 px-2 text-xs"
            >
              {isLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </Button>
            
            <Button
              onClick={() => setShowDetails(!showDetails)}
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Details
            </Button>
            
            <Button
              onClick={() => setIsVisible(false)}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
            >
              <EyeOff className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Usage Progress Bar */}
        {tokenData && (
          <div className="mt-2 w-full bg-green-100 dark:bg-green-900/40 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                usagePercentage > 90 ? 'bg-red-500' : 
                usagePercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* API Calls List */}
      {showDetails && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">API Calls ({apiCalls.length})</span>
            </div>
          </div>
          
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {apiCalls.length === 0 ? (
              <div className="text-xs text-blue-600 dark:text-blue-400 text-center py-2">
                No API calls yet
              </div>
            ) : (
              apiCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded px-2 py-1 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => setSelectedCall(selectedCall?.id === call.id ? null : call)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge 
                      variant={call.status === 'success' ? 'default' : 
                               call.status === 'failed' ? 'destructive' : 'secondary'}
                      className="text-xs px-1 py-0"
                    >
                      {call.status}
                    </Badge>
                    
                    <span className="font-mono text-xs truncate">
                      {call.endpoint}
                    </span>
                    
                    {call.tokensConsumed > 0 && (
                      <span className="text-green-600 dark:text-green-400">
                        {call.tokensConsumed} tokens
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(call.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Transaction Details Modal */}
          {selectedCall && (
            <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Transaction Details</span>
                <Button
                  onClick={() => setSelectedCall(null)}
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0"
                >
                  ×
                </Button>
              </div>
              <pre className="text-xs text-muted-foreground overflow-auto max-h-32">
                {JSON.stringify(selectedCall, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Minimized Toggle */}
      {!isVisible && (
        <Button
          onClick={() => setIsVisible(true)}
          size="sm"
          variant="outline"
          className="fixed bottom-4 right-4 h-8 px-3 text-xs z-50"
        >
          <Eye className="h-3 w-3 mr-1" />
          Show Token Monitor
        </Button>
      )}
    </div>
  );
};