'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, ArrowRight } from 'lucide-react';
import { useExpenses, useCategories } from '@/context/ExpenseContext';
import { usePendingTransactions } from '@/context/TransactionsContext';
import { useSettings } from '@/context/SettingsContext';
import { MonthlyCard } from '@/components/MonthlyCard';
import { SpendingTrendChart } from '@/components/SpendingTrendChart';
import { RecentTransactions } from '@/components/RecentTransactions';
import { getCurrentMonthKey, getMonthKey } from '@/lib/utils';
import { pageVariants } from '@/lib/animations';

export default function DashboardPage() {
  const router = useRouter();
  const { state: expenseState } = useExpenses();
  const { categories } = useCategories();
  const { pendingTransactions } = usePendingTransactions();
  const { settings } = useSettings();

  const currentMonthKey = getCurrentMonthKey();

  const currentMonthData = useMemo(() => {
    const monthExpenses = expenseState.expenses.filter(
      (e) => getMonthKey(e.date) === currentMonthKey
    );

    const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const categoryTotals = monthExpenses.reduce((acc, e) => {
      acc[e.category] = acc[e.category] || { amount: 0, count: 0 };
      acc[e.category].amount += e.amount;
      acc[e.category].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    const breakdown = Object.entries(categoryTotals)
      .map(([categoryId, stats]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          categoryName: category?.name || 'Unknown',
          color: category?.color || '#cbd5e1',
          total: stats.amount,
          count: stats.count,
          percentage: total > 0 ? (stats.amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return { total, breakdown };
  }, [expenseState.expenses, categories, currentMonthKey]);

  const pendingCount = useMemo(() => {
    return pendingTransactions.filter(
      (t) => t.status !== 'ignored'
    ).length;
  }, [pendingTransactions]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen ios26-bg pb-24"
    >
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 pt-6 pb-4">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            Home
          </h1>
        </div>
      </header>

      <main className="max-w-app mx-auto px-4 md:px-6 space-y-6">
        {/* Spending Trend Chart */}
        <section>
          <SpendingTrendChart expenses={expenseState.expenses} />
        </section>

        {/* Pending Transactions Call to Action */}
        <button
          onClick={() => router.push('/import')}
          className="w-full text-left p-5 glass-card hover:shadow-elevated transition-all group relative overflow-hidden"
        >
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  Pending Reviews
                </h3>
                <p className="text-sm text-text-muted">
                  {pendingCount === 0
                    ? 'All caught up!'
                    : `${pendingCount} transactions need review`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="bg-accent text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {pendingCount}
                </span>
              )}
              <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        </button>

        {/* Monthly Summary */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3 px-1">
            Current Month
          </h2>
          <MonthlyCard
            month={currentMonthKey}
            total={currentMonthData.total}
            breakdown={currentMonthData.breakdown}
            onClick={() => router.push(`/monthly/${currentMonthKey}`)}
          />
        </section>

        {/* Recent Transactions */}
        <section>
          <RecentTransactions 
            expenses={expenseState.expenses} 
            categories={categories}
            className="w-full"
          />
        </section>
      </main>
    </motion.div>
  );
}
