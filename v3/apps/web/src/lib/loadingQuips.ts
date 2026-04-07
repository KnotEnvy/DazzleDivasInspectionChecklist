// ─── Fun Loading Quips ────────────────────────────────────────────────
// Cleaning-themed messages that replace boring "Loading..." text.
// Each mount picks a random quip so it feels alive.

const QUIPS = [
  "Dusting off your schedule...",
  "Polishing today's jobs...",
  "Fluffing the pillows on your task list...",
  "Tidying up the details...",
  "Sweeping through the data...",
  "Buffing things to a shine...",
  "Organizing your day...",
  "Mopping up the last bits...",
  "Spritzing the schedule with sparkle...",
  "Folding the corners just right...",
  "Wiping down the dashboard...",
  "Scrubbing the loading screen...",
  "Making things spotless for you...",
  "Vacuuming up the loose ends...",
  "Freshening up your view...",
  "Arranging everything just so...",
  "Giving your screen the white-glove treatment...",
  "Rolling out the clean carpet...",
  "Shining up the details...",
  "Deep-cleaning your dashboard...",
  "Sanitizing the schedule...",
  "Prepping your workspace...",
  "Straightening things out...",
  "Adding the finishing touches...",
  "Almost sparkling...",
];

/** Returns a random quip. Stable for the lifetime of the caller. */
export function getRandomQuip(): string {
  return QUIPS[Math.floor(Math.random() * QUIPS.length)]!;
}

export const QUIP_COUNT = QUIPS.length;
