'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Category } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryPillsProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelect: (categoryId: string | null) => void;
  onAddNew?: () => void;
  showAddButton?: boolean;
  className?: string;
}

export function CategoryPills({
  categories,
  selectedCategory,
  onSelect,
  onAddNew,
  showAddButton = false,
  className,
}: CategoryPillsProps) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto no-scrollbar py-1',
        className
      )}
    >
      {/* All category pill */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelect(null)}
        className={cn(
          'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
          selectedCategory === null
            ? 'glass-pill text-text-primary'
            : 'text-text-secondary hover:text-text-primary'
        )}
      >
        All
      </motion.button>

      {/* Category pills */}
      {categories.map((category) => {
        const isSelected = selectedCategory === category.id;
        return (
          <motion.button
            key={category.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(category.id)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
              isSelected
                ? 'glass-pill text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {category.icon && <span className="text-xs">{category.icon}</span>}
            {category.name}
          </motion.button>
        );
      })}

      {/* Add new category button */}
      {showAddButton && onAddNew && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onAddNew}
          className="flex-shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </motion.button>
      )}
    </div>
  );
}
