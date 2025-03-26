'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';

interface CameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function Camera({ onCapture, onClose }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isMobile, setIsMobile] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const [screenOrientation, setScreenOrientation] = useState<string>('');

  // Check if device is mobile
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    
    // Set initial orientation
    if (window.screen.orientation) {
      setScreenOrientation(window.screen.orientation.type);
    } else if (window.orientation !== undefined) {
      // Fallback for older browsers
      setScreenOrientation(window.orientation === 0 ? 'portrait' : 'landscape');
    }
    
    // Listen for orientation changes
    const handleOrientationChange = () => {
      if (window.screen.orientation) {
        setScreenOrientation(window.screen.orientation.type);
      } else if (window.orientation !== undefined) {
        setScreenOrientation(window.orientation === 0 ? 'portrait' : 'landscape');
      }
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Start the camera when component mounts
  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        // Stop any existing stream
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Check if camera is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsCameraSupported(false);
        setError('Camera is not supported on this device or browser');
        return;
      }
      
      setIsCapturing(false);

      // For mobile devices, we want to use the back camera by default
      // with the highest possible resolution
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      // Check if flash is available
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.();
        setHasFlash(capabilities?.torch || false);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No camera found. Please make sure your device has a camera.');
      } else {
        setError('Could not access camera. Please make sure you have granted camera permissions.');
      }
    }
  }, [facingMode, stream]);
  
  useEffect(() => {
    startCamera();
    
    // Clean up on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Turn off flash if active
      if (flashActive) {
        toggleFlash(false);
      }
    };
  }, [facingMode, startCamera, flashActive]);
  
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setIsCapturing(true);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Add visual feedback for capture
        setTimeout(() => {
          // Convert canvas to file
          canvas.toBlob((blob) => {
            if (blob) {
              // Create a File object
              const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
              onCapture(file);
              setIsCapturing(false);
            }
          }, 'image/jpeg', 0.95); // JPEG at 95% quality
        }, 200); // Short delay for visual feedback
      }
    }
  };
  
  const switchCamera = () => {
    // Toggle between front and back camera
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    
    // Turn off flash when switching camera
    if (flashActive) {
      toggleFlash(false);
    }
  };
  
  const toggleFlash = async (state: boolean) => {
    if (!stream) return;
    
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities?.().torch) {
        await videoTrack.applyConstraints({
          advanced: [{ torch: state }]
        });
        setFlashActive(state);
      }
    } catch (error) {
      console.error('Error toggling flash:', error);
    }
  };
  
  // Swipe handlers for mobile
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (facingMode === 'environment') switchCamera();
    },
    onSwipedRight: () => {
      if (facingMode === 'user') switchCamera();
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });

  if (!isCameraSupported) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <svg 
              className="w-16 h-16 text-red-500 mx-auto" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Camera Not Supported</h3>
            <p className="mt-2 text-sm text-gray-500">
              Your device or browser doesn't support camera access.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Camera view */}
      <div 
        className="relative flex-1 flex items-center justify-center bg-black overflow-hidden"
        {...swipeHandlers}
      >
        {/* Video element with orientation handling */}
        <div className={`relative w-full h-full ${
          screenOrientation.includes('landscape') ? 'landscape-camera' : 'portrait-camera'
        }`}>
          <video 
            ref={videoRef}
            autoPlay 
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Flash overlay for visual feedback */}
          {isCapturing && (
            <div className="absolute inset-0 bg-white animate-flash"></div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="absolute inset-x-0 top-16 flex justify-center">
              <div className="bg-red-500 text-white text-sm px-4 py-2 rounded-full shadow-lg">
                {error}
              </div>
            </div>
          )}
          
          {/* Camera switch hint */}
          {isMobile && (
            <div className="absolute inset-x-0 top-4 flex justify-center">
              <div className="bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded-full">
                Swipe to switch camera
              </div>
            </div>
          )}
          
          {/* Camera UI overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-2 border-white border-opacity-20 rounded-lg m-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 border-2 border-white border-opacity-40 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Camera controls */}
      <div className="bg-black px-4 pb-8 pt-4">
        <div className="flex items-center justify-between">
          {/* Close button */}
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          
          {/* Capture button */}
          <button
            onClick={capturePhoto}
            disabled={isCapturing || !stream}
            className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center ${
              isCapturing ? 'opacity-50' : ''
            }`}
          >
            <div className="w-12 h-12 bg-white rounded-full"></div>
          </button>
          
          {/* Camera switch button */}
          <button
            onClick={switchCamera}
            className="w-12 h-12 flex items-center justify-center text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
            </svg>
          </button>
        </div>
        
        {/* Flash control - only show if available */}
        {hasFlash && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => toggleFlash(!flashActive)}
              className={`px-4 py-2 rounded-full flex items-center text-sm ${
                flashActive 
                  ? 'bg-yellow-500 text-black' 
                  : 'bg-gray-800 text-white'
              }`}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              {flashActive ? 'Flash On' : 'Flash Off'}
            </button>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        .animate-flash {
          animation: flash 0.3s ease-out;
        }
        
        .landscape-camera {
          transform: ${screenOrientation.includes('landscape-primary') 
            ? 'rotate(0deg)' 
            : screenOrientation.includes('landscape-secondary') 
              ? 'rotate(180deg)' 
              : 'rotate(0deg)'};
        }
        
        .portrait-camera {
          /* No rotation needed for portrait mode */
        }
      `}</style>
    </div>
  );
}