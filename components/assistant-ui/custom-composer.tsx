"use client";

import React, { useState, useEffect } from 'react';
import { ThreadPrimitive, useAssistantRuntime } from "@assistant-ui/react";
import { ArrowUpIcon, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ComposerAddAttachment, ComposerAttachments } from "@/components/assistant-ui/attachment";
import { useAuth } from '@/app/context/auth-context';
import * as m from "motion/react-m";

interface CustomComposerProps {
  onAuthRequired: () => void;
  pendingMessage: string;
  setPendingMessage: (message: string) => void;
  onCancelGeneration?: () => void;
}

const ThreadScrollToBottom: React.FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowUpIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

export const CustomComposer: React.FC<CustomComposerProps> = ({ 
  onAuthRequired, 
  pendingMessage, 
  setPendingMessage,
  onCancelGeneration,
}) => {
  const { user } = useAuth();
  const runtime = useAssistantRuntime();
  const [inputValue, setInputValue] = useState(pendingMessage);

  // Sync input value with pending message
  useEffect(() => {
    setInputValue(pendingMessage);
  }, [pendingMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;

    if (!user) {
      // User not authenticated, save message and show auth dialog
      setPendingMessage(inputValue);
      onAuthRequired();
      return;
    }

    // User authenticated, submit the message
    const messageContent = [{ type: "text" as const, text: inputValue }];
    
    // Clear input after successful submission
    setInputValue('');
    setPendingMessage('');
    
    // Dispatch a custom event that the main component will listen to
    const event = new CustomEvent('send-message', {
      detail: { message: inputValue }
    });
    window.dispatchEvent(event);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
      <ThreadScrollToBottom />
      <ThreadPrimitive.Empty>
        <div className="aui-thread-welcome-suggestions grid w-full gap-2 @md:grid-cols-2">
          {[
            {
              title: "What's the weather",
              label: "in San Francisco?",
              action: "What's the weather in San Francisco?",
            },
            {
              title: "Explain React hooks",
              label: "like useState and useEffect",
              action: "Explain React hooks like useState and useEffect",
            },
            {
              title: "Write a SQL query",
              label: "to find top customers",
              action: "Write a SQL query to find top customers",
            },
            {
              title: "Create a meal plan",
              label: "for healthy weight loss",
              action: "Create a meal plan for healthy weight loss",
            },
          ].map((suggestedAction, index) => (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.05 * index }}
              key={`suggested-action-${suggestedAction.title}-${index}`}
              className="aui-thread-welcome-suggestion-display [&:nth-child(n+3)]:hidden @md:[&:nth-child(n+3)]:block"
            >
              <Button
                variant="ghost"
                onClick={() => {
                  if (!user) {
                    setPendingMessage(suggestedAction.action);
                    onAuthRequired();
                    return;
                  }
                  // 直接发送消息，不填入输入框
                  const event = new CustomEvent('send-message', {
                    detail: { message: suggestedAction.action }
                  });
                  window.dispatchEvent(event);
                }}
                className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm @md:flex-col dark:hover:bg-accent/60"
                aria-label={suggestedAction.action}
              >
                <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                  {suggestedAction.title}
                </span>
                <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                  {suggestedAction.label}
                </span>
              </Button>
            </m.div>
          ))}
        </div>
      </ThreadPrimitive.Empty>
      
      <form onSubmit={handleSubmit}>
        <div className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
          <ComposerAttachments />
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
            rows={1}
            autoFocus
            aria-label="Message input"
          />
          
          <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
            <ComposerAddAttachment />

            <ThreadPrimitive.If running={false}>
              <TooltipIconButton
                tooltip="Send message"
                side="bottom"
                type="submit"
                variant="default"
                size="icon"
                className="aui-composer-send size-[34px] rounded-full p-1"
                aria-label="Send message"
                disabled={!inputValue.trim()}
              >
                <ArrowUpIcon className="aui-composer-send-icon size-5" />
              </TooltipIconButton>
            </ThreadPrimitive.If>

            <ThreadPrimitive.If running>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
                aria-label="Stop generating"
                onClick={() => {
                  console.log('Stop button clicked');
                  if (onCancelGeneration) {
                    onCancelGeneration();
                  }
                }}
              >
                <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
              </Button>
            </ThreadPrimitive.If>
          </div>
        </div>
      </form>
    </div>
  );
};