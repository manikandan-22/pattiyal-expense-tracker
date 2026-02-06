'use client';

import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency } from '@/lib/utils';

interface HeaderProps {
  totalSpent?: number;
  onSearchClick?: () => void;
}

export function Header({ totalSpent, onSearchClick }: HeaderProps) {
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
          </div>
        </div>
      </div>
    </header>
  );
}
