// src/utils/mobile-events.ts
/**
 * Utility to handle common mobile-specific events
 */

/**
 * Prevents iOS Safari's rubber-band scrolling effect
 * @param element DOM element to prevent overscroll on
 */
export const preventOverscroll = (element: HTMLElement) => {
    let startY = 0;
    
    element.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: false });
    
    element.addEventListener('touchmove', (e) => {
      const y = e.touches[0].clientY;
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;
      
      // Prevent overscroll at top
      if (scrollTop <= 0 && y > startY) {
        e.preventDefault();
      }
      
      // Prevent overscroll at bottom
      if (scrollTop + clientHeight >= scrollHeight && y < startY) {
        e.preventDefault();
      }
    }, { passive: false });
  };
  
  /**
   * Handle page visibility changes (app switched to background on mobile)
   * @param onVisible Callback when app becomes visible
   * @param onHidden Callback when app is hidden
   */
  export const handleVisibilityChange = (
    onVisible: () => void,
    onHidden: () => void
  ) => {
    const handleChange = () => {
      if (document.visibilityState === 'visible') {
        onVisible();
      } else {
        onHidden();
      }
    };
    
    document.addEventListener('visibilitychange', handleChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleChange);
    };
  };
  