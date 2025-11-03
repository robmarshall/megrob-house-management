import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes with proper handling of conflicts.
 * Uses clsx for conditional classes and tailwind-merge to resolve conflicts.
 *
 * @example
 * cn('px-2 py-1', condition && 'bg-blue-500', className)
 * cn('text-lg', 'text-sm') // => 'text-sm' (latter wins)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
