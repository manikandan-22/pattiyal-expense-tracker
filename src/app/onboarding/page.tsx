'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/context/SettingsContext';
import { SUPPORTED_CURRENCIES, CurrencyCode } from '@/types';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useSession();
  const { settings, updateSettings, isLoading } = useSettings();
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD');
  const [gmailSyncEnabled, setGmailSyncEnabled] = useState(false);
  const [step, setStep] = useState(1);
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

  const handleContinueToStep2 = () => {
    setStep(2);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateSettings({
        currency: selectedCurrency,
        gmailSyncEnabled,
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
        <div className="w-8 h-8 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ios26-bg flex items-center justify-center px-4">
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
            className="w-16 h-16 mx-auto mb-4 rounded-2xl glass flex items-center justify-center"
          >
            <span className="text-3xl">💰</span>
          </motion.div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            Welcome to Expense Tracker
          </h1>
          <p className="text-text-secondary">
            Let&apos;s set up your preferences
          </p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={cn(
              'w-2 h-2 rounded-full transition-colors',
              step === 1 ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'
            )} />
            <div className={cn(
              'w-2 h-2 rounded-full transition-colors',
              step === 2 ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'
            )} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Currency Selection */}
              <div className="glass-card p-6 mb-6">
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
                          ? 'border-[var(--glass-pill-border)] bg-[var(--glass-pill-bg)]'
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
                        <Check className="w-4 h-4 text-text-primary flex-shrink-0" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleContinueToStep2}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Gmail Sync Opt-in */}
              <div className="glass-card p-6 mb-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mb-4">
                    <Mail className="w-7 h-7 text-text-secondary" />
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary mb-2">
                    Import from Gmail
                  </h2>
                  <p className="text-sm text-text-secondary mb-6">
                    Automatically find transaction emails from your bank and UPI apps
                  </p>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setGmailSyncEnabled(!gmailSyncEnabled)}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors',
                      gmailSyncEnabled
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-border hover:border-border-focus'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Mail className={cn(
                        'w-5 h-5',
                        gmailSyncEnabled ? 'text-[var(--accent)]' : 'text-text-muted'
                      )} />
                      <span className={cn(
                        'font-medium',
                        gmailSyncEnabled ? 'text-[var(--accent)]' : 'text-text-primary'
                      )}>
                        Enable Gmail Sync
                      </span>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      gmailSyncEnabled
                        ? 'border-[var(--accent)] bg-[var(--accent)]'
                        : 'border-[var(--text-muted)]'
                    )}>
                      {gmailSyncEnabled && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </motion.button>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? 'Setting up...' : 'Get Started'}
              </Button>

              <p className="text-xs text-text-muted text-center mt-4">
                You can change this later in Settings
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
