'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { useExpenses, useCategories } from '@/context/ExpenseContext';
import { usePendingTransactions } from '@/context/TransactionsContext';
import { useSettings } from '@/context/SettingsContext';
import { Header } from '@/components/Header';
import { ExpenseList } from '@/components/ExpenseList';
import { CategoryPills } from '@/components/CategoryPills';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { SearchCommand } from '@/components/SearchCommand';
import { ExpenseEditDialog } from '@/components/ExpenseEditDialog';
import { ExpenseAddDialog } from '@/components/ExpenseAddDialog';
import { SkeletonList } from '@/components/SkeletonList';
import { Expense } from '@/types';
import { getCurrentMonthKey, getMonthKey } from '@/lib/utils';
import { pageVariants, smoothSpring } from '@/lib/animations';

function HomePageSkeleton() {
  return (
    <div className="min-h-screen ios26-bg">
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-7 w-24 skeleton rounded-lg mb-1" />
              <div className="h-4 w-32 skeleton rounded" />
            </div>
            <div className="h-9 w-9 skeleton rounded-full" />
          </div>
        </div>
      </header>
      <div className="max-w-app mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="flex gap-2 mb-5 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-16 skeleton rounded-full flex-shrink-0" />
          ))}
        </div>
        <SkeletonList count={5} />
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { state, deleteExpense, refreshExpenses } = useExpenses();
  const { categories } = useCategories();
  const { pendingTransactions } = usePendingTransactions();
  const { settings, isLoading: settingsLoading } = useSettings();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      refreshExpenses();
    }
  }, [status, refreshExpenses]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && !settingsLoading && !settings.onboardingCompleted) {
      router.push('/onboarding');
    }
  }, [status, settingsLoading, settings.onboardingCompleted, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAddDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredExpenses = useMemo(() => {
    if (!selectedCategory) return state.expenses;
    return state.expenses.filter((e) => e.category === selectedCategory);
  }, [state.expenses, selectedCategory]);

  const currentMonthTotal = useMemo(() => {
    const currentMonth = getCurrentMonthKey();
    return state.expenses
      .filter((e) => getMonthKey(e.date) === currentMonth)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [state.expenses]);

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

  const handleSearchSelect = useCallback((expense: Expense) => {
    setEditingExpense(expense);
    setSearchOpen(false);
  }, []);

  if (status === 'loading' || !session) {
    return <HomePageSkeleton />;
  }

  if (!settingsLoading && !settings.onboardingCompleted) {
    return <HomePageSkeleton />;
  }

  return (
    <div className="min-h-screen ios26-bg">
      <Header
        totalSpent={currentMonthTotal}
        onSearchClick={() => setSearchOpen(true)}
      />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="max-w-app mx-auto px-4 md:px-6 py-4 md:py-6"
      >
        {/* Category Filter */}
        <CategoryPills
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          className="mb-5 md:mb-6"
        />

        {/* Pending Transactions Alert */}
        {pendingTransactions.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => router.push('/import')}
            className="w-full mb-6 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-text-primary">
                  Pending Transactions
                </p>
                <p className="text-xs text-text-muted">
                  {pendingTransactions.filter(t => t.status !== 'ignored').length} items to review
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
          </motion.button>
        )}

        {/* Expense List */}
        <ExpenseList
          expenses={filteredExpenses}
          categories={categories}
          loading={state.loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </motion.div>

      <FloatingAddButton onClick={() => setAddDialogOpen(true)} />

      <ExpenseAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <SearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        expenses={state.expenses}
        categories={categories}
        onSelect={handleSearchSelect}
      />

      <ExpenseEditDialog
        expense={editingExpense}
        categories={categories}
        onClose={() => setEditingExpense(null)}
      />
    </div>
  );
}
