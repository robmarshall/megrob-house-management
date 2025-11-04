import { forwardRef, type ReactNode } from 'react'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'

interface InputWrapperProps {
  actionLabel?: ReactNode
  children: ReactNode
  description?: string | ReactNode
  disabled?: boolean
  error?: string
  hideLabel?: boolean
  label: string
  id: string
  required?: boolean
}

/**
 * Wrapper component for form inputs that adds a label and error message.
 * Based on zenrental pattern for consistent form styling.
 *
 * @param {ReactNode} actionLabel - Add additional action to sit next to the label
 * @param {ReactNode} children - The input element (required)
 * @param {string|ReactNode} description - The description of the input
 * @param {boolean} disabled - If the input is disabled
 * @param {string} error - The error message to display
 * @param {boolean} hideLabel - If the label should be hidden (still accessible)
 * @param {string} label - The label text (required)
 * @param {string} id - The id of the input (required)
 * @param {boolean} required - If the input is required
 */
export const InputWrapper = forwardRef<HTMLDivElement, InputWrapperProps>(
  function InputWrapper(
    {
      actionLabel,
      children,
      description,
      disabled,
      error,
      hideLabel,
      label,
      id,
      required,
    },
    ref
  ) {
    let baseClasses = 'w-full relative'

    if (disabled) baseClasses += ' opacity-50'

    return (
      <div className={baseClasses} ref={ref}>
        <div className={`flex justify-between${hideLabel ? ' sr-only' : ''}`}>
          <label
            htmlFor={id}
            className="block text-sm font-medium leading-6 text-gray-900"
          >
            {label}
            {required && (
              <>
                <span className="text-red-500 ml-1">*</span>
                <span className="sr-only">(Required)</span>
              </>
            )}
          </label>
          {actionLabel && actionLabel}
        </div>
        {description && (
          <p
            id={`${id}-description`}
            className="text-sm leading-6 text-gray-500 mt-1"
          >
            {description}
          </p>
        )}
        {children}
        {error && <ErrorMessage message={error} />}
      </div>
    )
  }
)
