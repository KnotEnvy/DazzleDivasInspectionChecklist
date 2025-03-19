import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { propertyName, propertyId } = await req.json();
    
    if (!propertyName) {
      return NextResponse.json({ error: 'Property name is required' }, { status: 400 });
    }
    
    // Create a new inspection
    const inspection = await prisma.inspection.create({
      data: {
        propertyName,
        propertyId,
        inspectorId: session.user.id,
      },
    });
    
    // Get all rooms from the database
    const rooms = await prisma.room.findMany();
    
    // Create room inspections for each room
    await Promise.all(
      rooms.map(async (room) => {
        // Create room inspection
        const roomInspection = await prisma.roomInspection.create({
          data: {
            roomId: room.id,
            inspectionId: inspection.id,
          },
        });
        
        // Get tasks for the room
        const tasks = await prisma.task.findMany({
          where: { roomId: room.id },
        });
        
        // Create task results for each task
        await Promise.all(
          tasks.map(async (task) => {
            await prisma.taskResult.create({
              data: {
                taskId: task.id,
                roomInspectionId: roomInspection.id,
              },
            });
          })
        );
      })
    );
    
    return NextResponse.json(inspection, { status: 201 });
  } catch (error) {
    console.error('Error creating inspection:', error);
    return NextResponse.json(
      { error: 'Failed to create inspection' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const inspections = await prisma.inspection.findMany({
      where: {
        inspectorId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json(inspections);
  } catch (error) {
    console.error('Error fetching inspections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspections' },
      { status: 500 }
    );
  }
}