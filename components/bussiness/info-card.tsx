"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

interface InfoItem {
  label: string;
  value: string | React.ReactNode;
  className?: string;
}

interface InfoCardProps {
  title?: string;
  items: InfoItem[];
  className?: string;
}

export function InfoCard({ title, items, className = "" }: InfoCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (value: string | React.ReactNode, index: number) => {
    try {
      // Extract text content from React nodes
      let textToCopy = '';
      
      if (typeof value === 'string') {
        textToCopy = value;
      } else if (React.isValidElement(value)) {
        // For React elements, extract text from the element
        const props = value.props as { children?: React.ReactNode };
        if (typeof props.children === 'string') {
          textToCopy = props.children;
        } else if (Array.isArray(props.children)) {
          textToCopy = props.children
            .filter((child): child is string => typeof child === 'string')
            .join('');
        } else {
          textToCopy = String(props.children || '');
        }
      } else {
        textToCopy = String(value || '');
      }
      
      await navigator.clipboard.writeText(textToCopy);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };
  return (
    <Tooltip.Provider>
      <div className={`space-y-6 ${className}`}>
        {title && <h3 className="mb-6 text-lg font-semibold">{title}</h3>}
        <div className="rounded-lg border border-gray-100/30 bg-slate-50/50 shadow-sm dark:border-slate-700/40 dark:bg-slate-800">
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <div className="group relative flex items-center justify-between px-5 py-6 hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {item.label}
                </label>
                <div className={`text-sm font-semibold text-slate-700 dark:text-slate-300 ${item.className || ""}`}>
                  {item.value}
                </div>
                
                {/* Copy Button */}
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => handleCopy(item.value, index)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-gray-200/70 dark:hover:bg-slate-600/70 cursor-pointer"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
                      sideOffset={5}
                    >
                      {copiedIndex === index ? 'Copied!' : 'Copy'}
                      <Tooltip.Arrow className="fill-primary" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
              {index < items.length - 1 && (
                <div className="border-t border-gray-200/70 dark:border-slate-700/60" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Tooltip.Provider>
  );
}