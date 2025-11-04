import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "produce"
  | "dairy"
  | "meat"
  | "bakery"
  | "pantry"
  | "frozen"
  | "beverages"
  | "household"
  | "other"
  | "default";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  produce: "bg-green-100 text-green-800 border-green-200",
  dairy: "bg-blue-100 text-blue-800 border-blue-200",
  meat: "bg-red-100 text-red-800 border-red-200",
  bakery: "bg-amber-100 text-amber-800 border-amber-200",
  pantry: "bg-yellow-100 text-yellow-800 border-yellow-200",
  frozen: "bg-cyan-100 text-cyan-800 border-cyan-200",
  beverages: "bg-purple-100 text-purple-800 border-purple-200",
  household: "bg-gray-100 text-gray-800 border-gray-200",
  other: "bg-slate-100 text-slate-800 border-slate-200",
  default: "bg-gray-100 text-gray-800 border-gray-200",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border",
        "transition-colors",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
