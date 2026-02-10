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
    <header>
      <div className="max-w-app mx-auto px-5 md:px-8 pt-4 pb-2">
        <div className="flex items-center justify-between">
          {/* Left: iOS 26 large title */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
              Pattiyal
            </h1>
            {totalSpent !== undefined && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-text-secondary mt-0.5 font-mono"
              >
                {formatWithCurrency(totalSpent)} this month
              </motion.p>
            )}
          </div>

          {/* Right: Glass search button */}
          <button
            onClick={onSearchClick}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
