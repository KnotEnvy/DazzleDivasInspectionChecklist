import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is an admin
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch statistics
    const [userCount, propertyCount, inspectionCount, activeInspectionCount] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Total properties
      prisma.property.count(),
      
      // Total inspections
      prisma.inspection.count(),
      
      // Active inspections
      prisma.inspection.count({
        where: {
          status: 'IN_PROGRESS',
        },
      }),
    ]);
    
    return NextResponse.json({
      userCount,
      propertyCount,
      inspectionCount,
      activeInspectionCount,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    );
  }
}