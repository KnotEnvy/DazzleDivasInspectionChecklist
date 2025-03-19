'use client';

import { useState } from 'react';
import Image from 'next/image';

interface PhotoViewerProps {
  photos: { id: string; url: string }[];
  initialIndex?: number;
  onClose: () => void;
}

export default function PhotoViewer({ photos, initialIndex = 0, onClose }: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % photos.length);
  };
  
  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + photos.length) % photos.length);
  };

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          onClick={onClose}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
        
        {/* Image container */}
        <div className="relative w-full h-full max-w-4xl max-h-[80vh] flex items-center justify-center">
          <Image
            src={photos[currentIndex].url}
            alt={`Photo ${currentIndex + 1}`}
            fill
            style={{ objectFit: 'contain' }}
            className="p-2"
          />
        </div>
        
        {/* Navigation controls */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center space-x-4">
          <button
            className="bg-white bg-opacity-20 text-white rounded-full p-2 hover:bg-opacity-30"
            onClick={handlePrevious}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          
          <div className="bg-white bg-opacity-20 text-white rounded-full px-4 py-2">
            {currentIndex + 1} / {photos.length}
          </div>
          
          <button
            className="bg-white bg-opacity-20 text-white rounded-full p-2 hover:bg-opacity-30"
            onClick={handleNext}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}