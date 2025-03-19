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
    
    const propertyId = params.id;
    
    // Get property with assignments
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        assignments: {
          include: {
            inspector: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        inspections: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    });
    
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    
    // If user is an INSPECTOR, check if they have access to this property
    if (session.user.role !== 'ADMIN') {
      const hasAccess = property.assignments.some(
        assignment => assignment.inspectorId === session.user.id && assignment.isActive
      );
      
      if (!hasAccess) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }
    
    return NextResponse.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property' },
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
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const propertyId = params.id;
    const propertyData = await req.json();
    
    // Basic validation
    if (!propertyData.name || !propertyData.address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      );
    }
    
    const property = await prisma.property.update({
      where: { id: propertyId },
      data: propertyData,
    });
    
    return NextResponse.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const propertyId = params.id;
    
    // Check if there are any active inspections for this property
    const activeInspections = await prisma.inspection.findMany({
      where: {
        propertyId: propertyId,
        status: 'IN_PROGRESS',
      },
    });
    
    if (activeInspections.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete property with active inspections' },
        { status: 400 }
      );
    }
    
    // Instead of deleting, mark as inactive
    await prisma.property.update({
      where: { id: propertyId },
      data: { isActive: false },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json(
      { error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}