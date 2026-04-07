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

// Inline gradient styles — Tailwind v4 can't detect dynamically assembled
// utility class names, so we use CSS custom properties directly.
const CATEGORY_GRADIENT: Record<MessageCategory, React.CSSProperties> = {
  hype: {
    background: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(244,63,94,0.08) 100%)",
  },
  appreciation: {
    background: "linear-gradient(135deg, rgba(244,63,94,0.18) 0%, rgba(236,72,153,0.08) 100%)",
  },
  teamwork: {
    background: "linear-gradient(135deg, rgba(236,72,153,0.18) 0%, rgba(99,102,241,0.08) 100%)",
  },
  purpose: {
    background: "linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(236,72,153,0.08) 100%)",
  },
  lighthearted: {
    background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(217,70,239,0.08) 100%)",
  },
};

const CATEGORY_ICON_COLOR: Record<MessageCategory, string> = {
  hype: "#d97706",
  appreciation: "#e11d48",
  teamwork: "#be185d",
  purpose: "#0284c7",
  lighthearted: "#7c3aed",
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
  const gradient = CATEGORY_GRADIENT[message.category];
  const iconColor = CATEGORY_ICON_COLOR[message.category];
  const firstName = userName?.split(" ")[0];

  return (
    <section className="motivation-banner overflow-hidden rounded-2xl border border-border bg-white p-5 relative">
      {/* Gradient glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={gradient}
        aria-hidden
      />

      {/* Floating icon */}
      <div className="motivation-icon-float absolute -right-2 -top-2 pointer-events-none" aria-hidden>
        <Icon
          className="h-28 w-28"
          style={{ color: iconColor, opacity: 0.07 }}
          strokeWidth={1}
        />
      </div>

      <div className="relative">
        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <div className="motivation-icon-pulse flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-black/5">
            <Icon className="h-4 w-4" style={{ color: iconColor }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Daily Spark
          </p>
        </div>

        {/* Greeting */}
        <h1 className="motivation-text-enter mt-3 text-2xl font-bold text-slate-900">
          {greeting}{firstName ? `, ${firstName}` : ""}!
        </h1>

        {/* Message */}
        <p className="motivation-text-enter motivation-text-delay mt-2 text-sm font-medium leading-relaxed text-slate-700">
          {message.text}
        </p>
      </div>
    </section>
  );
}
