import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Focus is handled by the global :focus-visible ring in globals.css rather than
 * a component-local ring, so every focusable thing in the app lands in the same
 * place. The old version hardcoded `ring-teal-500` here instead of using the
 * theme's own ring token, which is how the teal leaked into the primitives.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'neo flex h-10 w-full rounded-chip bg-surface px-3 py-2 text-sm text-ink',
          'placeholder:text-ink-subtle',
          'file:border-0 file:bg-transparent file:text-sm file:font-bold',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
