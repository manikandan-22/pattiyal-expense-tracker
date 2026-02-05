'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Expense, Category } from '@/types';
import { ExpenseCard } from './ExpenseCard';
import { SkeletonList } from './SkeletonList';
import { cn, groupExpensesByDay } from '@/lib/utils';
import { listItemVariants, smoothSpring } from '@/lib/animations';

const PAGE_SIZE = 100;

interface ExpenseListProps {
  expenses: Expense[];
  categories: Category[];
  loading?: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function ExpenseList({
  expenses,
  categories,
  loading,
  onEdit,
  onDelete,
  className,
}: ExpenseListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Create category lookup map for O(1) access
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const getCategoryById = (id: string) => categoryMap.get(id);

  // Only render visible expenses, then group by day
  const visibleExpenses = useMemo(() => {
    return expenses.slice(0, visibleCount);
  }, [expenses, visibleCount]);

  const groupedExpenses = useMemo(() => {
    return groupExpensesByDay(visibleExpenses);
  }, [visibleExpenses]);

  const hasMore = expenses.length > visibleCount;
  const remainingCount = expenses.length - visibleCount;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  if (loading) {
    return <SkeletonList count={5} className={className} />;
  }

  if (expenses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'flex flex-col items-center justify-center py-16 text-center',
          className
        )}
      >
        <div className="w-16 h-16 mb-4 rounded-full bg-surface-hover flex items-center justify-center">
          <span className="text-3xl">💸</span>
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-1">
          No expenses yet
        </h3>
        <p className="text-sm text-text-secondary max-w-xs">
          Start tracking your spending by adding your first expense
        </p>
      </motion.div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groupedExpenses.map((group, groupIndex) => (
        <motion.div
          key={group.day}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...smoothSpring,
            delay: Math.min(groupIndex, 3) * 0.08,
          }}
        >
          {/* Day Header */}
          <h3 className="text-sm font-semibold text-text-secondary mb-2 px-1">
            {group.dayTitle}
          </h3>

          {/* Expenses for this day */}
          <div className="bg-surface rounded-xl overflow-hidden">
            <AnimatePresence mode="popLayout">
              {group.expenses.map((expense, index) => (
                <motion.div
                  key={expense.id}
                  variants={listItemVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  layout
                  layoutId={expense.id}
                  className={cn(
                    index < group.expenses.length - 1 && 'border-b border-border'
                  )}
                >
                  <ExpenseCard
                    expense={expense}
                    category={getCategoryById(expense.category)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      ))}

      {/* Load More Button */}
      {hasMore && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={smoothSpring}
          onClick={loadMore}
          className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
        >
          <span>Show more ({remainingCount} remaining)</span>
          <ChevronDown className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
}
