'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRefresh } from '@/contexts/RefreshContext';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
}

export default function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter();
  const { refreshAll } = useRefresh();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs for tracking state without re-renders
  const containerRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const currentDiff = useRef(0);
  const isDragging = useRef(false);

  // Constants for gesture physics
  const TRIGGER_THRESHOLD = 80;    // Distance to trigger refresh
  const MAX_PULL_DISTANCE = 160;   // Max visual drag distance
  const LOADING_OFFSET = 60;       // Height to settle at while loading

  // Animation reset
  const resetAnimation = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      containerRef.current.style.transform = 'translateY(0px)';
      
      // Clear transition styles after animation completes
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = '';
        }
      }, 300);
    }
    
    // Hide spinner
    if (spinnerRef.current) {
        spinnerRef.current.style.transition = 'opacity 0.2s, transform 0.2s';
        spinnerRef.current.style.opacity = '0';
        spinnerRef.current.style.transform = 'translateY(-20px) scale(0.8) rotate(0deg)';
    }

    currentDiff.current = 0;
  }, []);

  // Use callback to stabilize reference
  const performRefresh = useCallback(async () => {
    // 1. Minimum duration for UX consistency (so spinner doesn't flash)
    const minDelay = new Promise(resolve => setTimeout(resolve, 800));
    
    // 2. The actual data refresh using GLOBAL refresh context
    // This ensures all pages/tabs update their state
    const refreshData = refreshAll();

    await Promise.all([refreshData, minDelay]);
    
    setIsRefreshing(false);
    resetAnimation();
  }, [refreshAll, resetAnimation]);

  useEffect(() => {
    if (isRefreshing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isRefreshing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if we are at the very top of the page
      if (window.scrollY <= 0) {
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
        // Optimization: Removing transition during drag for 60fps tracking
        container.style.transition = 'none';
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Must be dragging, at top, and not currently loading
      if (!isDragging.current || window.scrollY > 0 || isRefreshing) return;

      const y = e.touches[0].clientY;
      const rawDiff = y - touchStartY.current;

      // Only handle downward pulls
      if (rawDiff > 0) {
        // Logarithmic resistance function (feels increasingly harder to pull)
        // y = C * log(x + 1)
        const dampedDiff = Math.min(rawDiff * 0.5, MAX_PULL_DISTANCE); 
        currentDiff.current = dampedDiff;
        
        // 1. Move Content
        container.style.transform = `translateY(${dampedDiff}px)`;
        
        // 2. Animate Spinner
        if (spinnerRef.current) {
            const pullProgress = Math.min(dampedDiff / TRIGGER_THRESHOLD, 1);
            
            // Fade in and scale up as you pull
            spinnerRef.current.style.opacity = `${Math.min(pullProgress * 1.5, 1)}`; // Fade in faster
            spinnerRef.current.style.transform = `translateY(${dampedDiff / 2}px) rotate(${dampedDiff * 3}deg) scale(${0.5 + (pullProgress * 0.5)})`;
        }

        // Prevent native scrolling/refresh behavior
        if (e.cancelable && rawDiff > 5) {
             e.preventDefault(); 
        }
      } else {
        // If pushing UP, let the browser handle scrolling
        isDragging.current = false;
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current || isRefreshing) return;
      isDragging.current = false;

      // Check if pulled far enough
      if (currentDiff.current >= TRIGGER_THRESHOLD) {
        setIsRefreshing(true);
        
        // Move content to loading position
        container.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.transform = `translateY(${LOADING_OFFSET}px)`;
        
        // Lock spinner in visible state
        if (spinnerRef.current) {
            spinnerRef.current.style.opacity = '1';
            spinnerRef.current.style.transform = `translateY(${LOADING_OFFSET / 2}px) scale(1)`; 
            // Rotation is now handled by CSS animation class applied during isRefreshing
        }
        
        performRefresh();
      } else {
        // Snap back to top if cancelled
        resetAnimation();
      }
    };

    // Attach listeners
    // Note: passive: false is key for preventing default browser behaviors
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing, performRefresh, resetAnimation]);

  return (
    <div className="relative isolate min-h-[calc(100vh-100px)] overflow-hidden">
      {/* Background Spinner Layer */}
      {/* Positioned fixed/absolute at the top but behind content */}
      <div 
        className="absolute top-0 left-0 right-0 h-[200px] flex justify-center z-0 pointer-events-none overflow-hidden"
        style={{ transform: 'translateZ(0)' }} 
      >
          <div 
             ref={spinnerRef}
             className={`
                mt-4
                flex items-center justify-center
                w-8 h-8 rounded-full 
                bg-white dark:bg-gray-800 
                shadow-sm border border-gray-100 dark:border-gray-700
                text-blue-600 dark:text-blue-400
                transition-none
             `}
             style={{ 
                 opacity: 0,
                 transform: 'translateY(-20px) scale(0.8)' 
             }}
          >
             <div className={isRefreshing ? 'animate-spin' : ''}>
                <Loader2 size={18} strokeWidth={2.5} />
             </div>
          </div>
      </div>

      {/* Content Layer */}
      <div 
        ref={containerRef}
        className="relative bg-gray-50 dark:bg-gray-900 min-h-full z-10 will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}
