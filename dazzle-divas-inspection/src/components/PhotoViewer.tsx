'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSwipeable } from 'react-swipeable';

interface PhotoViewerProps {
  photos: { id: string; url: string }[];
  initialIndex?: number;
  onClose: () => void;
}

export default function PhotoViewer({ photos, initialIndex = 0, onClose }: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [touchStartDistance, setTouchStartDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLongPress = useRef(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Reset scale and position when changing photos
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);
  
  // Clean up long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleNext = () => {
    if (scale > 1) return; // Don't allow navigation when zoomed in
    setCurrentIndex((prevIndex) => (prevIndex + 1) % photos.length);
  };
  
  const handlePrevious = () => {
    if (scale > 1) return; // Don't allow navigation when zoomed in
    setCurrentIndex((prevIndex) => (prevIndex - 1 + photos.length) % photos.length);
  };
  
  // Handle pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Calculate initial distance between two fingers
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchStartDistance(distance);
    } else if (e.touches.length === 1) {
      // Start potential pan operation
      setStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
      
      // Set long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      isLongPress.current = false;
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        // Handle long press (e.g. save/share options)
        // For now we'll just log it
        console.log('Long press detected');
      }, 800);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (e.touches.length === 2) {
      // Handle pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (touchStartDistance > 0) {
        const newScale = Math.max(1, Math.min(4, scale * (distance / touchStartDistance)));
        setScale(newScale);
        setTouchStartDistance(distance);
      }
    } else if (e.touches.length === 1 && scale > 1) {
      // Handle panning when zoomed in
      setIsPanning(true);
      setPosition({
        x: e.touches[0].clientX - startPos.x,
        y: e.touches[0].clientY - startPos.y
      });
    }
  };
  
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    setIsPanning(false);
    setTouchStartDistance(0);
    
    // If scale is close to 1, reset to exactly 1
    if (scale < 1.1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };
  
  // Handle double tap zoom
  const handleDoubleTap = () => {
    if (scale > 1) {
      // Reset zoom
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      // Zoom in to 2x
      setScale(2);
    }
  };
  
  // Set up swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (scale === 1) handleNext();
    },
    onSwipedRight: () => {
      if (scale === 1) handlePrevious();
    },
    preventDefaultTouchmoveEvent: false,
    trackMouse: false,
  });

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Photo container */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...swipeHandlers}
        onDoubleClick={handleDoubleTap}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
          style={{
            transform: scale > 1 
              ? `translate(${position.x}px, ${position.y}px) scale(${scale})` 
              : 'translate(0, 0) scale(1)'
          }}
        >
          <Image
            src={photos[currentIndex].url}
            alt={`Photo ${currentIndex + 1}`}
            fill
            sizes="100vw"
            priority
            style={{ 
              objectFit: 'contain',
              touchAction: 'none' // Prevents browser handling of touch gestures
            }}
            className="pointer-events-none"
          />
        </div>
        
        {/* Swipe hint */}
        {scale === 1 && photos.length > 1 && (
          <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none">
            <div className="bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded-full">
              Swipe to navigate • Double tap to zoom
            </div>
          </div>
        )}
        
        {/* Reset zoom hint */}
        {scale > 1 && (
          <div className="absolute bottom-20 inset-x-0 flex justify-center pointer-events-none">
            <div className="bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded-full">
              Double tap to reset zoom
            </div>
          </div>
        )}
      </div>
      
      {/* Controls overlay */}
      <div className="bg-black bg-opacity-60 py-4 px-4 flex justify-between items-center">
        <button
          className="w-10 h-10 flex items-center justify-center bg-white bg-opacity-20 rounded-full"
          onClick={handlePrevious}
          disabled={scale > 1}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        
        <div className="text-white text-sm">
          {currentIndex + 1} / {photos.length}
        </div>
        
        <button
          className="w-10 h-10 flex items-center justify-center bg-white bg-opacity-20 rounded-full"
          onClick={handleNext}
          disabled={scale > 1}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
      
      {/* Close button */}
      <button
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-black bg-opacity-50 rounded-full"
        onClick={onClose}
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  );
}