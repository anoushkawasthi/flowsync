import * as React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warn';
}

/**
 * Alerts are pastel-filled slabs rather than the usual translucent tint. A 10%
 * red wash over a dark surface is invisible on paper and muddy on a pastel, so
 * the state is carried by a full flat fill plus the hard border instead.
 */
const variantClass: Record<NonNullable<AlertProps['variant']>, string> = {
  default: 'bg-surface text-ink',
  destructive: 'bg-danger-fill text-on-pastel',
  warn: 'bg-warn-fill text-on-pastel',
};

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'neo relative w-full rounded-card p-4 shadow-neo-1',
        '[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7',
        variantClass[variant],
        className
      )}
      {...props}
    >
      {variant === 'default' ? (
        <Info className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4" />
      )}
      {children}
    </div>
  )
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-extrabold leading-none tracking-[-0.01em]', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
