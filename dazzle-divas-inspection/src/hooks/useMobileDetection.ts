// src/hooks/useMobileDetection.ts
import { useState, useEffect } from 'react';

/**
 * Hook to detect if the app is running on a mobile device
 */
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [deviceType, setDeviceType] = useState<'unknown' | 'phone' | 'tablet' | 'desktop'>('unknown');
  
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      
      // Check if mobile
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
      
      // Determine device type
      if (isMobileDevice) {
        if (/iPad|Android(?!.*Mobile)/i.test(userAgent)) {
          setDeviceType('tablet');
        } else {
          setDeviceType('phone');
        }
      } else {
        setDeviceType('desktop');
      }
    };
    
    checkMobile();
    
    // Also check on resize in case of responsive mode in browsers
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  return { isMobile, deviceType };
}
