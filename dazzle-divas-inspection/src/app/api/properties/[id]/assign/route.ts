import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST: Assign an inspector to a property
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is an admin
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const propertyId = params.id;
    const { inspectorId } = await req.json();
    
    // Validate required fields
    if (!inspectorId) {
      return NextResponse.json({ error: 'Inspector ID is required' }, { status: 400 });
    }
    
    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    
    // Check if inspector exists and is an actual inspector
    const inspector = await prisma.user.findFirst({
      where: { 
        id: inspectorId,
        role: 'INSPECTOR'
      },
    });
    
    if (!inspector) {
      return NextResponse.json({ error: 'Inspector not found' }, { status: 404 });
    }
    
    // Check if assignment already exists
    const existingAssignment = await prisma.propertyAssignment.findFirst({
      where: {
        propertyId,
        inspectorId,
      },
    });
    
    if (existingAssignment) {
      // If assignment exists but is inactive, reactivate it
      if (!existingAssignment.isActive) {
        const updatedAssignment = await prisma.propertyAssignment.update({
          where: { id: existingAssignment.id },
          data: { 
            isActive: true,
            endDate: null,
            startDate: new Date(),
          },
        });
        
        return NextResponse.json(updatedAssignment);
      }
      
      return NextResponse.json(
        { error: 'Inspector is already assigned to this property' },
        { status: 400 }
      );
    }
    
    // Create new assignment
    const assignment = await prisma.propertyAssignment.create({
      data: {
        propertyId,
        inspectorId,
        startDate: new Date(),
        isActive: true,
      },
    });
    
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error assigning inspector:', error);
    return NextResponse.json(
      { error: 'Failed to assign inspector' },
      { status: 500 }
    );
  }
}

// DELETE: Remove an inspector assignment
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is an admin
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const propertyId = params.id;
    const { inspectorId, assignmentId } = await req.json();
    
    // Validate required fields
    if (!inspectorId) {
      return NextResponse.json({ error: 'Inspector ID is required' }, { status: 400 });
    }
    
    // Find the assignment
    let assignment;
    
    if (assignmentId) {
      // If assignment ID is provided, use it directly
      assignment = await prisma.propertyAssignment.findUnique({
        where: { id: assignmentId },
      });
    } else {
      // Otherwise, look up by property and inspector
      assignment = await prisma.propertyAssignment.findFirst({
        where: {
          propertyId,
          inspectorId,
          isActive: true,
        },
      });
    }
    
    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }
    
    // Instead of deleting, mark as inactive
    const updatedAssignment = await prisma.propertyAssignment.update({
      where: { id: assignment.id },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });
    
    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error('Error removing assignment:', error);
    return NextResponse.json(
      { error: 'Failed to remove assignment' },
      { status: 500 }
    );
  }
}