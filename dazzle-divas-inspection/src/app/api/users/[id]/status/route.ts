import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// PUT: Update user status (active/inactive)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is an admin
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = params.id;
    const { isActive } = await req.json();
    
    // Validate the request
    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean value' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Prevent deactivating the last admin
    if (!isActive && existingUser.role === 'ADMIN') {
      // Count active admins
      const adminCount = await prisma.user.count({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
      });
      
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot deactivate the last admin user' },
          { status: 400 }
        );
      }
    }
    
    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
    
    // If deactivating a user, also deactivate all of their property assignments
    if (!isActive) {
      await prisma.propertyAssignment.updateMany({
        where: { inspectorId: userId, isActive: true },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });
    }
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}