// src/lib/image-optimization.ts
import Compressor from 'compressorjs';

/**
 * Compresses an image file for faster uploads on mobile
 * @param file Original image file
 * @returns Promise with compressed file
 */
export const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Skip compression for small files (less than 500KB)
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }
    
    // Get file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Determine quality based on file size
    const fileSize = file.size / (1024 * 1024); // Convert to MB
    let quality = 0.8; // Default quality
    
    if (fileSize > 5) {
      quality = 0.6; // More compression for very large files
    } else if (fileSize > 2) {
      quality = 0.7; // Medium compression for larger files
    }
    
    new Compressor(file, {
      quality,
      maxWidth: 1920, // Limit to 1920px wide - suitable for most displays
      maxHeight: 1080, // Limit to 1080px high
      mimeType: fileExt === 'png' ? 'image/png' : 'image/jpeg',
      convertTypes: ['image/png', 'image/jpeg', 'image/webp'],
      convertSize: 1000000, // Convert large PNGs to JPEGs to save space
      success(result) {
        // Create a new file with the same name
        const compressedFile = new File([result], file.name, {
          type: result.type,
          lastModified: new Date().getTime(),
        });
        resolve(compressedFile);
      },
      error(err) {
        console.error('Image compression error:', err);
        // Fall back to original file if compression fails
        resolve(file);
      },
    });
  });
};

/**
 * Creates a thumbnail version of an image for previews
 * @param file Image file
 * @param maxWidth Maximum width of thumbnail
 * @returns URL for thumbnail preview
 */
export const createImageThumbnail = async (
  file: File,
  maxWidth: number = 300
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate thumbnail dimensions while preserving aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Create canvas and resize image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};
