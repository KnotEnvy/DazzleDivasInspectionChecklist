// src/lib/fileStorage.ts
import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Base upload directory
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || 'uploads';

/**
 * Ensure the upload directory exists
 */
export async function ensureUploadDir(relativePath: string): Promise<string> {
  const dirPath = path.join(process.cwd(), UPLOAD_BASE_DIR, relativePath);
  
  try {
    await mkdir(dirPath, { recursive: true });
    return dirPath;
  } catch (error) {
    console.error('Error creating upload directory:', error);
    throw new Error('Failed to create upload directory');
  }
}

/**
 * Save a file to disk
 */
export async function saveFile(
  fileBuffer: Buffer,
  fileName: string,
  relativePath: string
): Promise<string> {
  const uploadDir = await ensureUploadDir(relativePath);
  const fileExt = path.extname(fileName);
  const uniqueFileName = `${uuidv4()}${fileExt}`;
  const filePath = path.join(uploadDir, uniqueFileName);
  
  try {
    fs.writeFileSync(filePath, fileBuffer);
    return path.join(UPLOAD_BASE_DIR, relativePath, uniqueFileName);
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error('Failed to save file');
  }
}

/**
 * Delete a file from disk
 */
export function deleteFile(filePath: string): boolean {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Get the URL for a file
 */
export function getFileUrl(relativePath: string): string {
  return `/${relativePath.replace(/^\//, '')}`;
}