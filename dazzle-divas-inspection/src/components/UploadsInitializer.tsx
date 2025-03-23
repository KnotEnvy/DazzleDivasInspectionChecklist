// src/components/UploadsInitializer.tsx
'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

// This component ensures the uploads directory exists
export default function UploadsInitializer() {
  const { status } = useSession();

  useEffect(() => {
    // Only initialize when the user is authenticated
    if (status === 'authenticated') {
      // Ensure uploads directory exists (client-side)
      const createUploadsDir = async () => {
        try {
          console.log('Initializing uploads directory...');
          // Make an API call to create the uploads directory
          const response = await fetch('/api/uploads/init', {
            method: 'POST',
          });
          
          if (!response.ok) {
            console.error('Failed to initialize uploads directory');
            return;
          }
          
          const data = await response.json();
          console.log('Uploads directory initialized:', data);
        } catch (error) {
          console.error('Error initializing uploads directory:', error);
        }
      };
      
      createUploadsDir();
    }
  }, [status]);
  
  return null;
}