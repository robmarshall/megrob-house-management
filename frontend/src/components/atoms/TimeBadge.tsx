import { ClockIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface TimeBadgeProps {
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  compact?: boolean;
  className?: string;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function TimeBadge({
  prepTimeMinutes,
  cookTimeMinutes,
  compact = false,
  className,
}: TimeBadgeProps) {
  const prep = prepTimeMinutes ?? 0;
  const cook = cookTimeMinutes ?? 0;
  const total = prep + cook;

  if (total === 0) return null;

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm text-gray-600", className)}>
        <ClockIcon className="w-4 h-4" />
        {formatMinutes(total)}
      </span>
    );
  }

  const parts: string[] = [];
  if (prep > 0) parts.push(`${formatMinutes(prep)} prep`);
  if (cook > 0) parts.push(`${formatMinutes(cook)} cook`);

  return (
    <span className={cn("inline-flex items-center gap-1 text-sm text-gray-600", className)}>
      <ClockIcon className="w-4 h-4 flex-shrink-0" />
      <span>{parts.join(" | ")}</span>
    </span>
  );
}
