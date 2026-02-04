'use client';

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { Search, LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency } from '@/lib/utils';

interface HeaderProps {
  totalSpent?: number;
  onSearchClick?: () => void;
}

export function Header({ totalSpent, onSearchClick }: HeaderProps) {
  const { data: session } = useSession();
  const { settings } = useSettings();

  const formatWithCurrency = (amount: number) => {
    return formatCurrency(amount, settings.currency);
  };

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-app mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo/Title */}
          <div>
            <h1 className="text-xl font-semibold text-text-primary">
              Pattiyal
            </h1>
            {totalSpent !== undefined && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-text-secondary"
              >
                {formatWithCurrency(totalSpent)} this month
              </motion.p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSearchClick}
              className="p-2 rounded-lg hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
              title="Search (Cmd+K)"
            >
              <Search className="w-5 h-5" />
            </button>

            <div className="relative group">
              <button className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-accent transition-colors bg-surface-hover flex items-center justify-center">
                {session?.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'Profile'}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-text-muted" />
                )}
              </button>
              <div className="absolute right-0 top-full mt-2 py-1 bg-surface rounded-lg shadow-elevated opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all min-w-[160px]">
                {session?.user?.name && (
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {session.user.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {session.user.email}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover w-full"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
