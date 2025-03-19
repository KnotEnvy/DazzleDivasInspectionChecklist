import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // If user is ADMIN, show all properties
    // If user is INSPECTOR, show only assigned properties
    let properties;
    
    if (session.user.role === 'ADMIN') {
      properties = await prisma.property.findMany({
        orderBy: {
          name: 'asc',
        },
      });
    } else {
      // Get properties assigned to this inspector
      const assignments = await prisma.propertyAssignment.findMany({
        where: {
          inspectorId: session.user.id,
          isActive: true,
        },
        include: {
          property: true,
        },
      });
      
      properties = assignments.map(assignment => assignment.property);
    }
    
    return NextResponse.json(properties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const propertyData = await req.json();
    
    // Basic validation
    if (!propertyData.name || !propertyData.address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      );
    }
    
    const property = await prisma.property.create({
      data: propertyData,
    });
    
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    console.error('Error creating property:', error);
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 }
    );
  }
}