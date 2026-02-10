'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TransactionsPage } from '@/components/TransactionsPage';

export default function ImportPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen ios26-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ios26-bg">
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Transactions
          </h1>
        </div>
      </header>
      <TransactionsPage />
    </div>
  );
}
