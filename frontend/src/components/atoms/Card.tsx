import {
  type ReactNode,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'outlined' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /**
   * When true, the card becomes keyboard-accessible: it renders with
   * `role="button"`, `tabIndex={0}` and activates its `onClick` on
   * Enter/Space. Leave falsy for plain, non-interactive cards (e.g. cards
   * that contain their own nested buttons).
   */
  interactive?: boolean
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  interactive = false,
  className,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ...props
}: CardProps) {
  const handleKeyDown = interactive
    ? (event: KeyboardEvent<HTMLDivElement>) => {
        // Let a caller-provided handler run first; bail if it handled the key.
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          // Prevent Space from scrolling the page.
          if (event.key !== 'Enter') event.preventDefault()
          // A MouseEventHandler is being invoked from a keyboard event here.
          onClick?.(event as unknown as MouseEvent<HTMLDivElement>)
        }
      }
    : onKeyDown

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={interactive ? role ?? 'button' : role}
      tabIndex={interactive ? tabIndex ?? 0 : tabIndex}
      className={cn(
        'bg-white rounded-lg transition-shadow',
        // Variant styles
        variant === 'default' && 'border border-gray-200',
        variant === 'outlined' && 'border-2 border-gray-300',
        variant === 'elevated' && 'shadow-md hover:shadow-lg',
        // Padding styles
        padding === 'none' && 'p-0',
        padding === 'sm' && 'p-3',
        padding === 'md' && 'p-4',
        padding === 'lg' && 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
