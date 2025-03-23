import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const propertyId = url.searchParams.get('propertyId');
    const status = url.searchParams.get('status');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    
    // Build where clause for filtering
    const where: any = {};
    
    // Admin can see all inspections, inspectors only see their own
    if (session.user.role !== 'ADMIN') {
      where.inspectorId = session.user.id;
    }
    
    // Add filters
    if (propertyId) {
      where.propertyId = propertyId;
    }
    
    if (status) {
      where.status = status;
    }
    
    // Date range filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};
      
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      
      if (dateTo) {
        // Set time to end of day for the "to" date
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }
    
    // Get total count for pagination
    const totalCount = await prisma.inspection.count({ where });
    
    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Get paginated inspections with related data
    const inspections = await prisma.inspection.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        inspector: {
          select: {
            name: true,
          },
        },
        roomInspections: {
          include: {
            room: true,
          },
        },
      },
    });
    
    // Transform data for frontend
    const transformedInspections = inspections.map(inspection => {
      // Calculate completion metrics
      const totalRooms = inspection.roomInspections.length;
      const completedRooms = inspection.roomInspections.filter(
        ri => ri.status === 'COMPLETED'
      ).length;
      
      return {
        id: inspection.id,
        propertyName: inspection.propertyName,
        propertyId: inspection.propertyId,
        status: inspection.status,
        createdAt: inspection.createdAt,
        updatedAt: inspection.updatedAt,
        inspectorName: inspection.inspector.name,
        completedRoomsCount: completedRooms,
        totalRoomsCount: totalRooms,
      };
    });
    
    return NextResponse.json({
      inspections: transformedInspections,
      totalCount,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error('Error fetching inspection history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspection history' },
      { status: 500 }
    );
  }
}