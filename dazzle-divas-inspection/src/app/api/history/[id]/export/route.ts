import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

// We need to install:
// npm install pdfmake xlsx csv-stringify
// Import these dynamically because they're server-only
let pdfMake: any;
let csv: any;

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
    
    // Parse query parameters
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'pdf';
    
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
    
    // Process for export
    // Calculate completion metrics
    const totalRooms = inspection.roomInspections.length;
    const completedRooms = inspection.roomInspections.filter(
      ri => ri.status === 'COMPLETED'
    ).length;
    
    let totalTasks = 0;
    let completedTasks = 0;
    
    inspection.roomInspections.forEach(ri => {
      totalTasks += ri.taskResults.length;
      completedTasks += ri.taskResults.filter(tr => tr.completed).length;
    });
    
    const totalPhotos = inspection.roomInspections.reduce(
      (sum, ri) => sum + ri.photos.length, 
      0
    );
    
    const reportData = {
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
    
    // Generate requested format
    if (format === 'csv') {
      // Dynamically import csv-stringify
      if (!csv) {
        const csvModule = await import('csv-stringify/sync');
        csv = csvModule.stringify;
      }
      
      // Create flattened data for tasks and rooms
      const csvRows: any[] = [];
      
      // Add header row with inspection details
      csvRows.push({
        'Inspection ID': reportData.id,
        'Property': reportData.propertyName,
        'Address': reportData.propertyAddress,
        'Property Type': reportData.propertyType,
        'Status': reportData.status,
        'Created Date': new Date(reportData.createdAt).toLocaleDateString(),
        'Inspector': reportData.inspectorName,
        'Inspector Email': reportData.inspectorEmail,
        'Rooms Completed': reportData.roomsCompleted,
        'Completion %': `${reportData.completionPercentage}%`,
        'Tasks Completed': reportData.tasksCompleted,
        'Tasks Completion %': `${reportData.taskCompletion}%`,
        'Total Photos': reportData.photoCount,
      });
      
      // Add rows for each room and task
      reportData.rooms.forEach(room => {
        if (room.tasks.length > 0) {
          room.tasks.forEach(task => {
            csvRows.push({
              'Inspection ID': reportData.id,
              'Property': reportData.propertyName,
              'Room': room.name,
              'Room Status': room.status,
              'Task': task.description,
              'Task Completed': task.completed ? 'Yes' : 'No',
              'Photos': room.photoCount,
              'Notes': room.notes,
            });
          });
        } else {
          // Room with no tasks
          csvRows.push({
            'Inspection ID': reportData.id,
            'Property': reportData.propertyName,
            'Room': room.name,
            'Room Status': room.status,
            'Task': 'N/A',
            'Task Completed': 'N/A',
            'Photos': room.photoCount,
            'Notes': room.notes,
          });
        }
      });
      
      // Generate CSV
      const csvContent = csv(csvRows, { header: true });
      
      // Return CSV as a file
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="inspection_report_${reportData.propertyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (format === 'excel') {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create summary worksheet
      const summaryData = [
        ['Inspection Report'],
        ['Property', reportData.propertyName],
        ['Address', reportData.propertyAddress],
        ['Property Type', reportData.propertyType],
        ['Status', reportData.status],
        ['Date', new Date(reportData.createdAt).toLocaleDateString()],
        ['Last Updated', new Date(reportData.updatedAt).toLocaleDateString()],
        ['Inspector', reportData.inspectorName],
        ['Inspector Email', reportData.inspectorEmail],
        ['Rooms Completed', reportData.roomsCompleted],
        ['Completion Percentage', `${reportData.completionPercentage}%`],
        ['Tasks Completed', reportData.tasksCompleted],
        ['Task Completion', `${reportData.taskCompletion}%`],
        ['Total Photos', reportData.photoCount],
      ];
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      // Create rooms worksheet
      const roomsData = [
        ['Room', 'Status', 'Photo Count', 'Notes'],
      ];
      
      reportData.rooms.forEach(room => {
        roomsData.push([
          room.name,
          room.status,
          room.photoCount.toString(),
          room.notes,
        ]);
      });
      
      const roomsWs = XLSX.utils.aoa_to_sheet(roomsData);
      XLSX.utils.book_append_sheet(wb, roomsWs, 'Rooms');
      
      // Create tasks worksheet
      const tasksData = [
        ['Room', 'Task', 'Completed'],
      ];
      
      reportData.rooms.forEach(room => {
        room.tasks.forEach(task => {
          tasksData.push([
            room.name,
            task.description,
            task.completed ? 'Yes' : 'No',
          ]);
        });
      });
      
      const tasksWs = XLSX.utils.aoa_to_sheet(tasksData);
      XLSX.utils.book_append_sheet(wb, tasksWs, 'Tasks');
      
      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Return Excel file
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="inspection_report_${reportData.propertyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
            columns: [
              {
                width: '*',
                text: [
                  { text: 'Property: ', bold: true },
                  reportData.propertyName,
                ]
              },
              {
                width: 'auto',
                text: [
                  { text: 'Date: ', bold: true },
                  new Date(reportData.createdAt).toLocaleDateString(),
                ],
                alignment: 'right',
              }
            ],
            margin: [0, 0, 0, 10],
          },
          {
            columns: [
              {
                width: '*',
                text: [
                  { text: 'Address: ', bold: true },
                  reportData.propertyAddress,
                ]
              },
              {
                width: 'auto',
                text: [
                  { text: 'Status: ', bold: true },
                  reportData.status,
                ],
                alignment: 'right',
              }
            ],
            margin: [0, 0, 0, 10],
          },
          {
            columns: [
              {
                width: '*',
                text: [
                  { text: 'Inspector: ', bold: true },
                  reportData.inspectorName,
                ]
              },
              {
                width: 'auto',
                text: [
                  { text: 'Completion: ', bold: true },
                  `${reportData.completionPercentage}%`,
                ],
                alignment: 'right',
              }
            ],
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
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  'Metric', 'Value', 'Completed', 'Percentage'
                ],
                [
                  'Rooms', 
                  `${totalRooms} total`, 
                  `${completedRooms} completed`,
                  `${reportData.completionPercentage}%`
                ],
                [
                  'Tasks', 
                  `${totalTasks} total`, 
                  `${completedTasks} completed`,
                  `${reportData.taskCompletion}%`
                ],
                [
                  'Photos', 
                  `${totalPhotos} total`, 
                  '', 
                  ''
                ],
              ],
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 20],
          },
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
          },
          subheader: {
            fontSize: 16,
            bold: true,
          },
          roomHeader: {
            fontSize: 14,
            bold: true,
            margin: [0, 10, 0, 5],
          },
        },
      };
      
      // Add room details sections
      reportData.rooms.forEach(room => {
        docDefinition.content.push(
          {
            text: `Room: ${room.name}`,
            style: 'roomHeader',
            pageBreak: 'before',
          },
          {
            columns: [
              {
                width: '*',
                text: `Status: ${room.status}`
              },
              {
                width: 'auto',
                text: `Photos: ${room.photoCount}`
              }
            ],
            margin: [0, 0, 0, 10],
          }
        );
        
        // Add tasks table if there are tasks
        if (room.tasks.length > 0) {
          docDefinition.content.push(
            {
              text: 'Tasks:',
              bold: true,
              margin: [0, 5, 0, 5],
            },
            {
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
            }
          );
        }
        
        // Add notes if any
        if (room.notes && room.notes !== 'No notes') {
          docDefinition.content.push(
            {
              text: 'Notes:',
              bold: true,
              margin: [0, 5, 0, 5],
            },
            {
              text: room.notes,
              margin: [0, 0, 0, 10],
            }
          );
        }
      });
      
      // Generate PDF
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      
      // Convert to buffer
      return new Promise((resolve) => {
        pdfDocGenerator.getBuffer((buffer: Buffer) => {
          resolve(new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="inspection_report_${reportData.propertyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`,
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