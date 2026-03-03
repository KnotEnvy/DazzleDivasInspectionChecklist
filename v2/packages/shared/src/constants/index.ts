// ============================================================
// Dazzle Divas Inspection App - Constants
// ============================================================

export interface TaskDefinition {
  description: string;
  sortOrder: number;
}

export interface RoomDefinition {
  name: string;
  description?: string;
  sortOrder: number;
  tasks: TaskDefinition[];
}

/**
 * Predefined rooms and their inspection tasks.
 * These are seeded into the database and serve as templates
 * when creating new inspections.
 */
export const PREDEFINED_ROOMS: RoomDefinition[] = [
  {
    name: "Backyard",
    sortOrder: 1,
    tasks: [
      { description: "Clean patio", sortOrder: 1 },
      { description: "Arrange chairs", sortOrder: 2 },
      { description: "Sweep leaves", sortOrder: 3 },
    ],
  },
  {
    name: "Bathroom 1",
    sortOrder: 2,
    tasks: [
      {
        description:
          "Make sure cabinets, drawers, and trash cans are all clean and presentable",
        sortOrder: 1,
      },
      {
        description:
          "Towel bar and shower curtain rods are secure and curtain/towels are free of mold or stains",
        sortOrder: 2,
      },
      {
        description:
          "The toilet flushes and is clean and the hot water works",
        sortOrder: 3,
      },
    ],
  },
  {
    name: "Bedroom 1",
    sortOrder: 3,
    tasks: [
      {
        description:
          "All appliances are operational – tvs, lights, lamps, fans, etc.",
        sortOrder: 1,
      },
      {
        description:
          "All linens are free of stains and the beds are made",
        sortOrder: 2,
      },
      {
        description:
          "All surfaces are clean, this includes floors, window sills, blinds, and ceiling fans",
        sortOrder: 3,
      },
    ],
  },
  {
    name: "Entrance",
    sortOrder: 4,
    tasks: [
      { description: "Clean door", sortOrder: 1 },
      { description: "Polish doorknob", sortOrder: 2 },
      { description: "Sweep floor", sortOrder: 3 },
    ],
  },
  {
    name: "General",
    sortOrder: 5,
    tasks: [
      {
        description: "Turn on/off AC or Heat depending on season",
        sortOrder: 1,
      },
      {
        description:
          "Check the HVAC vents for mold or dust throughout the house",
        sortOrder: 2,
      },
      {
        description:
          "Confirm that all windows and doors are properly closed and locked",
        sortOrder: 3,
      },
      {
        description:
          "All entertainment equipment such as big screen TVs, video game consoles, arcade-style gaming devices are secure",
        sortOrder: 4,
      },
      {
        description:
          "Confirm that the supply closet has sufficient toiletries",
        sortOrder: 5,
      },
    ],
  },
  {
    name: "Kitchen",
    sortOrder: 6,
    tasks: [
      { description: "Check drawers", sortOrder: 1 },
      { description: "All Surfaces wiped and clear", sortOrder: 2 },
      {
        description: "Inside fridge, microwave, oven etc. clean",
        sortOrder: 3,
      },
    ],
  },
  {
    name: "Living Room",
    sortOrder: 7,
    tasks: [
      { description: "All lights are functional", sortOrder: 1 },
      {
        description: "Pillows on couches are straightened",
        sortOrder: 2,
      },
      { description: "Carpets are vacuumed", sortOrder: 3 },
    ],
  },
  {
    name: "Washer/Dryer",
    sortOrder: 8,
    tasks: [
      { description: "Clean lint trap", sortOrder: 1 },
      { description: "Wipe surfaces", sortOrder: 2 },
    ],
  },
];

/** Minimum photos required per room before completion */
export const MIN_PHOTOS_PER_ROOM = 2;

/** Maximum file size for photo uploads (10MB) */
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

/** Accepted image MIME types */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Image compression target dimensions */
export const COMPRESSED_MAX_WIDTH = 1920;
export const COMPRESSED_MAX_HEIGHT = 1080;
export const COMPRESSED_QUALITY = 80;

/** Offline storage keys */
export const STORAGE_KEYS = {
  INSPECTIONS: "dazzle-divas-offline-inspections",
  SYNC_QUEUE: "dazzle-divas-sync-queue",
  USER_DATA: "dazzle-divas-user-data",
} as const;

/** Default seed users */
export const SEED_USERS = {
  admin: {
    email: "admin@dazzledivas.com",
    name: "Admin User",
    password: "admin123",
    role: "ADMIN" as const,
  },
  inspector: {
    email: "inspector@dazzledivas.com",
    name: "Inspector User",
    password: "inspector123",
    role: "INSPECTOR" as const,
  },
};

/** Default seed properties */
export const SEED_PROPERTIES = [
  {
    name: "Oceanview Villa",
    address: "123 Seaside Dr, Miami, FL 33101",
    description: "Luxury beachfront villa with pool",
    propertyType: "RESIDENTIAL" as const,
    bedrooms: 4,
    bathrooms: 3,
    assignToInspector: true,
  },
  {
    name: "Downtown Loft",
    address: "456 Urban St, Miami, FL 33130",
    description: "Modern loft in downtown area",
    propertyType: "RESIDENTIAL" as const,
    bedrooms: 2,
    bathrooms: 2,
    assignToInspector: true,
  },
  {
    name: "Garden Apartments",
    address: "789 Green Ave, Miami, FL 33125",
    description: "Apartment complex with garden views",
    propertyType: "RESIDENTIAL" as const,
    bedrooms: 2,
    bathrooms: 1,
    assignToInspector: true,
  },
  {
    name: "Sunset Office Building",
    address: "101 Business Blvd, Miami, FL 33131",
    description: "Commercial office building",
    propertyType: "COMMERCIAL" as const,
    assignToInspector: false,
  },
];
