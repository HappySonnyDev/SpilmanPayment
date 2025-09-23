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
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/components/auth/auth-context";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export const Assistant = () => {
  const { user, logout } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authDialogTab, setAuthDialogTab] = useState<'login' | 'register'>('login');
  const [pendingMessage, setPendingMessage] = useState('');

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  const handleAuthRequired = () => {
    setAuthDialogTab('login');
    setShowAuthDialog(true);
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
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink
                        href="https://www.assistant-ui.com/docs/getting-started"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        AI Assistant
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Chat</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                
                {/* Auth Section - Right side */}
                <div className="ml-auto">
                  {user ? (
                    // User is logged in - show user info and logout
                    <div className="flex items-center space-x-4 bg-white rounded-lg px-4 py-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-sm font-medium text-gray-900">{user.username}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={logout}
                        className="text-xs"
                      >
                        退出
                      </Button>
                    </div>
                  ) : (
                    // User not logged in - show login button
                    <Button 
                      onClick={() => {
                        setAuthDialogTab('login');
                        setShowAuthDialog(true);
                      }}
                      size="sm"
                    >
                      登录
                    </Button>
                  )}
                </div>
              </header>
              <div className="flex-1 overflow-hidden">
                <ThreadWithCustomComposer 
                  onAuthRequired={handleAuthRequired}
                  pendingMessage={pendingMessage}
                  setPendingMessage={setPendingMessage}
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
        defaultTab={authDialogTab}
      />
    </>
  );
};
