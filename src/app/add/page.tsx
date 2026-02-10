'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic } from 'lucide-react';
import { ExpenseForm } from '@/components/ExpenseForm';
import { VoiceInput } from '@/components/VoiceInput';
import { Button } from '@/components/ui/button';
import { ParsedVoiceExpense } from '@/types';

function AddExpenseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [showVoice, setShowVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState<ParsedVoiceExpense | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      setShowVoice(true);
    }
  }, [searchParams]);

  const handleVoiceResult = (result: ParsedVoiceExpense) => {
    setVoiceResult(result);
    setShowVoice(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ios26-bg">
      {/* Header */}
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 -ml-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <h1 className="text-xl font-semibold text-text-primary">
                Add Expense
              </h1>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowVoice(true)}
              className="text-text-secondary"
            >
              <Mic className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-app mx-auto px-4 md:px-6 py-6"
      >
        {showVoice ? (
          <VoiceInput
            onResult={handleVoiceResult}
            onCancel={() => setShowVoice(false)}
          />
        ) : (
          <ExpenseForm
            onSuccess={() => router.push('/')}
            initialValues={
              voiceResult
                ? {
                    amount: voiceResult.amount || undefined,
                    category: voiceResult.category || undefined,
                    description: voiceResult.description,
                    date: voiceResult.date,
                  }
                : undefined
            }
          />
        )}
      </motion.div>
    </div>
  );
}

export default function AddExpensePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AddExpenseContent />
    </Suspense>
  );
}
