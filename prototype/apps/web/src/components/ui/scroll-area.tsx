import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';

export function ScrollArea({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex touch-none p-0.5 transition-colors select-none data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border-strong" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
