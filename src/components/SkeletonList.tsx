'use client';

import { cn } from '@/lib/utils';

interface SkeletonListProps {
  count?: number;
  className?: string;
}

export function SkeletonList({ count = 5, className }: SkeletonListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center p-4 bg-surface rounded-lg"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Category dot */}
          <div className="w-3 h-3 rounded-full skeleton mr-3" />

          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 skeleton rounded" />
            <div className="h-3 w-40 skeleton rounded" />
          </div>

          {/* Amount and date */}
          <div className="text-right space-y-2">
            <div className="h-4 w-16 skeleton rounded ml-auto" />
            <div className="h-3 w-12 skeleton rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="p-6 bg-surface rounded-xl space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-5 w-32 skeleton rounded" />
        <div className="h-5 w-20 skeleton rounded" />
      </div>
      <div className="h-4 w-full skeleton rounded" />
      <div className="h-4 w-3/4 skeleton rounded" />
    </div>
  );
}
