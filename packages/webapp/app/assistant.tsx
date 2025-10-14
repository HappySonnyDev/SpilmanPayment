"use client";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { ThreadWithCustomComposer } from "@/features/assistant/components/thread-with-custom-composer";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/features/assistant/components/threadlist-sidebar";
import { useAuth } from "@/features/auth/components/auth-context";
import { AuthDialog } from "@/features/auth/components/auth-dialog";
import { UserSettingsDialog } from "@/features/settings/components/user-settings-dialog";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/shared/user-dropdown";

export const Assistant = () => {
  const { user, logout } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [userSettingsTab, setUserSettingsTab] = useState<'profile' | 'usage' | 'billing' | 'recharge'>('profile');

  // Handle chunk payment data from streaming response
  const handleChunkPaymentData = async (dataPart: { type: `data-${string}`; id?: string; data: unknown }) => {
    
    if (dataPart.type === 'data-chunk-payment') {
      const data = dataPart.data as { 
        chunkId: string; 
        tokens: number; 
        sessionId: string; 
        isPaid: boolean;
        cumulativePayment: number;
        remainingBalance: number;
        channelId: string;
        channelTotalAmount: number;
      };
      const { chunkId, tokens, cumulativePayment, remainingBalance, channelId, channelTotalAmount } = data;
      
      // Emit consolidated event for chunk-aware-composer and token monitor
      const chunkPaymentUpdateEvent = new CustomEvent('chunkPaymentUpdate', {
        detail: {
          chunkId,
          tokens,
          timestamp: new Date().toISOString(),
          cumulativePayment,
          remainingBalance,
          channelId,
          channelTotalAmount,
          isArrival: true
        }
      });
      window.dispatchEvent(chunkPaymentUpdateEvent);
      
    }
  };

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat"
    }),
    onData: handleChunkPaymentData
  });

  const handleAuthRequired = () => {
    setShowAuthDialog(true);
  };

  const handleUserMenuClick = (tab: 'profile' | 'usage' | 'billing' | 'recharge') => {
    setUserSettingsTab(tab);
    setShowUserSettings(true);
  };

  // Generate new session ID for each new question
  const generateNewSessionId = () => {
    // Session ID is now generated on the server side
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Submit pending message after authentication
  useEffect(() => {
    if (user && pendingMessage && !showAuthDialog) {
      if (pendingMessage.trim()) {
        // Use the thread runtime to directly append and send the pending message
        const threadRuntime = runtime.thread;
        threadRuntime.append({
          role: "user",
          content: [{ type: "text", text: pendingMessage.trim() }],
        });
        setPendingMessage(''); // Clear pending message immediately
      }
    }
  }, [user, pendingMessage, showAuthDialog, runtime]);

  return (
    <>
      <AssistantRuntimeProvider runtime={runtime}>
        <SidebarProvider>
          <div className="flex h-dvh w-full pr-0.5">
            <ThreadListSidebar />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger />
                {/* Auth Section - Right side */}
                <div className="ml-auto">
                  {user ? (
                    // User is logged in - show user dropdown menu
                    <UserDropdown 
                      user={user}
                      onMenuClick={handleUserMenuClick}
                      onLogout={logout}
                    />
                  ) : (
                    // User not logged in - show login button
                    <Button 
                      onClick={() => {
                        setShowAuthDialog(true);
                      }}
                      size="sm"
                    >
                      Sign in
                    </Button>
                  )}
                </div>
              </header>
              <div className="flex-1 overflow-hidden relative">
                <ThreadWithCustomComposer 
                  onAuthRequired={handleAuthRequired}
                  pendingMessage={pendingMessage}
                  setPendingMessage={setPendingMessage}
                  onNewQuestion={generateNewSessionId}
                  onOpenSettings={handleUserMenuClick}
                />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </AssistantRuntimeProvider>

      {/* Auth Dialog */}
      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
      />
      
      {/* User Settings Dialog */}
      <UserSettingsDialog
        open={showUserSettings}
        onOpenChange={setShowUserSettings}
        defaultTab={userSettingsTab}
      />
    </>
  );
};
