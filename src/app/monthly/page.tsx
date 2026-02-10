'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { useExpenses, useCategories } from '@/context/ExpenseContext';
import { MonthlyCard } from '@/components/MonthlyCard';
import { SkeletonCard } from '@/components/SkeletonList';
import { groupExpensesByMonth, calculateCategoryBreakdown } from '@/lib/utils';

export default function MonthlyOverviewPage() {
  const router = useRouter();
  const { status } = useSession();
  const { state } = useExpenses();
  const { categories } = useCategories();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const monthlyData = useMemo(() => {
    const grouped = groupExpensesByMonth(state.expenses);
    const months: {
      month: string;
      total: number;
      breakdown: ReturnType<typeof calculateCategoryBreakdown>;
    }[] = [];

    grouped.forEach((expenses, month) => {
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      const breakdown = calculateCategoryBreakdown(expenses, categories);
      months.push({ month, total, breakdown });
    });

    // Sort by month descending
    return months.sort((a, b) => b.month.localeCompare(a.month));
  }, [state.expenses, categories]);

  if (status === 'loading' || state.loading) {
    return (
      <div className="min-h-screen ios26-bg">
        <header className="">
          <div className="max-w-app mx-auto px-5 md:px-8 py-4">
            <div className="h-6 w-32 skeleton rounded" />
          </div>
        </header>
        <div className="max-w-app mx-auto px-4 md:px-6 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ios26-bg">
      {/* Header */}
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Reports
          </h1>
        </div>
      </header>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-app mx-auto px-4 md:px-6 py-6"
      >
        {monthlyData.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mb-4 mx-auto rounded-full bg-surface-hover flex items-center justify-center">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-1">
              No data yet
            </h3>
            <p className="text-sm text-text-secondary">
              Start adding expenses to see your monthly overview
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {monthlyData.map((data, index) => (
              <motion.div
                key={data.month}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <MonthlyCard
                  month={data.month}
                  total={data.total}
                  breakdown={data.breakdown}
                  onClick={() => router.push(`/monthly/${data.month}`)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
