'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bouncySpring } from '@/lib/animations';

interface FloatingAddButtonProps {
  className?: string;
  onClick: () => void;
}

export function FloatingAddButton({ className, onClick }: FloatingAddButtonProps) {
  return (
    <div className={cn('fixed bottom-24 right-6 z-40', className)}>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={bouncySpring}
        onClick={onClick}
        className="w-14 h-14 rounded-full shadow-elevated flex items-center justify-center bg-accent text-white"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
