import { useFormContext, type RegisterOptions } from 'react-hook-form'
import { InputWrapper } from '@/components/molecules/InputWrapper'
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
 * React Hook Form integrated checkbox component.
 * Uses useFormContext for automatic registration with forms.
 * Must be used within a FormProvider context.
 *
 * Note: Supports HTML in labels for links.
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

  const inputClasses = cn(
    'h-4 w-4 rounded border text-primary-600 focus:ring-primary-600',
    errorMessage ? 'border-red-300' : 'border-gray-300'
  )

  const labelContainerClasses = cn(
    'block text-sm leading-6',
    small ? 'ml-2 text-xs' : 'ml-3 text-sm'
  )

  const requiredMessage =
    typeof required === 'string' ? required : required ? 'This field is required' : false

  return (
    <InputWrapper
      id={id}
      error={inGroup ? undefined : errorMessage}
      disabled={disabled}
      required={Boolean(required)}
    >
      <div className={cn('relative flex items-start', large && 'mb-2')}>
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
        <div className={labelContainerClasses}>
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
    </InputWrapper>
  )
}
