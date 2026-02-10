'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  Tag,
  Upload,
  Settings2,
  LogOut,
  User,
  ChevronRight,
  DollarSign,
  Mail,
} from 'lucide-react';
import Image from 'next/image';
import { useSettings } from '@/context/SettingsContext';
import { signOut } from 'next-auth/react';
import { SUPPORTED_CURRENCIES } from '@/types';
import { pageVariants } from '@/lib/animations';

function SettingsSkeleton() {
  return (
    <>
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full skeleton" />
          <div className="flex-1">
            <div className="h-4 w-24 skeleton rounded mb-1.5" />
            <div className="h-3 w-36 skeleton rounded" />
          </div>
        </div>
      </div>
      <div className="glass-card divide-y divide-[var(--glass-separator)]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4">
            <div className="w-9 h-9 rounded-lg skeleton" />
            <div className="flex-1">
              <div className="h-4 w-28 skeleton rounded mb-1" />
              <div className="h-3 w-44 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const settingsLinks = [
  {
    href: '/settings/currency',
    icon: DollarSign,
    label: 'Currency',
    description: 'Choose your preferred currency',
    valueKey: 'currency' as const,
  },
  {
    href: '/categories',
    icon: Tag,
    label: 'Categories',
    description: 'Add, edit, or remove expense categories',
  },
  {
    href: '/settings/rules',
    icon: Settings2,
    label: 'Categorization Rules',
    description: 'Auto-categorize imported transactions',
  },
  {
    href: '/import',
    icon: Upload,
    label: 'Import from CSV',
    description: 'Import expenses from bank statement CSV',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { settings, isLoading, updateSettings } = useSettings();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const showSkeleton = status === 'loading' || isLoading;
  const selectedCurrency = SUPPORTED_CURRENCIES.find(
    (c) => c.code === settings.currency
  );

  return (
    <div className="min-h-screen ios26-bg">
      {/* Header */}
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Settings
          </h1>
        </div>
      </header>

      {/* Content */}
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="max-w-app mx-auto px-4 md:px-6 py-6"
      >
        {showSkeleton ? (
          <SettingsSkeleton />
        ) : (
          <>
            {/* Account card */}
            <div className="glass-card p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center flex-shrink-0">
                  {session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'Profile'}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {session?.user?.name || 'User'}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {session?.user?.email}
                  </p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>

            {/* Settings list — iOS insetGrouped style */}
            <div className="glass-card divide-y divide-[var(--glass-separator)]">
              {settingsLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.04] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg glass-pill flex items-center justify-center flex-shrink-0">
                      <Icon className="w-[18px] h-[18px] text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-text-primary">
                        {item.label}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {item.description}
                      </p>
                    </div>
                    {item.valueKey === 'currency' && selectedCurrency && (
                      <span className="text-sm text-text-secondary mr-1">
                        {selectedCurrency.symbol} {selectedCurrency.code}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Gmail Sync toggle */}
            <div className="glass-card mt-6">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-lg glass-pill flex items-center justify-center flex-shrink-0">
                  <Mail className="w-[18px] h-[18px] text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-text-primary">
                    Gmail Sync
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    Auto-import transactions from email
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.gmailSyncEnabled}
                  onClick={() => updateSettings({ gmailSyncEnabled: !settings.gmailSyncEnabled })}
                  className={`relative inline-flex h-[28px] w-[50px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    settings.gmailSyncEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-[24px] w-[24px] transform rounded-full bg-white shadow-md transition-transform ${
                      settings.gmailSyncEnabled ? 'translate-x-[22px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
