'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/context/SettingsContext';
import { SUPPORTED_CURRENCIES, CurrencyCode } from '@/types';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useSession();
  const { settings, updateSettings, isLoading } = useSettings();
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    // If onboarding is already completed, redirect to home
    if (!isLoading && settings.onboardingCompleted) {
      router.push('/');
    }
  }, [settings.onboardingCompleted, isLoading, router]);

  const handleContinue = async () => {
    setSaving(true);
    try {
      await updateSettings({
        currency: selectedCurrency,
        onboardingCompleted: true,
      });
      router.push('/');
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent flex items-center justify-center"
          >
            <span className="text-3xl">💰</span>
          </motion.div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Welcome to Expense Tracker
          </h1>
          <p className="text-text-secondary">
            Let&apos;s set up your preferences
          </p>
        </div>

        {/* Currency Selection */}
        <div className="bg-surface rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Select your currency
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            Choose the currency you use for most of your expenses
          </p>

          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {SUPPORTED_CURRENCIES.map((currency) => (
              <motion.button
                key={currency.code}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCurrency(currency.code)}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left',
                  selectedCurrency === currency.code
                    ? 'border-accent bg-accent-light'
                    : 'border-border hover:border-border-focus'
                )}
              >
                <span className="text-xl w-8">{currency.symbol}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary text-sm truncate">
                    {currency.code}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {currency.name}
                  </p>
                </div>
                {selectedCurrency === currency.code && (
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleContinue}
          disabled={saving}
        >
          {saving ? 'Setting up...' : 'Get Started'}
        </Button>

        <p className="text-xs text-text-muted text-center mt-4">
          You can change this later in Settings
        </p>
      </motion.div>
    </div>
  );
}
