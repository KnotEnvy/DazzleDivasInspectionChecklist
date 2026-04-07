import { useMemo } from "react";
import { getRandomQuip } from "@/lib/loadingQuips";

interface LoadingQuipProps {
  className?: string;
}

export function LoadingQuip({ className = "" }: LoadingQuipProps) {
  const quip = useMemo(() => getRandomQuip(), []);

  return (
    <div className={`flex items-center justify-center gap-2 p-8 text-center ${className}`}>
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-400" />
      <p className="text-sm font-medium text-slate-500">{quip}</p>
    </div>
  );
}
