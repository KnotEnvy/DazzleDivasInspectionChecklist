import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dazzledivas.com' },
    update: {},
    create: {
      email: 'admin@dazzledivas.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create inspector user
  const inspectorPassword = await bcrypt.hash('inspector123', 10);
  const inspector = await prisma.user.upsert({
    where: { email: 'inspector@dazzledivas.com' },
    update: {},
    create: {
      email: 'inspector@dazzledivas.com',
      name: 'Inspector User',
      password: inspectorPassword,
      role: 'INSPECTOR',
    },
  });

  console.log('Created users:', { admin, inspector });

  // Create properties
  const properties = [
    {
      name: 'Oceanview Villa',
      address: '123 Seaside Dr, Miami, FL 33101',
      description: 'Luxury beachfront villa with pool',
      propertyType: 'RESIDENTIAL',
      bedrooms: 4,
      bathrooms: 3,
    },
    {
      name: 'Downtown Loft',
      address: '456 Urban St, Miami, FL 33130',
      description: 'Modern loft in downtown area',
      propertyType: 'RESIDENTIAL',
      bedrooms: 2,
      bathrooms: 2,
    },
    {
      name: 'Garden Apartments',
      address: '789 Green Ave, Miami, FL 33125',
      description: 'Apartment complex with garden views',
      propertyType: 'RESIDENTIAL',
      bedrooms: 2,
      bathrooms: 1,
    },
    {
      name: 'Sunset Office Building',
      address: '101 Business Blvd, Miami, FL 33131',
      description: 'Commercial office building',
      propertyType: 'COMMERCIAL',
    },
  ];

  for (const propertyData of properties) {
    const property = await prisma.property.create({
      data: propertyData,
    });
    console.log(`Created property: ${property.name}`);

    // Assign properties to inspector
    if (property.propertyType === 'RESIDENTIAL') {
      await prisma.propertyAssignment.create({
        data: {
          propertyId: property.id,
          inspectorId: inspector.id,
        },
      });
      console.log(`Assigned ${property.name} to inspector`);
    }
  }

  // Create rooms
  const rooms = [
    {
      name: 'Backyard',
      description: 'Outdoor area behind the property',
      tasks: [
        { description: 'Clean patio' },
        { description: 'Arrange chairs' },
        { description: 'Sweep leaves' },
      ],
    },
    {
      name: 'Bathroom 1',
      description: 'Main bathroom',
      tasks: [
        { description: 'Make sure cabinets, drawers, and trash cans are all clean and presentable' },
        { description: 'Towel bar and shower curtain rods are secure and curtain/towels are free of mold or stains' },
        { description: 'The toilet flushes and is clean and the hot water works' },
      ],
    },
    {
      name: 'Bedroom 1',
      description: 'Master bedroom',
      tasks: [
        { description: 'All appliances are operational – tvs, lights, lamps, fans, etc.' },
        { description: 'All linens are free of stains and the beds are made' },
        { description: 'All surfaces are clean, this includes floors, window sills, blinds, and ceiling fans' },
      ],
    },
    {
      name: 'Entrance',
      description: 'Main entrance area',
      tasks: [
        { description: 'Clean door' },
        { description: 'Polish doorknob' },
        { description: 'Sweep floor' },
      ],
    },
    {
      name: 'General',
      description: 'General property items',
      tasks: [
        { description: 'Turn on/off AC or Heat depending on season' },
        { description: 'Check the HVAC vents for mold or dust throughout the house' },
        { description: 'Confirm that all windows and doors are properly closed and locked' },
        { description: 'All entertainment equipment such as big screen TVs, video game consoles, arcade-style gaming devices are secure' },
        { description: 'Confirm that the supply closet has sufficient toiletries' },
      ],
    },
    {
      name: 'Kitchen',
      description: 'Kitchen and dining area',
      tasks: [
        { description: 'Check drawers' },
        { description: 'All Surfaces wiped and clear' },
        { description: 'Inside fridge, microwave, oven etc. clean' },
      ],
    },
    {
      name: 'Living Room',
      description: 'Main living area',
      tasks: [
        { description: 'All lights are functional' },
        { description: 'Pillows on couches are straightened' },
        { description: 'Carpets are vacuumed' },
      ],
    },
    {
      name: 'Washer/Dryer',
      description: 'Laundry area',
      tasks: [
        { description: 'Clean lint trap' },
        { description: 'Wipe surfaces' },
      ],
    },
  ];

  for (const roomData of rooms) {
    const room = await prisma.room.upsert({
      where: { name: roomData.name },
      update: {
        description: roomData.description,
      },
      create: {
        name: roomData.name,
        description: roomData.description,
      },
    });

    console.log(`Created room: ${room.name}`);

    // Create tasks for each room
    for (const taskData of roomData.tasks) {
      const task = await prisma.task.create({
        data: {
          description: taskData.description,
          roomId: room.id,
        },
      });
      console.log(`Created task: ${task.description}`);
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });