import React from "react";

interface PaymentSummaryProps {
  amount: number;
  duration: number;
  showRate?: boolean;
  className?: string;
}

// Calculate tokens based on pricing: 1 CKB = 0.01 Token
const calculateTokens = (ckbAmount: number) => {
  return ckbAmount * 0.01;
};

export const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  amount,
  duration,
  showRate = true,
  className = "",
}) => {
  const tokenAmount = calculateTokens(amount);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="grid grid-cols-3 gap-6 text-center">
        <div className="space-y-2">
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {amount}
          </div>
          <div className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
            CKB
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {tokenAmount.toLocaleString()}
          </div>
          <div className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
            Tokens
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">
            {duration >= 86400
              ? Math.floor(duration / 86400)
              : `${duration}s`}
          </div>
          <div className="text-sm font-medium tracking-wider text-slate-600 uppercase dark:text-slate-400">
            {duration >= 86400
              ? Math.floor(duration / 86400) > 1
                ? "Days"
                : "Day"
              : "Seconds"}
          </div>
        </div>
      </div>
      {showRate && (
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Rate:{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              1 CKB = 0.01 Token
            </span>
          </p>
        </div>
      )}
    </div>
  );
};