import { forwardRef, type InputHTMLAttributes } from 'react'
import { Label } from '@/components/atoms/Label'
import { Input } from '@/components/atoms/Input'
import { ErrorMessage } from '@/components/atoms/ErrorMessage'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
  required?: boolean
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, required, id, ...inputProps }, ref) => {
    const fieldId = id || label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
        <Input
          ref={ref}
          id={fieldId}
          hasError={!!error}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...inputProps}
        />
        <ErrorMessage message={error} />
      </div>
    )
  }
)

FormField.displayName = 'FormField'
