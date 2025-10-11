"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { ThreadWithCustomComposer } from "@/components/assistant-ui/thread-with-custom-composer";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import {
  Breadcrumb,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/app/context/auth-context";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { UserSettingsDialog } from "@/components/ui/user-settings-dialog";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/bussiness/user-dropdown";
import { useChunkPayment } from "@/hooks/use-chunk-payment";

export const Assistant = () => {
  const { user, logout } = useAuth();
  const { payForChunk } = useChunkPayment();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [userSettingsTab, setUserSettingsTab] = useState<'profile' | 'usage' | 'billing' | 'recharge'>('profile');

  // Handle chunk payment data from streaming response
  const handleChunkPaymentData = async (dataPart: { type: `data-${string}`; id?: string; data: unknown }) => {
    console.log('🎯 Received chunk payment data:', dataPart);
    
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
      
      console.log(`📦 Processing chunk payment: ${chunkId} (${tokens} tokens)`);
      console.log(`💰 Payment Channel Status:`);
      console.log(`   - Channel ID: ${channelId}`);
      console.log(`   - Total Amount: ${channelTotalAmount} CKB`);
      console.log(`   - Cumulative Payment: ${cumulativePayment} CKB`);
      console.log(`   - Remaining Balance: ${remainingBalance} CKB`);
      
      // Emit custom event for RealTimeTokenMonitor
      const tokenUpdateEvent = new CustomEvent('tokenStreamUpdate', {
        detail: {
          chunkId,
          tokens,
          cumulativePayment,
          remainingBalance,
          channelId,
          channelTotalAmount
        }
      });
      window.dispatchEvent(tokenUpdateEvent);
      
      try {
        console.log(`🔄 Attempting automatic payment for chunk: ${chunkId}`);
        // Automatically pay for the chunk with enhanced payment info
        const paymentResult = await payForChunk(chunkId, {
          cumulativePayment,
          remainingBalance,
          channelId,
          tokens
        });
        console.log(`✅ Successfully paid for chunk: ${chunkId}`);
        
        // Emit payment success event for the composer to update payment records
        const paymentSuccessEvent = new CustomEvent('chunkPaymentSuccess', {
          detail: {
            chunkId,
            tokens,
            paidAmount: cumulativePayment,
            remainingAmount: remainingBalance,
            timestamp: new Date().toISOString(),
            transactionData: paymentResult.transactionData
          }
        });
        window.dispatchEvent(paymentSuccessEvent);
        
      } catch (error) {
        console.error(`❌ Failed to pay for chunk ${chunkId}:`, error);
        // Let's try the simpler payment method as fallback
        try {
          console.log(`🔄 Trying fallback payment for chunk: ${chunkId}`);
          const fallbackResult = await payForChunk(chunkId);
          console.log(`✅ Fallback payment successful for chunk: ${chunkId}`);
          
          // Emit payment success event for fallback payment too
          const paymentSuccessEvent = new CustomEvent('chunkPaymentSuccess', {
            detail: {
              chunkId,
              tokens,
              paidAmount: cumulativePayment,
              remainingAmount: remainingBalance,
              timestamp: new Date().toISOString(),
              transactionData: fallbackResult.transactionData
            }
          });
          window.dispatchEvent(paymentSuccessEvent);
          
        } catch (fallbackError) {
          console.error(`❌ Fallback payment also failed for chunk ${chunkId}:`, fallbackError);
        }
      }
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
