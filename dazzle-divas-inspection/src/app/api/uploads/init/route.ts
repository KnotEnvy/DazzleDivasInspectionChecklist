// src/app/api/uploads/init/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

// Ensure the uploads directory exists with proper permissions
function ensureDirectory(dirPath: string): boolean {
  try {
    console.log(`Ensuring directory exists: ${dirPath}`);
    if (!fs.existsSync(dirPath)) {
      // Create directory with 0755 permissions (rwxr-xr-x)
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
      console.log(`Created directory: ${dirPath}`);
    } else {
      console.log(`Directory already exists: ${dirPath}`);
      // Ensure directory has the right permissions
      fs.chmodSync(dirPath, 0o755);
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    return false;
  }
}

// Verify dir is readable by trying to list contents
function verifyDirectoryAccess(dirPath: string): boolean {
  try {
    const files = fs.readdirSync(dirPath);
    console.log(`Directory ${dirPath} is accessible, contains ${files.length} items`);
    return true;
  } catch (error) {
    console.error(`Directory ${dirPath} is not accessible:`, error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow initialization only for authenticated users
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Create base uploads directory
    const baseUploadDir = path.join(process.cwd(), 'uploads');
    const success = ensureDirectory(baseUploadDir);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to create uploads directory' },
        { status: 500 }
      );
    }
    
    // Verify directory access
    const isAccessible = verifyDirectoryAccess(baseUploadDir);
    
    // Create a test file to verify write access
    const testFilePath = path.join(baseUploadDir, 'test.txt');
    try {
      fs.writeFileSync(testFilePath, 'Test file to verify write access');
      console.log(`Test file created: ${testFilePath}`);
      
      // Try to read the test file to verify read access
      const testContent = fs.readFileSync(testFilePath, 'utf8');
      console.log(`Test file is readable, content: ${testContent}`);
      
      // Clean up test file
      fs.unlinkSync(testFilePath);
      console.log(`Test file removed: ${testFilePath}`);
    } catch (error) {
      console.error('Error with test file operations:', error);
      return NextResponse.json(
        { 
          error: 'Failed to verify file system access', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      isAccessible,
      directory: baseUploadDir,
    });
  } catch (error) {
    console.error('Error initializing uploads directory:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize uploads directory',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}