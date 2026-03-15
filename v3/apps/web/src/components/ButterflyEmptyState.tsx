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
            <span className="butterfly-wing butterfly-wing-upper butterfly-wing-upper-left">
              <span className="butterfly-wing-inner butterfly-wing-inner-upper butterfly-wing-inner-cyan" />
              <span className="butterfly-wing-sheen" />
              <span className="butterfly-wing-ridge butterfly-wing-ridge-upper" />
            </span>
            <span className="butterfly-wing butterfly-wing-upper butterfly-wing-upper-right">
              <span className="butterfly-wing-inner butterfly-wing-inner-upper butterfly-wing-inner-cyan" />
              <span className="butterfly-wing-sheen" />
              <span className="butterfly-wing-ridge butterfly-wing-ridge-upper" />
            </span>
            <span className="butterfly-wing butterfly-wing-lower butterfly-wing-lower-left">
              <span className="butterfly-wing-inner butterfly-wing-inner-lower butterfly-wing-inner-yellow" />
              <span className="butterfly-wing-core butterfly-wing-core-lower" />
              <span className="butterfly-wing-sheen" />
              <span className="butterfly-wing-ridge butterfly-wing-ridge-lower" />
            </span>
            <span className="butterfly-wing butterfly-wing-lower butterfly-wing-lower-right">
              <span className="butterfly-wing-inner butterfly-wing-inner-lower butterfly-wing-inner-yellow" />
              <span className="butterfly-wing-core butterfly-wing-core-lower" />
              <span className="butterfly-wing-sheen" />
              <span className="butterfly-wing-ridge butterfly-wing-ridge-lower" />
            </span>
            <span className="butterfly-body" />
            <span className="butterfly-antenna butterfly-antenna-left" />
            <span className="butterfly-antenna butterfly-antenna-right" />
            <span className="butterfly-eye butterfly-eye-left" />
            <span className="butterfly-eye butterfly-eye-right" />
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
