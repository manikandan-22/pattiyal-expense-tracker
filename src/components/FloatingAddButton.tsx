'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bouncySpring } from '@/lib/animations';

interface FloatingAddButtonProps {
  className?: string;
  onClick: () => void;
}

function setDialogOrigin(e: React.MouseEvent) {
  const x = e.clientX - window.innerWidth / 2;
  const y = e.clientY - window.innerHeight / 2;
  document.documentElement.style.setProperty('--dialog-origin-x', `${x}px`);
  document.documentElement.style.setProperty('--dialog-origin-y', `${y}px`);
}

export { setDialogOrigin };

export function FloatingAddButton({ className, onClick }: FloatingAddButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    setDialogOrigin(e);
    onClick();
  };

  return (
    <div className={cn('fixed bottom-24 right-6 z-40', className)}>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={bouncySpring}
        onClick={handleClick}
        className="w-14 h-14 rounded-full flex items-center justify-center glass shadow-elevated text-text-primary"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </motion.button>
    </div>
  );
}
