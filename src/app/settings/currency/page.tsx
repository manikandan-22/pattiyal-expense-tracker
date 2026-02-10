'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { SUPPORTED_CURRENCIES, CurrencyCode } from '@/types';
import { cn } from '@/lib/utils';
import { pageVariants } from '@/lib/animations';

export default function CurrencyPage() {
  const router = useRouter();
  const { status } = useSession();
  const { settings, updateSettings, isLoading } = useSettings();
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleSelect = async (code: CurrencyCode) => {
    if (code === settings.currency) return;
    try {
      await updateSettings({ currency: code });
      toast({
        title: 'Currency updated',
        description: `Your currency has been set to ${code}`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update currency',
        variant: 'destructive',
      });
    }
  };

  const showSkeleton = status === 'loading' || isLoading;

  return (
    <div className="min-h-screen ios26-bg">
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
              Currency
            </h1>
          </div>
        </div>
      </header>

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="max-w-app mx-auto px-4 md:px-6 py-6"
      >
        <p className="text-sm text-text-secondary mb-4">
          Choose your preferred currency for displaying amounts
        </p>

        {showSkeleton ? (
          <div className="glass-card divide-y divide-[var(--glass-separator)]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-5 skeleton rounded" />
                <div className="h-4 w-24 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card divide-y divide-[var(--glass-separator)]">
            {SUPPORTED_CURRENCIES.map((currency) => {
              const isSelected = settings.currency === currency.code;
              return (
                <button
                  key={currency.code}
                  onClick={() => handleSelect(currency.code)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
                    'active:bg-black/[0.04]',
                    isSelected && 'bg-white/[0.06]'
                  )}
                >
                  <span className="text-lg w-8 text-center">{currency.symbol}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-text-primary">
                      {currency.name}
                    </p>
                    <p className="text-xs text-text-muted">{currency.code}</p>
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
