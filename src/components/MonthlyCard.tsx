'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { CategoryBreakdown } from '@/types';
import { formatCurrency, formatMonthYear, cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

interface MonthlyCardProps {
  month: string;
  total: number;
  breakdown: CategoryBreakdown[];
  onClick: () => void;
  className?: string;
}

export function MonthlyCard({
  month,
  total,
  breakdown,
  onClick,
  className,
}: MonthlyCardProps) {
  const { settings } = useSettings();
  const topCategories = breakdown.slice(0, 4);

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full text-left p-5 glass-card hover:shadow-elevated transition-shadow',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">
          {formatMonthYear(month)}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-text-primary font-mono">
            {formatCurrency(total, settings.currency)}
          </span>
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </div>
      </div>

      {/* Category breakdown bar */}
      {topCategories.length > 0 && (
        <>
          <div className="flex h-2 rounded-full overflow-hidden mb-3">
            {topCategories.map((cat, index) => (
              <div
                key={cat.categoryId}
                style={{
                  backgroundColor: cat.color,
                  width: `${cat.percentage}%`,
                }}
                className={cn(
                  'h-full transition-all',
                  index === 0 && 'rounded-l-full',
                  index === topCategories.length - 1 && 'rounded-r-full'
                )}
              />
            ))}
          </div>

          {/* Category labels */}
          <div className="flex flex-wrap gap-3">
            {topCategories.map((cat) => (
              <div key={cat.categoryId} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs text-text-secondary">
                  {cat.categoryName}
                </span>
                <span className="text-xs text-text-muted font-mono">
                  {formatCurrency(cat.total, settings.currency)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {topCategories.length === 0 && (
        <p className="text-sm text-text-muted">No expenses recorded</p>
      )}
    </motion.button>
  );
}
