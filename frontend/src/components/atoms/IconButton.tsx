import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  'aria-label': string // Required for accessibility
}

export function IconButton({
  variant = 'default',
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Size variants
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
        // Color variants
        variant === 'default' &&
          'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
        variant === 'danger' &&
          'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500',
        variant === 'ghost' &&
          'bg-transparent text-gray-600 hover:bg-gray-200 focus:ring-gray-500',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
