'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useCategories } from '@/context/ExpenseContext';
import { CategoryManager } from '@/components/CategoryManager';
import { SkeletonList } from '@/components/SkeletonList';

export default function CategoriesPage() {
  const router = useRouter();
  const { status } = useSession();
  const { categories } = useCategories();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen ios26-bg">
        <header className="">
          <div className="max-w-app mx-auto px-5 md:px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg skeleton" />
              <div className="h-6 w-28 skeleton rounded" />
            </div>
          </div>
        </header>
        <div className="max-w-app mx-auto px-4 py-6">
          <SkeletonList count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ios26-bg">
      {/* Header */}
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <h1 className="text-xl font-semibold text-text-primary">
              Categories
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-app mx-auto px-4 md:px-6 py-6"
      >
        <p className="text-sm text-text-secondary mb-6">
          Organize your expenses with custom categories. Add, edit, or remove categories to match your spending habits.
        </p>

        <CategoryManager categories={categories} />
      </motion.div>
    </div>
  );
}
