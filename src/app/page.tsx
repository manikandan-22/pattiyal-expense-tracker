'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useExpenses, useCategories } from '@/context/ExpenseContext';
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
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-app mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-24 skeleton rounded mb-1" />
              <div className="h-4 w-32 skeleton rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 skeleton rounded-lg" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-app mx-auto px-4 py-6">
        {/* Category Pills Skeleton */}
        <div className="flex gap-2 mb-6 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 skeleton rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Expense List Skeleton */}
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
  const { settings, isLoading: settingsLoading } = useSettings();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Refresh expenses from sheet on page mount
  useEffect(() => {
    if (status === 'authenticated') {
      refreshExpenses();
    }
  }, [status, refreshExpenses]);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (status === 'authenticated' && !settingsLoading && !settings.onboardingCompleted) {
      router.push('/onboarding');
    }
  }, [status, settingsLoading, settings.onboardingCompleted, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }

      // 'n' for new expense
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAddDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    if (!selectedCategory) return state.expenses;
    return state.expenses.filter((e) => e.category === selectedCategory);
  }, [state.expenses, selectedCategory]);

  // Calculate current month total
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

  // Show skeleton while auth is loading or no session yet
  if (status === 'loading' || !session) {
    return <HomePageSkeleton />;
  }

  // Redirect to onboarding if not completed (but don't block render with null)
  if (!settingsLoading && !settings.onboardingCompleted) {
    return <HomePageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        totalSpent={currentMonthTotal}
        onSearchClick={() => setSearchOpen(true)}
      />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="max-w-app mx-auto px-4 py-6"
      >
        {/* Category Filter */}
        <CategoryPills
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          className="mb-6"
        />

        {/* Expense List */}
        <ExpenseList
          expenses={filteredExpenses}
          categories={categories}
          loading={state.loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </motion.div>

      {/* Floating Add Button */}
      <FloatingAddButton onClick={() => setAddDialogOpen(true)} />

      {/* Add Expense Dialog */}
      <ExpenseAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      {/* Search Command */}
      <SearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        expenses={state.expenses}
        categories={categories}
        onSelect={handleSearchSelect}
      />

      {/* Edit Dialog */}
      <ExpenseEditDialog
        expense={editingExpense}
        categories={categories}
        onClose={() => setEditingExpense(null)}
      />
    </div>
  );
}
