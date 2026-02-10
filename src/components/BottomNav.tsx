'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, BarChart2, Settings, MessageSquare, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { smoothSpring, liquidSpring } from '@/lib/animations';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/', icon: Wallet, label: 'Expenses' },
  { href: '/chat', icon: MessageSquare, label:'Chat' },
  { href: '/monthly', icon: BarChart2, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname.startsWith('/auth') || pathname.startsWith('/onboarding')) {
    return null;
  }

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={smoothSpring}
      className="fixed bottom-0 left-0 right-0 z-40 safe-area-bottom"
    >
      <div className="max-w-app mx-auto px-4 pb-2 pt-1.5">
        <div className="glass-tab-bar flex items-center justify-between p-1.5 w-[400px] mx-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <motion.button
                key={item.href}
                onClick={() => router.push(item.href)}
                whileTap={{ scale: 0.92 }}
                transition={smoothSpring}
                className="relative flex flex-col items-center gap-0.5 py-2 rounded-full flex-1"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 glass-pill"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                      mass: 0.8,
                      restDelta: 0.001,
                    }}
                    style={{ 
                      borderRadius: 50,
                      top: 0,
                      bottom: 0,
                      left: 0,
                      right: 0,
                    }}
                  />
                )}
                <motion.div
                  className={cn(
                    'relative z-10',
                    isActive ? 'text-text-primary' : 'text-text-muted'
                  )}
                  animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                  transition={liquidSpring}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>
                <motion.span
                  className={cn(
                    'text-[10px] font-medium relative z-10',
                    isActive ? 'text-text-primary' : 'text-text-muted'
                  )}
                  animate={isActive ? { opacity: 1 } : { opacity: 0.7 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  {item.label}
                </motion.span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
