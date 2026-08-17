import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * `tone` picks the card's fill. A pastel card is an identity signal — it says
 * "this belongs to Analytics" — so it also flips the text to --on-pastel,
 * which does not change between themes. Default cards stay on --surface.
 */
type CardTone =
  | 'surface'
  | 'dashboard'
  | 'timeline'
  | 'analytics'
  | 'chat'
  | 'risk'
  | 'search'
  | 'neutral';

const toneClass: Record<CardTone, string> = {
  surface: 'bg-surface text-ink',
  dashboard: 'bg-pastel-dashboard text-on-pastel',
  timeline: 'bg-pastel-timeline text-on-pastel',
  analytics: 'bg-pastel-analytics text-on-pastel',
  chat: 'bg-pastel-chat text-on-pastel',
  risk: 'bg-pastel-risk text-on-pastel',
  search: 'bg-pastel-search text-on-pastel',
  neutral: 'bg-pastel-neutral text-on-pastel',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  /** Drop the hard shadow — for cards nested inside another bordered slab. */
  flat?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone = 'surface', flat = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'neo rounded-card',
        toneClass[tone],
        !flat && 'shadow-neo-2',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 p-5', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-xl font-extrabold leading-tight tracking-[-0.02em]', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-ink-muted', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export type { CardTone };
