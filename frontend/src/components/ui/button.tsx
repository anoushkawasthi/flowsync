import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Every solid variant carries `neo-lift`, which owns the hover/press physics:
 * hover raises the button 2px and grows the shadow by the same 2px so the
 * shadow's far corner stays pinned; active pushes it back down. Don't add
 * per-variant transforms — they fight that pairing.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-chip border-bw border-line text-sm font-bold tracking-[-0.01em] disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'neo-lift bg-accent text-accent-ink',
        destructive: 'neo-lift bg-danger-fill text-on-pastel',
        outline: 'neo-lift bg-surface text-ink',
        secondary: 'neo-lift bg-pastel-neutral text-on-pastel',
        // Ghost and link are the two intentionally chrome-less variants: they
        // sit inside already-bordered containers where another border and
        // shadow would read as a box inside a box.
        ghost:
          'border-transparent transition-colors duration-micro ease-neo hover:bg-pastel-neutral hover:text-on-pastel',
        link: 'border-transparent text-accent-text underline decoration-2 underline-offset-4',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-[0.8125rem]',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
