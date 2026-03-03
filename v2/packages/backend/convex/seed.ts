import { internalMutation } from "./_generated/server";

/**
 * Seed the database with predefined rooms and tasks.
 * Run via Convex dashboard: `npx convex run seed:seedRoomsAndTasks`
 */
export const seedRoomsAndTasks = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if rooms already exist
    const existingRooms = await ctx.db.query("rooms").take(1);
    if (existingRooms.length > 0) {
      console.log("Rooms already seeded, skipping...");
      return;
    }

    const roomsData = [
      {
        name: "Backyard",
        sortOrder: 1,
        tasks: ["Clean patio", "Arrange chairs", "Sweep leaves"],
      },
      {
        name: "Bathroom 1",
        sortOrder: 2,
        tasks: [
          "Make sure cabinets, drawers, and trash cans are all clean and presentable",
          "Towel bar and shower curtain rods are secure and curtain/towels are free of mold or stains",
          "The toilet flushes and is clean and the hot water works",
        ],
      },
      {
        name: "Bedroom 1",
        sortOrder: 3,
        tasks: [
          "All appliances are operational – tvs, lights, lamps, fans, etc.",
          "All linens are free of stains and the beds are made",
          "All surfaces are clean, this includes floors, window sills, blinds, and ceiling fans",
        ],
      },
      {
        name: "Entrance",
        sortOrder: 4,
        tasks: ["Clean door", "Polish doorknob", "Sweep floor"],
      },
      {
        name: "General",
        sortOrder: 5,
        tasks: [
          "Turn on/off AC or Heat depending on season",
          "Check the HVAC vents for mold or dust throughout the house",
          "Confirm that all windows and doors are properly closed and locked",
          "All entertainment equipment such as big screen TVs, video game consoles, arcade-style gaming devices are secure",
          "Confirm that the supply closet has sufficient toiletries",
        ],
      },
      {
        name: "Kitchen",
        sortOrder: 6,
        tasks: [
          "Check drawers",
          "All Surfaces wiped and clear",
          "Inside fridge, microwave, oven etc. clean",
        ],
      },
      {
        name: "Living Room",
        sortOrder: 7,
        tasks: [
          "All lights are functional",
          "Pillows on couches are straightened",
          "Carpets are vacuumed",
        ],
      },
      {
        name: "Washer/Dryer",
        sortOrder: 8,
        tasks: ["Clean lint trap", "Wipe surfaces"],
      },
    ];

    for (const room of roomsData) {
      const roomId = await ctx.db.insert("rooms", {
        name: room.name,
        sortOrder: room.sortOrder,
      });

      for (let i = 0; i < room.tasks.length; i++) {
        await ctx.db.insert("tasks", {
          description: room.tasks[i],
          roomId,
          sortOrder: i + 1,
        });
      }
    }

    console.log(`Seeded ${roomsData.length} rooms with tasks`);
  },
});

/**
 * Seed demo properties.
 * Run via: `npx convex run seed:seedProperties`
 */
export const seedProperties = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("properties").take(1);
    if (existing.length > 0) {
      console.log("Properties already seeded, skipping...");
      return;
    }

    const properties = [
      {
        name: "Oceanview Villa",
        address: "123 Seaside Dr, Miami, FL 33101",
        description: "Luxury beachfront villa with pool",
        propertyType: "RESIDENTIAL" as const,
        bedrooms: 4,
        bathrooms: 3,
        isActive: true,
      },
      {
        name: "Downtown Loft",
        address: "456 Urban St, Miami, FL 33130",
        description: "Modern loft in downtown area",
        propertyType: "RESIDENTIAL" as const,
        bedrooms: 2,
        bathrooms: 2,
        isActive: true,
      },
      {
        name: "Garden Apartments",
        address: "789 Green Ave, Miami, FL 33125",
        description: "Apartment complex with garden views",
        propertyType: "RESIDENTIAL" as const,
        bedrooms: 2,
        bathrooms: 1,
        isActive: true,
      },
      {
        name: "Sunset Office Building",
        address: "101 Business Blvd, Miami, FL 33131",
        description: "Commercial office building",
        propertyType: "COMMERCIAL" as const,
        isActive: true,
      },
    ];

    for (const prop of properties) {
      await ctx.db.insert("properties", prop);
    }

    console.log(`Seeded ${properties.length} properties`);
  },
});
