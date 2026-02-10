'use client';

import { useState, useMemo, useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Expense, Category } from '@/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';
import { liquidSpring } from '@/lib/animations';

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
  const [searchResults, setSearchResults] = useState<Expense[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const getCategoryById = (id: string) => categoryMap.get(id);

  // Server-side search with debounce
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/drive?type=search&q=${encodeURIComponent(search)}`);
        const data = await res.json();
        setSearchResults(data.expenses || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Show recent expenses when no search, otherwise show search results
  const filteredExpenses = search.trim() ? searchResults : expenses.slice(0, 10);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xl"
            onClick={() => onOpenChange(false)}
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: -20, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, y: -10, filter: 'blur(4px)' }}
            transition={liquidSpring}
            className="fixed inset-x-4 top-20 z-50 mx-auto max-w-lg"
          >
            <Command
              className="rounded-2xl shadow-elevated overflow-hidden bg-[var(--glass-bg-heavy)] backdrop-blur-[40px] backdrop-saturate-[180%] border border-[var(--glass-border)]"
              shouldFilter={false}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 border-b border-glass-separator">
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
                {isSearching && (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                  </div>
                )}
                {!isSearching && filteredExpenses.length === 0 && search.trim() && (
                  <Command.Empty className="py-8 text-center text-text-secondary">
                    No expenses found.
                  </Command.Empty>
                )}

                {!isSearching && !search.trim() && filteredExpenses.length > 0 && (
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
                          <span className="text-sm font-medium text-text-primary flex-shrink-0 font-mono">
                            {formatCurrency(expense.amount, settings.currency)}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {!isSearching && search.trim() && filteredExpenses.length > 0 && (
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
                          <span className="text-sm font-medium text-text-primary flex-shrink-0 font-mono">
                            {formatCurrency(expense.amount, settings.currency)}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </>
                )}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-glass-separator text-xs text-text-muted">
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
