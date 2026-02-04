'use client';

import { useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Expense, Category } from '@/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';
import { modalVariants, backdropVariants, smoothSpring } from '@/lib/animations';

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: Expense[];
  categories: Category[];
  onSelect: (expense: Expense) => void;
}

export function SearchCommand({
  open,
  onOpenChange,
  expenses,
  categories,
  onSelect,
}: SearchCommandProps) {
  const { settings } = useSettings();
  const [search, setSearch] = useState('');

  // Create a category lookup map for O(1) access instead of O(n) find()
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const getCategoryById = (id: string) => categoryMap.get(id);

  // Pre-compute searchable data for faster filtering
  const searchableExpenses = useMemo(() => {
    return expenses.map((expense) => {
      const category = categoryMap.get(expense.category);
      return {
        expense,
        category,
        searchText: `${expense.description.toLowerCase()}|${category?.name.toLowerCase() || ''}|${expense.amount}`,
      };
    });
  }, [expenses, categoryMap]);

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) {
      return expenses.slice(0, 10); // Show recent expenses when no search
    }

    const searchLower = search.toLowerCase();
    return searchableExpenses
      .filter((item) => item.searchText.includes(searchLower))
      .map((item) => item.expense);
  }, [expenses, searchableExpenses, search]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Command Dialog */}
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-x-4 top-20 z-50 mx-auto max-w-lg"
          >
            <Command
              className="bg-surface rounded-xl shadow-elevated overflow-hidden"
              shouldFilter={false}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 border-b border-border">
                <Search className="w-5 h-5 text-text-muted" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search expenses..."
                  className="flex-1 py-4 bg-transparent outline-none text-text-primary placeholder:text-text-muted"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="p-1 rounded hover:bg-surface-hover"
                  >
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                )}
              </div>

              {/* Results */}
              <Command.List className="max-h-80 overflow-y-auto p-2">
                {filteredExpenses.length === 0 && (
                  <Command.Empty className="py-8 text-center text-text-secondary">
                    No expenses found.
                  </Command.Empty>
                )}

                {!search.trim() && filteredExpenses.length > 0 && (
                  <Command.Group heading="Recent Expenses" className="px-2 py-1.5 text-xs text-text-muted font-medium">
                    {filteredExpenses.map((expense) => {
                      const category = getCategoryById(expense.category);
                      return (
                        <Command.Item
                          key={expense.id}
                          value={expense.id}
                          onSelect={() => onSelect(expense)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
                            'hover:bg-surface-hover data-[selected=true]:bg-surface-hover'
                          )}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category?.color || '#D4D4D4' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-text-primary truncate">
                                {expense.description || category?.name || 'Expense'}
                              </span>
                              {category?.icon && (
                                <span className="text-xs">{category.icon}</span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted">
                              {category?.name} · {formatDate(expense.date)}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-text-primary flex-shrink-0">
                            {formatCurrency(expense.amount, settings.currency)}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {search.trim() && filteredExpenses.length > 0 && (
                  <>
                    {filteredExpenses.map((expense) => {
                      const category = getCategoryById(expense.category);
                      return (
                        <Command.Item
                          key={expense.id}
                          value={expense.id}
                          onSelect={() => onSelect(expense)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
                            'hover:bg-surface-hover data-[selected=true]:bg-surface-hover'
                          )}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category?.color || '#D4D4D4' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-text-primary truncate">
                                {expense.description || category?.name || 'Expense'}
                              </span>
                              {category?.icon && (
                                <span className="text-xs">{category.icon}</span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted">
                              {category?.name} · {formatDate(expense.date)}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-text-primary flex-shrink-0">
                            {formatCurrency(expense.amount, settings.currency)}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </>
                )}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-text-muted">
                <span>Type to search</span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-surface-hover rounded text-xs">esc</kbd>
                  {' '}to close
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
