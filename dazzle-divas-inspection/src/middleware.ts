// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';

// This middleware handles serving files from the uploads directory
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
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
}

// Only run the middleware on paths that start with /uploads/
export const config = {
  matcher: '/uploads/:path*',
};