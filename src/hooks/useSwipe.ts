'use client';

import { useState, useRef, useCallback } from 'react';

interface SwipeState {
  offsetX: number;
  isDragging: boolean;
  direction: 'left' | 'right' | null;
}

interface UseSwipeOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  maxSwipe?: number;
}

export function useSwipe({
  threshold = 50,
  onSwipeLeft,
  onSwipeRight,
  maxSwipe = 80,
}: UseSwipeOptions = {}) {
  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    isDragging: false,
    direction: null,
  });

  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setState((prev) => ({ ...prev, isDragging: true }));
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!state.isDragging) return;

      currentX.current = e.touches[0].clientX;
      const diff = currentX.current - startX.current;

      // Limit the swipe distance
      const limitedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));

      setState({
        offsetX: limitedDiff,
        isDragging: true,
        direction: limitedDiff < 0 ? 'left' : limitedDiff > 0 ? 'right' : null,
      });
    },
    [state.isDragging, maxSwipe]
  );

  const handleTouchEnd = useCallback(() => {
    const diff = currentX.current - startX.current;

    if (Math.abs(diff) > threshold) {
      if (diff < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (diff > 0 && onSwipeRight) {
        onSwipeRight();
      }
    }

    // Reset state
    setState({
      offsetX: 0,
      isDragging: false,
      direction: null,
    });
  }, [threshold, onSwipeLeft, onSwipeRight]);

  const reset = useCallback(() => {
    setState({
      offsetX: 0,
      isDragging: false,
      direction: null,
    });
  }, []);

  return {
    ...state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    reset,
  };
}
