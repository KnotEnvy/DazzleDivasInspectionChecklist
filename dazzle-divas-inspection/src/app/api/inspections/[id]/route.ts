import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const inspectionId = params.id;
    
    // Get inspection with room inspections
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        roomInspections: {
          include: {
            room: true,
            taskResults: true,
            photos: true,
          },
        },
      },
    });
    
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }
    
    // Transform the data for the frontend
    const transformedInspection = {
      ...inspection,
      roomInspections: inspection.roomInspections.map(ri => ({
        id: ri.id,
        roomId: ri.roomId,
        room: ri.room,
        status: ri.status,
        taskResultsCount: ri.taskResults.length,
        completedTasksCount: ri.taskResults.filter(tr => tr.completed).length,
        photosCount: ri.photos.length,
      })),
    };
    
    return NextResponse.json(transformedInspection);
  } catch (error) {
    console.error('Error fetching inspection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspection' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const inspectionId = params.id;
    const { status } = await req.json();
    
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }
    
    const updatedInspection = await prisma.inspection.update({
      where: { id: inspectionId },
      data: { status },
    });
    
    return NextResponse.json(updatedInspection);
  } catch (error) {
    console.error('Error updating inspection:', error);
    return NextResponse.json(
      { error: 'Failed to update inspection' },
      { status: 500 }
    );
  }
}