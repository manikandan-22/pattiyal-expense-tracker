'use client';

import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Expense, Category } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { useSwipe } from '@/hooks/useSwipe';
import { useSettings } from '@/context/SettingsContext';
import { smoothSpring } from '@/lib/animations';
import { setDialogOrigin } from '@/components/FloatingAddButton';

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
    onSwipeLeft: () => {},
  });

  const showDelete = offsetX < -40 || direction === 'left';

  const handleDelete = () => {
    onDelete(expense.id);
    reset();
  };

  return (
    <div className="relative overflow-hidden">
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

      {/* Main card content — iOS 26 list row style */}
      <motion.div
        {...handlers}
        onClick={(e) => {
          if (!isDragging && offsetX === 0) {
            setDialogOrigin(e);
            onEdit(expense);
          }
        }}
        className={cn(
          'relative flex items-center px-4 md:px-5 py-3 cursor-pointer transition-colors duration-150',
          'active:bg-black/[0.04]',
          isDragging && 'transition-none'
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
        }}
        transition={{ duration: 0.15 }}
      >
        {/* Category icon/emoji circle */}
        <div
          className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 mr-3"
          style={{
            backgroundColor: category?.color ? `${category.color}18` : 'rgba(142, 142, 147, 0.12)',
          }}
        >
          <span className="text-base md:text-lg">
            {category?.icon || '💰'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-text-primary truncate leading-tight">
            {expense.description || category?.name || 'Expense'}
          </p>
          <p className="text-xs text-text-secondary truncate mt-0.5">
            {category?.name || 'Other'}
          </p>
        </div>

        {/* Amount */}
        <div className="text-right ml-3 flex-shrink-0">
          <p className="text-[15px] font-semibold text-text-primary font-mono">
            {formatCurrency(expense.amount, settings.currency)}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
