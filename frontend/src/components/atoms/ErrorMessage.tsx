import { cn } from '@/lib/utils'

interface ErrorMessageProps {
  message?: string | null
  className?: string
  id?: string
}

export function ErrorMessage({ message, className, id }: ErrorMessageProps) {
  if (!message) return null

  return (
    <p
      className={cn('text-sm text-red-600 mt-1', className)}
      role="alert"
      {...(id && { id })}
    >
      {message}
    </p>
  )
}
