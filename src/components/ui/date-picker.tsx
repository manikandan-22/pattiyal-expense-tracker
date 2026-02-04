'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DatePickerProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Parse ISO date to Date object
  const date = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  // Format date for display
  const displayValue = date ? format(date, 'MMM d, yyyy') : 'Pick a date';

  // Handle calendar selection
  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange(format(selectedDate, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  // Mobile: use native date input
  if (isMobile) {
    return (
      <div className={cn('relative', className)}>
        <div className="relative">
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 px-3 pr-10 bg-surface border border-border rounded-lg text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          />
          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        </div>
        {date && (
          <p className="text-xs text-text-muted mt-1">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </p>
        )}
      </div>
    );
  }

  // Desktop: use popover calendar
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal h-10',
            !date && 'text-text-muted',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
