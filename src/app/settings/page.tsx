'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ArrowLeft, Tag, Upload, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { SUPPORTED_CURRENCIES, CurrencyCode } from '@/types';
import { pageVariants } from '@/lib/animations';

function SettingsSkeleton() {
  return (
    <>
      {/* Currency Setting Skeleton */}
      <div className="bg-surface rounded-xl p-6 mb-4">
        <div className="h-6 w-24 skeleton rounded mb-1" />
        <div className="h-4 w-64 skeleton rounded mb-4" />
        <div className="h-10 w-full skeleton rounded" />
      </div>

      {/* Categories Link Skeleton */}
      <div className="h-16 w-full skeleton rounded-lg" />
    </>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { status } = useSession();
  const { settings, updateSettings, isLoading } = useSettings();
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleCurrencyChange = async (currency: CurrencyCode) => {
    try {
      await updateSettings({ currency });
      toast({
        title: 'Currency updated',
        description: `Your currency has been set to ${currency}`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update currency',
        variant: 'destructive',
      });
    }
  };

  const selectedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === settings.currency);
  const showSkeleton = status === 'loading' || isLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-app mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <h1 className="text-xl font-semibold text-text-primary">
              Settings
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="max-w-app mx-auto px-4 py-6"
      >
        {showSkeleton ? (
          <SettingsSkeleton />
        ) : (
          <>
            {/* Currency Setting */}
            <div className="bg-surface rounded-xl p-6 mb-4">
              <h2 className="text-lg font-semibold text-text-primary mb-1">
                Currency
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Choose your preferred currency for displaying amounts
              </p>

              <Select
                value={settings.currency}
                onValueChange={(value) => handleCurrencyChange(value as CurrencyCode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedCurrency && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{selectedCurrency.symbol}</span>
                        <span>{selectedCurrency.name}</span>
                        <span className="text-text-muted">({selectedCurrency.code})</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg w-6">{currency.symbol}</span>
                        <span>{currency.name}</span>
                        <span className="text-text-muted">({currency.code})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categories Link */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 mb-3"
              onClick={() => router.push('/categories')}
            >
              <Tag className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-medium">Manage Categories</p>
                <p className="text-sm text-text-secondary">Add, edit, or remove expense categories</p>
              </div>
            </Button>

            {/* Categorization Rules */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 mb-3"
              onClick={() => router.push('/settings/rules')}
            >
              <Settings2 className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-medium">Categorization Rules</p>
                <p className="text-sm text-text-secondary">Auto-categorize imported transactions</p>
              </div>
            </Button>

            {/* Import CSV */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => router.push('/import')}
            >
              <Upload className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-medium">Import from CSV</p>
                <p className="text-sm text-text-secondary">Import expenses from bank statement CSV</p>
              </div>
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
