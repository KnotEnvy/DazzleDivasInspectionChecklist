import { cn } from "@/components/ui/utils";

interface ProgressBarProps {
  value: number; // 0-100
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  size = "md",
  className,
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const barColor =
    clamped === 100
      ? "bg-emerald-500"
      : clamped >= 50
        ? "bg-primary-500"
        : "bg-amber-500";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex-1 overflow-hidden rounded-full bg-gray-200",
          size === "sm" ? "h-1.5" : "h-2.5"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-muted tabular-nums">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
