// src/lib/uploadConfig.ts

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// Base upload directory path
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

// Function to create middleware that serves static files from uploads directory
export function createUploadsMiddleware() {
  return async function uploadsMiddleware(req: NextRequest) {
    const { pathname } = new URL(req.url);
    
    // Check if the request is for a file in the uploads directory
    if (pathname.startsWith('/uploads/')) {
      try {
        const filePath = path.join(process.cwd(), pathname);
        
        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        
        // Read the file content
        const fileContent = fs.readFileSync(filePath);
        
        // Determine the MIME type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (ext === '.jpg' || ext === '.jpeg') {
          contentType = 'image/jpeg';
        } else if (ext === '.png') {
          contentType = 'image/png';
        } else if (ext === '.gif') {
          contentType = 'image/gif';
        } else if (ext === '.webp') {
          contentType = 'image/webp';
        }
        
        // Return the file content with the appropriate content type
        return new NextResponse(fileContent, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      } catch (error) {
        console.error('Error serving file:', error);
        return NextResponse.json({ error: 'Error serving file' }, { status: 500 });
      }
    }
    
    // Pass through for other requests
    return NextResponse.next();
  };
}

// Create the uploads directory if it doesn't exist
export function ensureUploadsDirectory() {
  const uploadDir = path.join(process.cwd(), UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created uploads directory at ${uploadDir}`);
  }
}