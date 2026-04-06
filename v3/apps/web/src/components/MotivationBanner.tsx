import { useMemo } from "react";
import { Flame, Heart, Sparkles, Star, Users } from "lucide-react";
import {
  getDailyMessage,
  getTimeGreeting,
  type MessageCategory,
} from "@/lib/motivation";

const CATEGORY_ICON: Record<MessageCategory, typeof Sparkles> = {
  hype: Flame,
  appreciation: Heart,
  teamwork: Users,
  purpose: Star,
  lighthearted: Sparkles,
};

const CATEGORY_ACCENT: Record<MessageCategory, string> = {
  hype: "from-amber-500/20 to-rose-500/10 text-amber-600",
  appreciation: "from-rose-500/20 to-pink-400/10 text-rose-500",
  teamwork: "from-brand-500/20 to-indigo-400/10 text-brand-600",
  purpose: "from-sky-500/20 to-brand-400/10 text-sky-600",
  lighthearted: "from-violet-500/20 to-fuchsia-400/10 text-violet-500",
};

interface MotivationBannerProps {
  userName?: string;
}

export function MotivationBanner({ userName }: MotivationBannerProps) {
  const { message, greeting } = useMemo(() => {
    return {
      message: getDailyMessage(),
      greeting: getTimeGreeting(),
    };
  }, []);

  const Icon = CATEGORY_ICON[message.category];
  const accentClasses = CATEGORY_ACCENT[message.category];
  const firstName = userName?.split(" ")[0];

  return (
    <section className="motivation-banner rounded-2xl border border-border bg-white p-5 overflow-hidden relative">
      {/* Gradient glow background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accentClasses} opacity-60 pointer-events-none`}
        aria-hidden
      />

      {/* Floating icon */}
      <div className="motivation-icon-float absolute -right-2 -top-2 pointer-events-none" aria-hidden>
        <Icon className={`h-28 w-28 opacity-[0.06] ${accentClasses.split(" ").pop()}`} strokeWidth={1} />
      </div>

      <div className="relative">
        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <div className={`motivation-icon-pulse flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-black/5`}>
            <Icon className={`h-4 w-4 ${accentClasses.split(" ").pop()}`} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Daily Spark
          </p>
        </div>

        {/* Greeting */}
        <h1 className="mt-3 text-2xl font-bold text-slate-900 motivation-text-enter">
          {greeting}{firstName ? `, ${firstName}` : ""}!
        </h1>

        {/* Message */}
        <p className="mt-2 text-sm leading-relaxed text-slate-700 motivation-text-enter motivation-text-delay font-medium">
          {message.text}
        </p>
      </div>
    </section>
  );
}
