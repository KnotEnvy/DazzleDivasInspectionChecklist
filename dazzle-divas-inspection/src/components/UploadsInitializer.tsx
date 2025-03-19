// src/components/UploadsInitializer.tsx
'use client';

import { useEffect } from 'react';

// This component ensures the uploads directory exists
export default function UploadsInitializer() {
  useEffect(() => {
    // Ensure uploads directory exists (client-side)
    const createUploadsDir = async () => {
      try {
        // Make an API call to create the uploads directory
        const response = await fetch('/api/uploads/init', {
          method: 'POST',
        });
        if (!response.ok) {
          console.error('Failed to initialize uploads directory');
        }
      } catch (error) {
        console.error('Error initializing uploads directory:', error);
      }
    };
    
    createUploadsDir();
  }, []);
  
  return null;
}