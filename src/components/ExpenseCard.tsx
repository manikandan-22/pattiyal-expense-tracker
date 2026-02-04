'use client';

import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Expense, Category } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { useSwipe } from '@/hooks/useSwipe';
import { useSettings } from '@/context/SettingsContext';
import { smoothSpring } from '@/lib/animations';

interface ExpenseCardProps {
  expense: Expense;
  category: Category | undefined;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseCard({
  expense,
  category,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const { settings } = useSettings();
  const { offsetX, isDragging, direction, handlers, reset } = useSwipe({
    threshold: 50,
    maxSwipe: 80,
    onSwipeLeft: () => {
      // Keep showing delete button
    },
  });

  const showDelete = offsetX < -40 || direction === 'left';

  const handleDelete = () => {
    onDelete(expense.id);
    reset();
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete action background */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-error transition-opacity',
          showDelete ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: '80px' }}
      >
        <button
          onClick={handleDelete}
          className="p-2 text-white hover:scale-110 transition-transform"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Main card content */}
      <motion.div
        {...handlers}
        onClick={() => !isDragging && offsetX === 0 && onEdit(expense)}
        className={cn(
          'relative flex items-center p-4 bg-surface cursor-pointer transition-colors duration-200',
          'active:bg-surface-hover',
          isDragging && 'transition-none'
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
        }}
        whileHover={{ y: -1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Category indicator */}
        <div
          className="w-3 h-3 rounded-full mr-3 flex-shrink-0"
          style={{ backgroundColor: category?.color || '#D4D4D4' }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary truncate">
              {category?.name || 'Other'}
            </span>
            {category?.icon && (
              <span className="text-sm">{category.icon}</span>
            )}
          </div>
          <p className="text-sm text-text-secondary truncate">
            {expense.description || 'No description'}
          </p>
        </div>

        {/* Amount */}
        <div className="text-right ml-4 flex-shrink-0">
          <p className="font-semibold text-text-primary">
            {formatCurrency(expense.amount, settings.currency)}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
