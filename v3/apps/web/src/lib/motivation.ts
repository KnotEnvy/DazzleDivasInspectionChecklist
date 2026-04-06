// ─── Daily Motivation Engine ───────────────────────────────────────────
// Deterministic daily message picker — everyone on the team sees the same
// message each day, creating a shared moment. The pool is large enough
// (~100 messages) that it takes over three months to cycle.

export type MessageCategory =
  | "hype"
  | "appreciation"
  | "teamwork"
  | "purpose"
  | "lighthearted";

export interface MotivationMessage {
  text: string;
  category: MessageCategory;
}

// ── Message Pool ──────────────────────────────────────────────────────

const MESSAGES: MotivationMessage[] = [
  // ── Hype / Energy ──
  { text: "Today is your day to shine. Let's get after it.", category: "hype" },
  { text: "You didn't come this far to only come this far.", category: "hype" },
  { text: "Bring that energy today — the kind that's contagious.", category: "hype" },
  { text: "Nobody does it like you. That's not a pep talk, that's a fact.", category: "hype" },
  { text: "New day, new rooms, new wins. Let's go.", category: "hype" },
  { text: "You're built for days like this.", category: "hype" },
  { text: "Show today who's boss.", category: "hype" },
  { text: "The world needs people who take pride in their work. That's you.", category: "hype" },
  { text: "Champions don't wait for motivation — they create it. You're up.", category: "hype" },
  { text: "Small steps, big impact. Every room matters.", category: "hype" },
  { text: "You've got the skills, the drive, and the team behind you.", category: "hype" },
  { text: "Make it happen. You always do.", category: "hype" },
  { text: "Your hustle speaks louder than words ever could.", category: "hype" },
  { text: "Every great day starts with the decision to show up. You're here.", category: "hype" },
  { text: "Turn today into something you're proud of.", category: "hype" },
  { text: "Go-mode: activated.", category: "hype" },
  { text: "Today's forecast: 100% chance of you crushing it.", category: "hype" },
  { text: "Consistency is your superpower. Keep stacking those wins.", category: "hype" },
  { text: "Every room you walk into is about to look better. That's a promise.", category: "hype" },
  { text: "You've handled tough days before. Today doesn't stand a chance.", category: "hype" },

  // ── Appreciation ──
  { text: "What you do matters more than you know. Thank you.", category: "appreciation" },
  { text: "This team wouldn't be the same without you.", category: "appreciation" },
  { text: "Your hard work doesn't go unnoticed. We see you.", category: "appreciation" },
  { text: "Thank you for bringing your best — it makes all the difference.", category: "appreciation" },
  { text: "The details you catch? That's what sets you apart.", category: "appreciation" },
  { text: "You're the reason clients keep coming back.", category: "appreciation" },
  { text: "Every home you touch becomes someone's happy place. That's powerful.", category: "appreciation" },
  { text: "Your standards are what make this team great.", category: "appreciation" },
  { text: "Not everyone can do what you do. Seriously.", category: "appreciation" },
  { text: "You make the hard stuff look easy. That takes real talent.", category: "appreciation" },
  { text: "The effort you put in today builds the reputation we all share.", category: "appreciation" },
  { text: "Your consistency is something special. Don't ever underestimate that.", category: "appreciation" },
  { text: "Behind every five-star review is someone like you doing the real work.", category: "appreciation" },
  { text: "You're more valuable to this team than any checklist could show.", category: "appreciation" },
  { text: "We're lucky to have you. Full stop.", category: "appreciation" },
  { text: "Your work ethic inspires the people around you.", category: "appreciation" },
  { text: "You bring something to this team that no one else can.", category: "appreciation" },
  { text: "Thank you for caring about the little things. They add up.", category: "appreciation" },
  { text: "You don't just clean — you transform spaces. That's a gift.", category: "appreciation" },
  { text: "This team is better because you're on it.", category: "appreciation" },

  // ── Teamwork ──
  { text: "Together we make every property shine. Let's do this.", category: "teamwork" },
  { text: "Your team has your back today. Let's win together.", category: "teamwork" },
  { text: "Great things happen when great people work together.", category: "teamwork" },
  { text: "We're all pulling in the same direction. That's powerful.", category: "teamwork" },
  { text: "The Dazzle Divas crew doesn't just show up — we show out.", category: "teamwork" },
  { text: "When one of us wins, we all win.", category: "teamwork" },
  { text: "Teamwork makes the dream work — and this team dreams big.", category: "teamwork" },
  { text: "Lean on the team when you need to. That's what we're here for.", category: "teamwork" },
  { text: "We rise by lifting each other. Today is no different.", category: "teamwork" },
  { text: "You're never alone on a tough day. This crew rolls together.", category: "teamwork" },
  { text: "Every clean today is a team effort. Let's make it count.", category: "teamwork" },
  { text: "The strongest teams are built on trust. We trust you.", category: "teamwork" },
  { text: "Side by side or property by property — we're in this together.", category: "teamwork" },
  { text: "Your teammates are counting on you, and you never let them down.", category: "teamwork" },
  { text: "One team. One standard. Let's raise the bar again.", category: "teamwork" },

  // ── Purpose ──
  { text: "Every room you clean is someone's fresh start.", category: "purpose" },
  { text: "You make homes feel like home. That's no small thing.", category: "purpose" },
  { text: "Someone is going to walk in today and smile because of your work.", category: "purpose" },
  { text: "Clean spaces change how people feel. You're changing lives.", category: "purpose" },
  { text: "There's dignity in every detail. Your work has meaning.", category: "purpose" },
  { text: "A clean home is a peaceful home. You bring that peace.", category: "purpose" },
  { text: "Guests will never know your name, but they'll feel your care.", category: "purpose" },
  { text: "You're building something bigger than today's checklist.", category: "purpose" },
  { text: "The pride you take in your work creates trust that lasts.", category: "purpose" },
  { text: "What seems routine to you is extraordinary to the people you serve.", category: "purpose" },
  { text: "You create first impressions that make guests feel welcome.", category: "purpose" },
  { text: "Every sparkling surface tells a story of someone who cared.", category: "purpose" },
  { text: "When you care about your craft, people feel it. They always feel it.", category: "purpose" },
  { text: "You set the stage for someone's best day. That matters.", category: "purpose" },
  { text: "Your work is the handshake before anyone says a word.", category: "purpose" },

  // ── Lighthearted ──
  { text: "Sparkle on, superstar. Those rooms aren't going to dazzle themselves.", category: "lighthearted" },
  { text: "Coffee: check. Attitude: unstoppable. Let's roll.", category: "lighthearted" },
  { text: "Plot twist: you're the main character today.", category: "lighthearted" },
  { text: "Dust bunnies, your time is up.", category: "lighthearted" },
  { text: "Professional sparkle specialist reporting for duty.", category: "lighthearted" },
  { text: "Fun fact: you make this team look good. Like, really good.", category: "lighthearted" },
  { text: "May your day be as spotless as the rooms you leave behind.", category: "lighthearted" },
  { text: "Ready, set, dazzle.", category: "lighthearted" },
  { text: "You're about to make some rooms very, very happy.", category: "lighthearted" },
  { text: "Breaking news: local hero makes everything shine. Again.", category: "lighthearted" },
  { text: "Today's power-up: activated. Side effects include awesomeness.", category: "lighthearted" },
  { text: "On a scale of 1 to dazzling, you're off the charts.", category: "lighthearted" },
  { text: "If clean was a competition, you'd need a trophy room by now.", category: "lighthearted" },
  { text: "Step 1: show up. Step 2: be amazing. You're already on step 2.", category: "lighthearted" },
  { text: "Your vibe today? Unstoppable with a side of sparkle.", category: "lighthearted" },
];

// ── Deterministic Daily Pick ──────────────────────────────────────────
// Uses a simple hash of the date string so everyone sees the same message
// on the same day, but it feels random across days.

function dateSeed(date: Date = new Date()): number {
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getDailyMessage(date?: Date): MotivationMessage {
  const seed = dateSeed(date);
  return MESSAGES[seed % MESSAGES.length]!;
}

// ── Time-of-Day Greeting ──────────────────────────────────────────────

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Early bird";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Burning the midnight oil";
}

// ── Category Icon ─────────────────────────────────────────────────────
// Returns a small emoji-style label for visual variety in the banner.

const CATEGORY_ICONS: Record<MessageCategory, string> = {
  hype: "fire",
  appreciation: "heart",
  teamwork: "hands",
  purpose: "star",
  lighthearted: "sparkles",
};

export function getCategoryIcon(category: MessageCategory): string {
  return CATEGORY_ICONS[category];
}

export const MESSAGE_COUNT = MESSAGES.length;
