'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

/** Square track, square thumb, hard border. A pill switch reads as iOS chrome. */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'neo peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-[6px] p-0.5',
      'transition-colors duration-micro ease-neo',
      'data-[state=checked]:bg-accent data-[state=unchecked]:bg-pastel-neutral',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-[3px] border-thin border-line bg-surface',
        'transition-transform duration-hover ease-neo',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
