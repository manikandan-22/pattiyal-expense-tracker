'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useExpenses, useCategories } from '@/context/ExpenseContext';
import { useSettings } from '@/context/SettingsContext';
import { ExpenseList } from '@/components/ExpenseList';
import { CategorySummary } from '@/components/CategorySummary';
import { ExpenseEditDialog } from '@/components/ExpenseEditDialog';
import { Expense } from '@/types';
import {
  formatCurrency,
  formatMonthYear,
  getMonthKey,
  calculateCategoryBreakdown,
} from '@/lib/utils';

export default function MonthDetailPage() {
  const router = useRouter();
  const params = useParams();
  const month = params.month as string;
  const { status } = useSession();
  const { state, deleteExpense } = useExpenses();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Filter expenses for this month
  const monthExpenses = useMemo(() => {
    return state.expenses.filter((e) => getMonthKey(e.date) === month);
  }, [state.expenses, month]);

  // Calculate totals
  const monthTotal = useMemo(() => {
    return monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [monthExpenses]);

  // Category breakdown
  const breakdown = useMemo(() => {
    return calculateCategoryBreakdown(monthExpenses, categories);
  }, [monthExpenses, categories]);

  // Get previous and next months
  const allMonths = useMemo(() => {
    const months = new Set<string>();
    state.expenses.forEach((e) => months.add(getMonthKey(e.date)));
    return Array.from(months).sort();
  }, [state.expenses]);

  const currentIndex = allMonths.indexOf(month);
  const prevMonth = currentIndex > 0 ? allMonths[currentIndex - 1] : null;
  const nextMonth = currentIndex < allMonths.length - 1 ? allMonths[currentIndex + 1] : null;

  const handleEdit = useCallback((expense: Expense) => {
    setEditingExpense(expense);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteExpense(id);
      } catch (error) {
        console.error('Failed to delete expense:', error);
      }
    },
    [deleteExpense]
  );

  if (status === 'loading' || state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-app mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/monthly')}
                className="p-2 -ml-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => prevMonth && router.push(`/monthly/${prevMonth}`)}
                disabled={!prevMonth}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 text-text-secondary" />
              </button>

              <span className="text-lg font-semibold text-text-primary min-w-[160px] text-center">
                {formatMonthYear(month)}
              </span>

              <button
                onClick={() => nextMonth && router.push(`/monthly/${nextMonth}`)}
                disabled={!nextMonth}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="w-9" /> {/* Spacer for alignment */}
          </div>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-app mx-auto px-4 py-6"
      >
        {/* Total Card */}
        <div className="bg-surface rounded-xl p-6 mb-6">
          <p className="text-sm text-text-secondary mb-1">Total Spent</p>
          <p className="text-3xl font-semibold text-text-primary">
            {formatCurrency(monthTotal, settings.currency)}
          </p>
          <p className="text-sm text-text-muted mt-1">
            {monthExpenses.length} {monthExpenses.length === 1 ? 'expense' : 'expenses'}
          </p>
        </div>

        {/* Category Summary */}
        {breakdown.length > 0 && (
          <div className="bg-surface rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              By Category
            </h2>
            <CategorySummary breakdown={breakdown} />
          </div>
        )}

        {/* Expense List */}
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            All Expenses
          </h2>
          <ExpenseList
            expenses={monthExpenses}
            categories={categories}
            loading={false}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <ExpenseEditDialog
        expense={editingExpense}
        categories={categories}
        onClose={() => setEditingExpense(null)}
      />
    </div>
  );
}
