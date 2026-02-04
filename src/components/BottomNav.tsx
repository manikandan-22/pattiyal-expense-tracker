'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, BarChart2, Settings, FileInput } from 'lucide-react';
import { cn } from '@/lib/utils';
import { smoothSpring } from '@/lib/animations';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/import', icon: FileInput, label: 'Import' },
  { href: '/monthly', icon: BarChart2, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show on auth pages
  if (pathname.startsWith('/auth') || pathname.startsWith('/onboarding')) {
    return null;
  }

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={smoothSpring}
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface/80 backdrop-blur-lg border-t border-border safe-area-bottom"
    >
      <div className="max-w-app mx-auto px-4">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <motion.button
                key={item.href}
                onClick={() => router.push(item.href)}
                whileTap={{ scale: 0.9 }}
                transition={smoothSpring}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[64px]',
                  isActive
                    ? 'text-accent'
                    : 'text-text-muted'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-accent/10 rounded-xl"
                    transition={smoothSpring}
                  />
                )}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="text-xs font-medium relative z-10">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
