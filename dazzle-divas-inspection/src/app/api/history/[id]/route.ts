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
    
    // Check if user is authenticated
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const inspectionId = params.id;
    
    // Get the inspection with all related data
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        inspector: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            propertyType: true,
          },
        },
        roomInspections: {
          include: {
            room: true,
            taskResults: {
              include: {
                task: true,
              },
            },
            photos: true,
          },
        },
      },
    });
    
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }
    
    // Check permissions - admins can see all, inspectors only their own
    if (
      session.user.role !== 'ADMIN' && 
      inspection.inspectorId !== session.user.id
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    return NextResponse.json(inspection);
  } catch (error) {
    console.error('Error fetching inspection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspection' },
      { status: 500 }
    );
  }
}