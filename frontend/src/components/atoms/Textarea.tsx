import { forwardRef, type Ref } from 'react'
import { useFormContext, type RegisterOptions } from 'react-hook-form'
import { InputWrapper } from '@/components/molecules/InputWrapper'
import { cn } from '@/lib/utils'

export interface TextareaProps {
  description?: string
  disabled?: boolean
  hideLabel?: boolean
  id?: string
  label?: string
  name: string
  placeholder?: string
  required?: boolean | string
  rows?: number
  rules?: Pick<
    RegisterOptions,
    'maxLength' | 'minLength' | 'validate' | 'required' | 'pattern'
  >
  textareaProps?: React.TextareaHTMLAttributes<HTMLTextareaElement>
}

/**
 * This component is a React Hook Form wrapper for the textarea element.
 * It uses useFormContext to automatically register with the form.
 */
export const Textarea = forwardRef(function Textarea(
  {
    description = '',
    disabled = false,
    hideLabel = false,
    id = '',
    label = '',
    name,
    placeholder = '',
    required = false,
    rows = 3,
    rules = {},
    textareaProps = {},
    ...rest
  }: TextareaProps,
  ref: Ref<HTMLTextareaElement>
) {
  const {
    register,
    formState: { errors },
  } = useFormContext()

  const error = errors[name]
  const errorMessage = error?.message as string | undefined

  const requiredMessage =
    typeof required === 'string' ? required : required ? 'This field is required' : false

  const { ref: rhfRef, ...rhfRest } = register(name, {
    required: requiredMessage,
    ...rules,
  })

  const baseClasses = cn(
    'block w-full rounded-md border-0 py-1.5 mt-2',
    'text-gray-900 shadow-sm ring-1 ring-inset',
    'placeholder:text-gray-400',
    'focus:ring-2 focus:ring-inset focus:ring-primary-600',
    'sm:text-sm sm:leading-6',
    'resize-none',
    errorMessage
      ? 'text-red-900 ring-red-300 focus:ring-red-500'
      : 'ring-gray-300'
  )

  const textareaId = id || name

  return (
    <InputWrapper
      description={description}
      disabled={disabled}
      error={errorMessage}
      hideLabel={hideLabel}
      label={label}
      id={textareaId}
      required={Boolean(required)}
    >
      <textarea
        {...(description && {
          'aria-describedby': `${textareaId}-description`,
        })}
        aria-invalid={Boolean(errorMessage)}
        aria-required={Boolean(required)}
        id={textareaId}
        rows={rows}
        className={baseClasses}
        placeholder={placeholder}
        disabled={disabled}
        {...textareaProps}
        {...rhfRest}
        {...rest}
        ref={(e) => {
          rhfRef(e)
          if (ref && e) {
            ;(ref as React.MutableRefObject<HTMLTextareaElement>).current = e
          }
        }}
      />
    </InputWrapper>
  )
})
