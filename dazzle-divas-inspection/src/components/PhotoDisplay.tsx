'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface PhotoDisplayProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  onClick?: () => void;
}

export default function PhotoDisplay({ 
  src, 
  alt, 
  width = 400, 
  height = 300, 
  className = "", 
  onClick 
}: PhotoDisplayProps) {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Reset state when the src changes
    setImageSrc(src);
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  // Handle image load errors by trying alternative approaches
  const handleError = () => {
    setIsLoading(false);
    
    // If already tried fallback, show placeholder
    if (hasError) {
      console.log(`Failed to load image after fallback: ${src}`);
      return;
    }
    
    setHasError(true);
    
    // Try fallback approach: convert from /uploads/ to /public/uploads/
    if (src.startsWith('/uploads/')) {
      // Get the path after /uploads/
      const relativePath = src.substring('/uploads/'.length);
      // Try using the public directory version
      const newSrc = `/public/uploads/${relativePath}`;
      console.log(`Trying fallback image path: ${newSrc}`);
      setImageSrc(newSrc);
    }
  };

  return (
    <div 
      className={`relative ${className}`}
      style={{ width: width, height: height }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {hasError && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-500">
          <svg 
            className="w-12 h-12 mb-2 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            ></path>
          </svg>
          <p className="text-xs">Image not available</p>
        </div>
      )}
      
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        onError={handleError}
        onLoad={() => setIsLoading(false)}
        onClick={onClick}
        className={`${onClick ? 'cursor-pointer' : ''} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          objectFit: 'cover',
          transition: 'opacity 0.3s ease'
        }}
      />
    </div>
  );
}