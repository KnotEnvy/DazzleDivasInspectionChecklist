// Daily Motivation Engine
// Everyone sees the same message each day, creating a shared team moment.

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

function messages(category: MessageCategory, texts: string[]): MotivationMessage[] {
  return texts.map((text) => ({ text, category }));
}

// This second-edition pool is entirely new. At 100 messages, it takes more
// than three months before the daily sequence can repeat.
const MESSAGES: MotivationMessage[] = [
  ...messages("hype", [
    "Walk in ready. The day gets better the moment you get moving.",
    "Fresh schedule, fresh momentum. Go make it yours.",
    "You have everything you need to make today count.",
    "Set the pace, trust your training, and finish proud.",
    "Strong starts are good. Strong finishes are your specialty.",
    "Let your work do the talking today. It always says something great.",
    "There is a win hiding in every room. Go find all of them.",
    "You know the standard. Now go make it look effortless.",
    "Momentum starts with one task. Consider this your starting signal.",
    "Bring focus to the first room and confidence to every room after it.",
    "Today's goal: leave every space better than you found it.",
    "You are capable, prepared, and officially in motion.",
    "A full day is just a collection of small wins. Start collecting.",
    "Make your future self proud of how you handled today.",
    "Energy follows action. Take the first step and let it catch up.",
    "The schedule may be busy, but so is your talent.",
    "You bring the skill. Today brings the opportunity.",
    "Take a breath, pick your first target, and own the day.",
    "Good work is about to happen because you showed up.",
    "Today has your name written all over it. Make it shine.",
  ]),
  ...messages("appreciation", [
    "The care you put into your work reaches people you may never meet.",
    "Your reliability gives the whole team room to breathe. Thank you.",
    "The way you notice details is a real professional gift.",
    "Your effort helps turn busy days into successful ones.",
    "Thank you for being someone the team can count on.",
    "Your work creates comfort, confidence, and a little more calm.",
    "The quality you bring is part of what makes Dazzle Divas special.",
    "Your patience and persistence deserve recognition today.",
    "You make a difference long after the checklist is complete.",
    "The care behind your work is visible in every finished space.",
    "Thank you for carrying the standard with pride.",
    "Your steady effort keeps the entire operation moving forward.",
    "You turn ordinary tasks into work worth being proud of.",
    "The team notices your follow-through, even on the busiest days.",
    "Your professionalism makes clients feel taken care of.",
    "There is real value in doing things well. You prove it daily.",
    "Thank you for bringing both skill and heart to the job.",
    "You make trust possible one completed room at a time.",
    "What you contribute cannot be measured by task count alone.",
    "Your best qualities show up in the details. We appreciate every one.",
  ]),
  ...messages("teamwork", [
    "One crew, many talents, one beautiful result.",
    "Clear communication and helping hands make busy days lighter.",
    "Every person brings a piece of the sparkle. Yours matters.",
    "A quick check-in can turn a tough moment into a team win.",
    "We do our best work when we look out for one another.",
    "Share the load, share the knowledge, share the win.",
    "The strongest part of this schedule is the team working it.",
    "Different properties, same crew, same commitment.",
    "Great teammates make good days better and hard days possible.",
    "Your work supports the person before you and the person after you.",
    "Ask when you need help. Offer when you can. That is how we shine.",
    "A team that communicates early finishes stronger together.",
    "Every handoff is a chance to help a teammate succeed.",
    "Our shared standard is built one thoughtful action at a time.",
    "No one carries the whole day alone around here.",
    "The best team rhythm starts with respect and a little kindness.",
    "Your teammate's win is part of your win too.",
    "When the crew stays connected, the work stays excellent.",
    "Bring your strengths and make space for everyone else's.",
    "Together, we turn a long list into a job well done.",
  ]),
  ...messages("purpose", [
    "A cared-for space tells people they matter before they walk in.",
    "Your work gives every guest a cleaner, calmer beginning.",
    "You create the kind of welcome people can feel instantly.",
    "Every finished room is a promise kept to a client.",
    "A thoughtful clean makes an unfamiliar place feel comfortable.",
    "The work you do today becomes someone else's peace of mind.",
    "You help properties become places people are happy to enter.",
    "Care is not just what you do. It is what people feel afterward.",
    "A beautiful result begins with someone deciding the details matter.",
    "Your craft creates order where people need it most.",
    "The final sparkle is visible. The care behind it is unforgettable.",
    "You give hosts confidence and guests a warm first impression.",
    "Every checklist is really a collection of promises to the next person.",
    "A clean, ready space can change the mood of an entire day.",
    "You make transitions smoother for people you may never see.",
    "The standard you protect today becomes the reputation we carry tomorrow.",
    "A welcoming room begins with the work in your hands.",
    "Your attention creates moments of relief for clients and guests.",
    "You are not just preparing a property. You are preparing an experience.",
    "When the work is done with care, people can tell immediately.",
  ]),
  ...messages("lighthearted", [
    "Cape optional. Excellent work strongly encouraged.",
    "Today's mission: locate the mess and politely show it the exit.",
    "You bring the elbow grease. We will bring the imaginary confetti.",
    "Clean now, happy dance later. Or happy dance while cleaning.",
    "The dust had a good run. Time to wrap it up.",
    "Warning: freshly cleaned rooms may cause excessive smiling.",
    "You are one good playlist away from unstoppable.",
    "Today's dress code: confidence with comfortable shoes.",
    "The rooms have been notified. You are on the way.",
    "Operation Make It Gorgeous is officially underway.",
    "Mess level: temporary. Dazzle level: incoming.",
    "Go forth and leave suspicious amounts of sparkle behind.",
    "Plot update: the cleaning pro wins again.",
    "Your checklist called. It said you make this look easy.",
    "A little music, a little magic, and a lot of clean.",
    "Today's vibe is tidy, talented, and totally on schedule.",
    "If the room could talk, it would already be thanking you.",
    "You handle the details. The sparkle handles the applause.",
    "Mess does not stand a chance against this level of expertise.",
    "Ready when you are, Captain Clean.",
  ]),
];

function dateSeed(date: Date = new Date()): number {
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let index = 0; index < dateStr.length; index += 1) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDailyMessage(date?: Date): MotivationMessage {
  return MESSAGES[dateSeed(date) % MESSAGES.length]!;
}

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Early bird";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Burning the midnight oil";
}

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
