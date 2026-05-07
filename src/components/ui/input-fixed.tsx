import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, onInput, value, ...props }, ref) => {
    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Forzar sincronización entre DOM y React
      e.target.setAttribute('value', e.target.value);
      e.target.value = e.target.value;
      onChange?.(e);
    };

    const handleInputEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Handler adicional para eventos de automation
      const target = e.target as HTMLInputElement;
      target.setAttribute('value', target.value);
      onInput?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        value={value}
        onChange={handleInput}
        onInput={handleInputEvent}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
