'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { portal?: boolean }
>(({ className, align = 'center', sideOffset = 4, portal = true, ...props }, ref) => {
  const content = (
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-2xl p-4 text-text-primary outline-none glass-dropdown',
        'bg-[var(--glass-bg-heavy)] backdrop-blur-[40px] backdrop-saturate-[180%] border border-[var(--glass-border)] shadow-elevated',
        className
      )}
      {...props}
    />
  );

  if (!portal) return content;
  return <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>;
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
