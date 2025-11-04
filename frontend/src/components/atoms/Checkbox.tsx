import { useFormContext, type RegisterOptions } from 'react-hook-form'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'
import { cn } from '@/lib/utils'

interface CheckboxProps {
  disabled?: boolean
  description?: string
  id: string
  inGroup?: boolean
  inputProps?: Record<string, any>
  label: string
  large?: boolean
  small?: boolean
  name: string
  required?: boolean | string
  rules?: RegisterOptions
  value?: string
}

/**
 * This component is a React Hook Form wrapper for the checkbox element.
 * It uses useFormContext to automatically register with the form.
 *
 * Note: If links are needed in the label, they must be passed in as HTML using anchor tags.
 * e.g. label="I agree to the <a href='https://example.com'>terms and conditions</a>."
 */
export function Checkbox({
  disabled = false,
  description = '',
  id,
  inGroup = false,
  inputProps = {},
  label,
  large = false,
  small = false,
  name,
  required = false,
  rules = {},
  value,
}: CheckboxProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext()

  const error = errors[name]
  const errorMessage = error?.message as string | undefined

  let baseClasses = 'sm:col-span-4'
  if (disabled && !inGroup) baseClasses += ' opacity-50'

  let inputClasses = cn(
    'h-4 w-4 rounded border text-primary-600 focus:ring-primary-600',
    errorMessage ? 'border-red-300' : 'border-gray-300'
  )

  let labelClasses = cn(
    'block text-sm leading-6',
    small ? 'ml-2 text-xs' : 'ml-3 text-sm',
    errorMessage ? 'text-gray-900' : 'text-gray-900'
  )

  if (large) {
    baseClasses += ' mb-2'
  }

  const requiredMessage =
    typeof required === 'string' ? required : required ? 'This field is required' : false

  return (
    <div className={baseClasses}>
      <div className="relative flex items-start">
        <div className="flex h-6 items-center">
          <input
            {...(description && {
              'aria-describedby': `${id}-description`,
            })}
            aria-invalid={Boolean(errorMessage)}
            aria-required={Boolean(required)}
            className={inputClasses}
            disabled={disabled}
            id={id}
            type="checkbox"
            value={value}
            {...inputProps}
            {...register(name, {
              required: requiredMessage,
              ...rules,
            })}
          />
        </div>
        <div className={labelClasses}>
          <label
            htmlFor={id}
            dangerouslySetInnerHTML={{ __html: label }}
            className="font-medium leading-6 text-gray-900"
          />
          {description && (
            <p id={`${id}-description`} className="text-gray-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {errorMessage && !inGroup && <ErrorMessage message={errorMessage} />}
    </div>
  )
}
