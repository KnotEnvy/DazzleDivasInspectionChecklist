// src/app/api/inspections/[id]/rooms/[roomId]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function PUT(
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
    
    // Get the room inspection with task results and photos
    const roomInspection = await prisma.roomInspection.findFirst({
      where: {
        inspectionId,
        roomId,
      },
      include: {
        taskResults: true,
        photos: true,
      },
    });
    
    if (!roomInspection) {
      return NextResponse.json({ error: 'Room inspection not found' }, { status: 404 });
    }
    
    // Validate that all tasks are completed
    const allTasksCompleted = roomInspection.taskResults.every(
      (task) => task.completed
    );
    
    if (!allTasksCompleted) {
      return NextResponse.json(
        { error: 'All tasks must be completed before marking the room as complete' },
        { status: 400 }
      );
    }
    
    // Validate that at least 2 photos are uploaded
    if (roomInspection.photos.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 photos must be uploaded before marking the room as complete' },
        { status: 400 }
      );
    }
    
    // Update room inspection status to COMPLETED
    const updatedRoomInspection = await prisma.roomInspection.update({
      where: {
        id: roomInspection.id,
      },
      data: {
        status: 'COMPLETED',
      },
    });
    
    return NextResponse.json(updatedRoomInspection);
  } catch (error) {
    console.error('Error completing room inspection:', error);
    return NextResponse.json(
      { error: 'Failed to complete room inspection' },
      { status: 500 }
    );
  }
}