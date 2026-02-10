'use client';

import { motion } from 'framer-motion';
import { CategoryBreakdown } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

interface CategorySummaryProps {
  breakdown: CategoryBreakdown[];
  className?: string;
}

export function CategorySummary({ breakdown, className }: CategorySummaryProps) {
  const { settings } = useSettings();

  if (breakdown.length === 0) {
    return (
      <div className={cn('text-center py-8 text-text-muted', className)}>
        No expenses to show
      </div>
    );
  }

  const maxTotal = Math.max(...breakdown.map((b) => b.total));

  return (
    <div className={cn('space-y-3', className)}>
      {breakdown.map((item, index) => (
        <motion.div
          key={item.categoryId}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium text-text-primary">
                {item.categoryName}
              </span>
              <span className="text-xs text-text-muted">
                ({item.count} {item.count === 1 ? 'expense' : 'expenses'})
              </span>
            </div>
            <span className="text-sm font-semibold text-text-primary font-mono">
              {formatCurrency(item.total, settings.currency)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.total / maxTotal) * 100}%` }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </div>

          {/* Percentage */}
          <p className="text-xs text-text-muted text-right">
            {item.percentage.toFixed(1)}% of total
          </p>
        </motion.div>
      ))}
    </div>
  );
}
