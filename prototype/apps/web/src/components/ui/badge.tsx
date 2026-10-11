import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface-2 text-muted',
        accent: 'border-transparent bg-accent-bg text-accent-text',
        warn: 'border-transparent bg-warn-bg text-warn',
        danger: 'border-transparent bg-danger-bg text-danger',
        success: 'border-transparent bg-success-bg text-success',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
