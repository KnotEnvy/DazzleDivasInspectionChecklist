import { ReactNode } from "react";

type ButterflyEmptyStateProps = {
  eyebrow?: string;
  heading: string;
  description: string;
  action?: ReactNode;
  animated?: boolean;
};

export function ButterflyEmptyState({
  eyebrow,
  heading,
  description,
  action,
  animated = false,
}: ButterflyEmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-border bg-[linear-gradient(180deg,#fffdf8_0%,#fff7e8_100%)] p-6 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className={`butterfly-scene ${animated ? "butterfly-scene-animated" : ""}`}>
          <div className="butterfly-sparkle butterfly-sparkle-cyan butterfly-sparkle-left" />
          <div className="butterfly-sparkle butterfly-sparkle-pink butterfly-sparkle-right" />
          <div className="butterfly-sparkle butterfly-sparkle-navy butterfly-sparkle-top-left" />
          <div className="butterfly-sparkle butterfly-sparkle-navy butterfly-sparkle-top-right" />
          <div className="butterfly-gem" />
          <div className="butterfly-z butterfly-z-1">Z</div>
          <div className="butterfly-z butterfly-z-2">Z</div>
          <div className="butterfly-z butterfly-z-3">Z</div>
          <div className="butterfly">
            <ButterflyIcon />
          </div>
        </div>

        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">{eyebrow}</p>
        ) : null}
        <h3 className="mt-3 text-2xl font-bold text-slate-900">{heading}</h3>
        <p className="mt-2 max-w-sm text-sm text-slate-600">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export function ButterflyIcon() {
  return (
    <svg
      viewBox="0 0 160 148"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="butterfly-svg"
    >
      <defs>
        {/* Upper wing: pink outer edge flowing to deep magenta */}
        <linearGradient id="bfWingOuter" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="35%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#be185d" />
        </linearGradient>
        {/* Inner upper wing: bright cyan matching logo */}
        <linearGradient id="bfWingCyan" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="40%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        {/* Lower wing inner: warm yellow accent */}
        <linearGradient id="bfWingYellow" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        {/* Body: dark navy */}
        <linearGradient id="bfBody" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0a1628" />
        </linearGradient>
        {/* Subtle wing sheen */}
        <linearGradient id="bfSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.45" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ── Left wings ── */}
      <g className="butterfly-wing-l">
        {/* Upper left wing – outer pink */}
        <path
          d="M76,58 C62,22 22,-6 6,18 C-6,38 16,70 76,76 Z"
          fill="url(#bfWingOuter)"
          stroke="#0f2b47"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Upper left wing – inner cyan */}
        <path
          d="M74,60 C62,32 32,10 20,26 C12,38 28,64 74,72 Z"
          fill="url(#bfWingCyan)"
        />
        {/* Upper left wing – sheen highlight */}
        <path
          d="M72,62 C62,38 36,18 24,30 C18,38 32,58 72,68 Z"
          fill="url(#bfSheen)"
        />
        {/* Lower left wing – outer pink */}
        <path
          d="M76,76 C56,80 18,92 22,114 C26,130 58,122 76,92 Z"
          fill="url(#bfWingOuter)"
          stroke="#0f2b47"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Lower left wing – inner yellow */}
        <path
          d="M74,80 C58,84 30,94 32,108 C34,118 54,114 74,90 Z"
          fill="url(#bfWingYellow)"
        />
      </g>

      {/* ── Right wings (mirrored) ── */}
      <g className="butterfly-wing-r">
        {/* Upper right wing – outer pink */}
        <path
          d="M84,58 C98,22 138,-6 154,18 C166,38 144,70 84,76 Z"
          fill="url(#bfWingOuter)"
          stroke="#0f2b47"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Upper right wing – inner cyan */}
        <path
          d="M86,60 C98,32 128,10 140,26 C148,38 132,64 86,72 Z"
          fill="url(#bfWingCyan)"
        />
        {/* Upper right wing – sheen highlight */}
        <path
          d="M88,62 C98,38 124,18 136,30 C142,38 128,58 88,68 Z"
          fill="url(#bfSheen)"
        />
        {/* Lower right wing – outer pink */}
        <path
          d="M84,76 C104,80 142,92 138,114 C134,130 102,122 84,92 Z"
          fill="url(#bfWingOuter)"
          stroke="#0f2b47"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Lower right wing – inner yellow */}
        <path
          d="M86,80 C102,84 130,94 128,108 C126,118 106,114 86,90 Z"
          fill="url(#bfWingYellow)"
        />
      </g>

      {/* ── Body ── */}
      <ellipse
        cx="80"
        cy="72"
        rx="4.5"
        ry="22"
        fill="url(#bfBody)"
        stroke="#0a2240"
        strokeWidth="1.5"
      />

      {/* ── Antennae with circle tips ── */}
      <path
        d="M77,52 C71,36 56,18 46,10"
        fill="none"
        stroke="#0f2b47"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="46" cy="10" r="3" fill="none" stroke="#0f2b47" strokeWidth="2" />
      <path
        d="M83,52 C89,36 104,18 114,10"
        fill="none"
        stroke="#0f2b47"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="114" cy="10" r="3" fill="none" stroke="#0f2b47" strokeWidth="2" />
    </svg>
  );
}
