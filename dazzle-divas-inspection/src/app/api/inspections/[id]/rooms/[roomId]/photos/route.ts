// src/app/api/inspections/[id]/rooms/[roomId]/photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Helper function to ensure upload directory exists with proper permissions
function ensureUploadDir(dirPath: string): boolean {
  try {
    console.log(`Ensuring photo upload directory exists: ${dirPath}`);
    
    if (!fs.existsSync(dirPath)) {
      // Create directory with 0755 permissions (rwxr-xr-x)
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
      console.log(`Created photo upload directory: ${dirPath}`);
    } else {
      console.log(`Photo upload directory already exists: ${dirPath}`);
      // Ensure directory has the right permissions
      fs.chmodSync(dirPath, 0o755);
    }
    
    // Verify directory is writable
    const testFilePath = path.join(dirPath, 'test.txt');
    fs.writeFileSync(testFilePath, 'Test file');
    console.log(`Created test file at: ${testFilePath}`);
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
    return true;
  } catch (error) {
    console.error(`Error creating photo upload directory ${dirPath}:`, error);
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const inspectionId = params.id;
    const roomId = params.roomId;
    
    console.log(`Processing photos for inspection ${inspectionId}, room ${roomId}`);
    
    // Get the room inspection
    const roomInspection = await prisma.roomInspection.findFirst({
      where: {
        inspectionId,
        roomId,
      },
    });
    
    if (!roomInspection) {
      return NextResponse.json({ error: 'Room inspection not found' }, { status: 404 });
    }
    
    // Set up base upload directory
    const baseUploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(baseUploadDir)) {
      fs.mkdirSync(baseUploadDir, { recursive: true, mode: 0o755 });
    }
    
    // Set up inspection upload directory
    const inspectionUploadDir = path.join(baseUploadDir, inspectionId);
    if (!fs.existsSync(inspectionUploadDir)) {
      fs.mkdirSync(inspectionUploadDir, { recursive: true, mode: 0o755 });
    }
    
    // Set up room upload directory
    const roomUploadDir = path.join(inspectionUploadDir, roomId);
    const dirCreated = ensureUploadDir(roomUploadDir);
    
    if (!dirCreated) {
      return NextResponse.json(
        { error: 'Failed to create upload directory' },
        { status: 500 }
      );
    }
    
    // Parse the multipart form data
    const formData = await req.formData();
    const photos = formData.getAll('photos');
    const photoIndices = formData.getAll('photoIndices');
    const deletePhotoIds = formData.getAll('deletePhotoIds');
    
    console.log(`Processing ${photos.length} new photos and ${deletePhotoIds.length} deletions`);
    
    // Handle photo deletions if any
    if (deletePhotoIds.length > 0) {
      for (const photoId of deletePhotoIds) {
        console.log(`Deleting photo with ID: ${photoId}`);
        const photo = await prisma.photo.findUnique({
          where: { id: photoId.toString() },
        });
        
        if (photo) {
          // Delete the file from storage if it exists
          const filePath = path.join(process.cwd(), photo.url.replace(/^\//, ''));
          console.log(`Attempting to delete file: ${filePath}`);
          
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Deleted file: ${filePath}`);
            } else {
              console.log(`File not found for deletion: ${filePath}`);
            }
          } catch (error) {
            console.error('Error deleting file:', error);
          }
          
          // Delete the database record
          await prisma.photo.delete({
            where: { id: photo.id },
          });
          console.log(`Deleted photo record with ID: ${photo.id}`);
        }
      }
    }
    
    // Handle new photo uploads
    const uploadResults = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoIndex = photoIndices[i]?.toString() || '0';
      
      if (photo instanceof File) {
        console.log(`Processing photo: ${photo.name}, size: ${photo.size} bytes`);
        
        // Generate a unique filename
        const fileExt = path.extname(photo.name) || '.jpg'; // Default to .jpg if no extension
        const fileName = `${uuidv4()}${fileExt}`;
        const filePath = path.join(roomUploadDir, fileName);
        
        console.log(`Saving to: ${filePath}`);
        
        // Read the file as buffer
        const buffer = Buffer.from(await photo.arrayBuffer());
        
        // Write the file to disk
        fs.writeFileSync(filePath, buffer, { mode: 0o644 }); // rw-r--r--
        
        // Verify file was written successfully
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`File saved successfully: ${filePath}, size: ${stats.size} bytes`);
        } else {
          console.error(`Failed to save file: ${filePath}`);
        }
        
        // Create a relative URL for the file
        const relativeUrl = `/uploads/${inspectionId}/${roomId}/${fileName}`;
        
        console.log(`Created relative URL: ${relativeUrl}`);
        
        // Create a database record for the photo
        const createdPhoto = await prisma.photo.create({
          data: {
            url: relativeUrl,
            fileName: fileName,
            roomInspectionId: roomInspection.id,
          },
        });
        
        console.log(`Created photo record with ID: ${createdPhoto.id}`);
        
        uploadResults.push({
          id: createdPhoto.id,
          index: photoIndex,
          url: relativeUrl,
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      photos: uploadResults,
      uploadDir: roomUploadDir 
    });
  } catch (error) {
    console.error('Error handling photos:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process photos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get all photos for a room inspection
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const inspectionId = params.id;
    const roomId = params.roomId;
    
    // Get the room inspection
    const roomInspection = await prisma.roomInspection.findFirst({
      where: {
        inspectionId,
        roomId,
      },
      include: {
        photos: true,
      },
    });
    
    if (!roomInspection) {
      return NextResponse.json({ error: 'Room inspection not found' }, { status: 404 });
    }
    
    // Check if photos exist physically
    const verifiedPhotos = await Promise.all(
      roomInspection.photos.map(async (photo) => {
        const filePath = path.join(process.cwd(), photo.url.replace(/^\//, ''));
        const exists = fs.existsSync(filePath);
        
        return {
          ...photo,
          fileExists: exists
        };
      })
    );
    
    return NextResponse.json(verifiedPhotos);
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}