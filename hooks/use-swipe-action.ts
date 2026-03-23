"use client";

import { useState, useRef, useCallback } from 'react';

export type SwipeDirection = 'left' | 'right' | null;

interface UseSwipeActionOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxSwipe?: number;
}

interface UseSwipeActionReturn {
  swipeOffset: number;
  swipeDirection: SwipeDirection;
  isSwiping: boolean;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function useSwipeAction({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  maxSwipe = 120,
}: UseSwipeActionOptions): UseSwipeActionReturn {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const locked = useRef(false); // Lock direction after initial move

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
    locked.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const diffX = e.touches[0].clientX - startX.current;
    const diffY = e.touches[0].clientY - startY.current;

    // Determine direction on first significant move
    if (!locked.current) {
      if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) return;
      // If vertical movement is dominant, don't swipe
      if (Math.abs(diffY) > Math.abs(diffX)) {
        locked.current = true;
        return;
      }
      locked.current = true;
      swiping.current = true;
      setIsSwiping(true);
    }

    if (!swiping.current) return;

    // Clamp and dampen
    const clamped = Math.max(-maxSwipe, Math.min(maxSwipe, diffX * 0.6));
    setSwipeOffset(clamped);
  }, [maxSwipe]);

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return;
    swiping.current = false;
    setIsSwiping(false);

    if (swipeOffset <= -threshold && onSwipeLeft) {
      if (navigator.vibrate) navigator.vibrate(10);
      onSwipeLeft();
    } else if (swipeOffset >= threshold && onSwipeRight) {
      if (navigator.vibrate) navigator.vibrate(10);
      onSwipeRight();
    }

    setSwipeOffset(0);
  }, [swipeOffset, threshold, onSwipeLeft, onSwipeRight]);

  const swipeDirection: SwipeDirection = swipeOffset < -10 ? 'left' : swipeOffset > 10 ? 'right' : null;

  return {
    swipeOffset,
    swipeDirection,
    isSwiping,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
