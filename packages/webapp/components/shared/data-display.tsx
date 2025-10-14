import React, { useState } from "react";
import { Copy, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsonStr } from "@/lib/shared/ckb";

interface DataDisplayProps {
  title: string;
  subtitle?: string; // Optional subtitle for additional context
  data: unknown;
  className?: string;
}

export const DataDisplay: React.FC<DataDisplayProps> = ({
  title,
  subtitle,
  data,
  className = "",
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Determine if data is JSON (object) or plain text (string)
  const isJsonData = typeof data !== "string";
  
  // Format the data - if it's already a string, display as-is, otherwise use jsonStr
  const displayData = isJsonData 
    ? jsonStr(data, null, 2)
    : data as string;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayData);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = () => {
    if (!isJsonData) return; // Only allow download for JSON data
    
    const blob = new Blob([displayData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`mb-2 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1">
          <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {title}
          </h4>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Copy to clipboard"
          >
            {copySuccess ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            )}
          </Button>
          {isJsonData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Download as JSON file"
            >
              <Download className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </Button>
          )}
        </div>
      </div>
      <pre className="text-xs bg-slate-100 dark:bg-slate-700 p-3 rounded whitespace-pre-wrap break-all border border-slate-200 dark:border-slate-600">
        {displayData}
      </pre>
    </div>
  );
};