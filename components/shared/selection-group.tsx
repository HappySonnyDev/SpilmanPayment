"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface SelectionOption<T = string | number> {
  value: T;
  label: string;
}

interface SelectionGroupProps<T = string | number> {
  title: string;
  options: SelectionOption<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
}

export function SelectionGroup<T = string | number>({
  title,
  options,
  selectedValue,
  onValueChange,
  className = "",
  buttonClassName = "",
}: SelectionGroupProps<T>) {
  return (
    <div className={`mb-8 ${className}`}>
      <h4 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </h4>
      <div className="flex gap-4">
        {options.map((option) => (
          <Button
            key={String(option.value)}
            variant={selectedValue === option.value ? "default" : "outline"}
            className={`min-w-[120px] ${buttonClassName}`}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}