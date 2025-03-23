import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// We need to install:
// npm install pdfmake xlsx csv-stringify
// Import these dynamically because they're server-only
let pdfMake: any;
let csv: any;

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    const status = url.searchParams.get('status');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const format = url.searchParams.get('format') || 'pdf';
    
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
    
    // Get inspections with all related data
    const inspections = await prisma.inspection.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        inspector: {
          select: {
            name: true,
            email: true,
          },
        },
        property: {
          select: {
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
    
    // Transform data for reporting
    const reportData = inspections.map(inspection => {
      // Calculate completion metrics
      const totalRooms = inspection.roomInspections.length;
      const completedRooms = inspection.roomInspections.filter(
        ri => ri.status === 'COMPLETED'
      ).length;
      
      // Calculate tasks
      let totalTasks = 0;
      let completedTasks = 0;
      
      inspection.roomInspections.forEach(ri => {
        totalTasks += ri.taskResults.length;
        completedTasks += ri.taskResults.filter(tr => tr.completed).length;
      });
      
      // Get total photo count
      const totalPhotos = inspection.roomInspections.reduce(
        (sum, ri) => sum + ri.photos.length, 
        0
      );
      
      return {
        id: inspection.id,
        propertyName: inspection.propertyName,
        propertyAddress: inspection.property?.address || 'N/A',
        propertyType: inspection.property?.propertyType || 'N/A',
        status: inspection.status,
        createdAt: inspection.createdAt,
        updatedAt: inspection.updatedAt,
        inspectorName: inspection.inspector.name,
        inspectorEmail: inspection.inspector.email,
        roomsCompleted: `${completedRooms}/${totalRooms}`,
        completionPercentage: totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0,
        tasksCompleted: `${completedTasks}/${totalTasks}`,
        taskCompletion: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        photoCount: totalPhotos,
        rooms: inspection.roomInspections.map(ri => ({
          name: ri.room.name,
          status: ri.status,
          notes: ri.notes || 'No notes',
          tasks: ri.taskResults.map(tr => ({
            description: tr.task.description,
            completed: tr.completed,
          })),
          photoCount: ri.photos.length,
        })),
      };
    });
    
    // Generate requested format
    if (format === 'csv') {
      // Dynamically import csv-stringify
      if (!csv) {
        const csvModule = await import('csv-stringify/sync');
        csv = csvModule.stringify;
      }
      
      // Flatten the data for CSV
      const flatData = reportData.map(report => ({
        ID: report.id,
        Property: report.propertyName,
        Address: report.propertyAddress,
        Type: report.propertyType,
        Status: report.status,
        'Created Date': new Date(report.createdAt).toLocaleDateString(),
        Inspector: report.inspectorName,
        'Rooms Completed': report.roomsCompleted,
        'Completion %': `${report.completionPercentage}%`,
        'Tasks Completed': report.tasksCompleted,
        'Tasks Completion %': `${report.taskCompletion}%`,
        'Total Photos': report.photoCount,
      }));
      
      // Generate CSV
      const csvContent = csv(flatData, { header: true });
      
      // Return CSV as a file
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="inspection_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (format === 'excel') {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create main summary worksheet
      const summaryData = reportData.map(report => [
        report.id,
        report.propertyName,
        report.propertyAddress,
        report.status,
        new Date(report.createdAt).toLocaleDateString(),
        report.inspectorName,
        report.roomsCompleted,
        `${report.completionPercentage}%`,
        report.tasksCompleted,
        `${report.taskCompletion}%`,
        report.photoCount,
      ]);
      
      // Add header row
      summaryData.unshift([
        'ID', 'Property', 'Address', 'Status', 'Date', 'Inspector',
        'Rooms', 'Completion %', 'Tasks', 'Task Completion %', 'Photos'
      ]);
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      // Create details worksheet with all room and task data
      const detailsData: any[] = [];
      
      // Add header row for details
      detailsData.push([
        'Inspection ID', 'Property', 'Room', 'Room Status', 
        'Task', 'Task Completed', 'Photo Count', 'Notes'
      ]);
      
      // Add detailed data
      reportData.forEach(report => {
        report.rooms.forEach(room => {
          if (room.tasks.length > 0) {
            room.tasks.forEach(task => {
              detailsData.push([
                report.id,
                report.propertyName,
                room.name,
                room.status,
                task.description,
                task.completed ? 'Yes' : 'No',
                room.photoCount,
                room.notes,
              ]);
            });
          } else {
            // Room with no tasks
            detailsData.push([
              report.id,
              report.propertyName,
              room.name,
              room.status,
              'N/A',
              'N/A',
              room.photoCount,
              room.notes,
            ]);
          }
        });
      });
      
      const detailsWs = XLSX.utils.aoa_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(wb, detailsWs, 'Details');
      
      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Return Excel file
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="inspection_report_${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    } else {
      // Default to PDF
      // Dynamically import pdfmake
      if (!pdfMake) {
        pdfMake = (await import('pdfmake/build/pdfmake')).default;
        const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
        pdfMake.vfs = pdfFonts.pdfMake.vfs;
      }
      
      // Create document definition
      const docDefinition = {
        content: [
          {
            text: 'Dazzle Divas Inspection Report',
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 20],
          },
          {
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            alignment: 'right',
            margin: [0, 0, 0, 20],
          },
          // Summary section
          {
            text: 'Inspection Summary',
            style: 'subheader',
            margin: [0, 10, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                ['Property', 'Inspector', 'Status', 'Date', 'Rooms', 'Completion'],
                ...reportData.map(report => [
                  report.propertyName,
                  report.inspectorName,
                  report.status,
                  new Date(report.createdAt).toLocaleDateString(),
                  report.roomsCompleted,
                  `${report.completionPercentage}%`,
                ]),
              ],
            },
            layout: 'lightHorizontalLines',
          },
        ],
        // Detailed sections for each inspection
        styles: {
          header: {
            fontSize: 22,
            bold: true,
          },
          subheader: {
            fontSize: 16,
            bold: true,
          },
          propertyHeader: {
            fontSize: 14,
            bold: true,
            margin: [0, 15, 0, 5],
          },
          roomHeader: {
            fontSize: 12,
            bold: true,
            margin: [0, 10, 0, 5],
          },
        },
      };
      
      // Add detailed sections for each inspection
      reportData.forEach(report => {
        docDefinition.content.push(
          {
            text: `Property: ${report.propertyName}`,
            style: 'propertyHeader',
            pageBreak: 'before',
          },
          {
            text: `Address: ${report.propertyAddress}`,
          },
          {
            text: `Inspector: ${report.inspectorName}`,
            margin: [0, 5, 0, 0],
          },
          {
            text: `Date: ${new Date(report.createdAt).toLocaleDateString()}`,
            margin: [0, 0, 0, 5],
          },
          {
            columns: [
              { 
                width: 'auto',
                text: `Status: ${report.status}` 
              },
              { 
                width: 'auto',
                text: `Rooms: ${report.roomsCompleted}` 
              },
              { 
                width: 'auto',
                text: `Overall Completion: ${report.completionPercentage}%` 
              },
            ],
            columnGap: 10,
            margin: [0, 0, 0, 10],
          },
        );
        
        // Add room details
        report.rooms.forEach(room => {
          docDefinition.content.push(
            {
              text: `Room: ${room.name}`,
              style: 'roomHeader',
            },
            {
              text: `Status: ${room.status}`,
              margin: [0, 0, 0, 5],
            },
          );
          
          // Add tasks table if there are tasks
          if (room.tasks.length > 0) {
            docDefinition.content.push({
              table: {
                headerRows: 1,
                widths: ['*', 'auto'],
                body: [
                  ['Task', 'Completed'],
                  ...room.tasks.map(task => [
                    task.description,
                    task.completed ? 'Yes' : 'No',
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
              margin: [0, 0, 0, 10],
            });
          }
          
          // Add notes
          if (room.notes !== 'No notes') {
            docDefinition.content.push({
              text: 'Notes:',
              bold: true,
              margin: [0, 5, 0, 0],
            });
            
            docDefinition.content.push({
              text: room.notes,
              margin: [0, 0, 0, 10],
            });
          }
          
          // Add photo count
          docDefinition.content.push({
            text: `Photos: ${room.photoCount}`,
            margin: [0, 0, 0, 15],
          });
        });
      });
      
      // Generate PDF
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      
      // Convert to buffer
      return new Promise((resolve) => {
        pdfDocGenerator.getBuffer((buffer: Buffer) => {
          resolve(new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="inspection_report_${new Date().toISOString().split('T')[0]}.pdf"`,
            },
          }));
        });
      });
    }
  } catch (error) {
    console.error('Error generating export:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}