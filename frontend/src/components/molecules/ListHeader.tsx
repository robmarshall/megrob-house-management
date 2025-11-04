import { type ReactNode } from 'react'
import { IconButton } from '@/components/atoms/IconButton'

interface ListHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  onBack?: () => void
}

export function ListHeader({ title, description, actions, onBack }: ListHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {onBack && (
          <IconButton
            variant="ghost"
            size="md"
            onClick={onBack}
            aria-label="Go back"
            className="mt-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </IconButton>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{description}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
