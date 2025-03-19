// src/app/api/inspections/[id]/rooms/[roomId]/tasks/route.ts
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
    const { tasks } = await req.json();
    
    // Validate tasks array
    if (!Array.isArray(tasks)) {
      return NextResponse.json({ error: 'Invalid tasks data' }, { status: 400 });
    }
    
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
    
    // Update each task result
    const updatePromises = tasks.map(async (task) => {
      return prisma.taskResult.update({
        where: {
          id: task.id,
        },
        data: {
          completed: task.completed,
        },
      });
    });
    
    await Promise.all(updatePromises);
    
    // Return updated task results
    const updatedTaskResults = await prisma.taskResult.findMany({
      where: {
        roomInspectionId: roomInspection.id,
      },
      include: {
        task: true,
      },
    });
    
    return NextResponse.json(updatedTaskResults);
  } catch (error) {
    console.error('Error updating task results:', error);
    return NextResponse.json(
      { error: 'Failed to update task results' },
      { status: 500 }
    );
  }
}

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
    });
    
    if (!roomInspection) {
      return NextResponse.json({ error: 'Room inspection not found' }, { status: 404 });
    }
    
    // Get all task results for this room inspection
    const taskResults = await prisma.taskResult.findMany({
      where: {
        roomInspectionId: roomInspection.id,
      },
      include: {
        task: true,
      },
    });
    
    return NextResponse.json(taskResults);
  } catch (error) {
    console.error('Error fetching task results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task results' },
      { status: 500 }
    );
  }
}