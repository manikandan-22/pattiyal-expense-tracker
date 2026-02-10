'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Expense, Category } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

interface RecentTransactionsProps {
  expenses: Expense[];
  categories: Category[];
  limit?: number;
  className?: string;
}

export function RecentTransactions({ 
  expenses, 
  categories, 
  limit = 5,
  className 
}: RecentTransactionsProps) {
  const router = useRouter();
  const { settings } = useSettings();

  // Sort expenses by date (newest first) and take the top N
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  return (
    <div className={`p-5 glass-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Recent Activity</h3>
        <button 
          onClick={() => router.push('/')}
          className="text-xs text-accent font-medium hover:underline flex items-center gap-1"
        >
          View All <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-3">
        {recentExpenses.length > 0 ? (
          recentExpenses.map((expense) => {
            const category = categories.find(c => c.id === expense.category);
            
            return (
              <motion.div
                key={expense.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/?search=${encodeURIComponent(expense.description)}`)}
                className="flex items-center justify-between py-2 border-b border-glass-separator last:border-0 cursor-pointer group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                    style={{ backgroundColor: `${category?.color}20`, color: category?.color }}
                  >
                    {category?.icon || '📄'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                      {expense.description}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatDate(expense.date)} • {category?.name}
                    </p>
                  </div>
                </div>
                <div className="font-mono text-sm font-medium text-text-primary whitespace-nowrap">
                  {formatCurrency(expense.amount, settings.currency)}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-8 text-text-muted text-sm">
            No recent transactions
          </div>
        )}
      </div>
    </div>
  );
}
