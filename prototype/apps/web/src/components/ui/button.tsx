import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-on-accent hover:opacity-95',
        secondary: 'border border-border bg-surface-2 text-text hover:border-border-strong',
        ghost: 'text-muted hover:bg-surface-2 hover:text-text',
        outline: 'border border-border bg-transparent text-text hover:bg-surface-2',
        danger: 'bg-danger-bg text-danger hover:opacity-95',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-13',
        lg: 'h-12 px-5',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
