import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const inputBase =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-offset-slate-900 dark:placeholder:text-slate-500 dark:focus-visible:ring-blue-400";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, value, ...props }, ref) => {
    if (type === "file") {
      return (
        <input
          type="file"
          className={cn(inputBase, className)}
          ref={ref}
          onChange={onChange}
          {...props}
        />
      );
    }

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      target.setAttribute("value", target.value);
      e.target.value = target.value;
      onChange?.(e);
    };

    return (
      <input
        type={type}
        className={cn(inputBase, className)}
        ref={ref}
        value={value}
        onChange={handleInput}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
