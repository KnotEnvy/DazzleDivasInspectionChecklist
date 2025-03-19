// src/app/api/inspections/[id]/rooms/[roomId]/photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { mkdir } from 'fs/promises';

// Helper function to ensure upload directory exists
async function ensureUploadDir(dirPath: string) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
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
    
    // Set up upload directory - you can change this to use cloud storage in production
    const uploadDir = path.join(process.cwd(), 'uploads', inspectionId, roomId);
    await ensureUploadDir(uploadDir);
    
    // Parse the multipart form data
    const formData = await req.formData();
    const photos = formData.getAll('photos');
    const photoIndices = formData.getAll('photoIndices');
    const deletePhotoIds = formData.getAll('deletePhotoIds');
    
    // Handle photo deletions if any
    if (deletePhotoIds.length > 0) {
      for (const photoId of deletePhotoIds) {
        const photo = await prisma.photo.findUnique({
          where: { id: photoId.toString() },
        });
        
        if (photo) {
          // Delete the file from storage if it exists
          const filePath = path.join(process.cwd(), photo.url.replace(/^\//, ''));
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error('Error deleting file:', error);
          }
          
          // Delete the database record
          await prisma.photo.delete({
            where: { id: photo.id },
          });
        }
      }
    }
    
    // Handle new photo uploads
    const uploadResults = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoIndex = photoIndices[i]?.toString() || '0';
      
      if (photo instanceof File) {
        // Generate a unique filename
        const fileExt = path.extname(photo.name);
        const fileName = `${uuidv4()}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);
        
        // Read the file as buffer
        const buffer = Buffer.from(await photo.arrayBuffer());
        
        // Write the file to disk
        fs.writeFileSync(filePath, buffer);
        
        // Create a relative URL for the file
        const relativeUrl = `/uploads/${inspectionId}/${roomId}/${fileName}`;
        
        // Create a database record for the photo
        const createdPhoto = await prisma.photo.create({
          data: {
            url: relativeUrl,
            fileName: fileName,
            roomInspectionId: roomInspection.id,
          },
        });
        
        uploadResults.push({
          id: createdPhoto.id,
          index: photoIndex,
          url: relativeUrl,
        });
      }
    }
    
    return NextResponse.json({ success: true, photos: uploadResults });
  } catch (error) {
    console.error('Error handling photos:', error);
    return NextResponse.json(
      { error: 'Failed to process photos' },
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
    
    return NextResponse.json(roomInspection.photos);
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}