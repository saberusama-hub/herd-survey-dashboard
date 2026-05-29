import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-medium uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-accent-muted/60 text-accent',
        outline: 'border border-border text-text-secondary',
        positive: 'bg-positive/10 text-positive',
        negative: 'bg-negative/10 text-negative',
        warning: 'bg-warning/10 text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
