import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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
    
    // Verify all room inspections are completed
    const roomInspections = await prisma.roomInspection.findMany({
      where: { inspectionId },
    });
    
    const allRoomsCompleted = roomInspections.every(
      (room) => room.status === 'COMPLETED'
    );
    
    if (!allRoomsCompleted) {
      return NextResponse.json(
        { error: 'All rooms must be completed before completing the inspection' },
        { status: 400 }
      );
    }
    
    // Update inspection status to COMPLETED
    const updatedInspection = await prisma.inspection.update({
      where: { id: inspectionId },
      data: { status: 'COMPLETED' },
    });
    
    return NextResponse.json(updatedInspection);
  } catch (error) {
    console.error('Error completing inspection:', error);
    return NextResponse.json(
      { error: 'Failed to complete inspection' },
      { status: 500 }
    );
  }
}