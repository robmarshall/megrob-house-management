import { type LabelHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  children: ReactNode
}

/**
 * ⚠️ DEPRECATION WARNING: For form inputs, do NOT use this Label component separately.
 * Instead, use the form input atoms (Input, Checkbox, Textarea) which include integrated labels
 * and automatically register with React Hook Form via useFormContext().
 *
 * This Label component should only be used for non-form contexts where you need a standalone label.
 *
 * @example
 * // ❌ INCORRECT - Don't use separate Label with form inputs
 * <Label>Name</Label>
 * <input {...register('name')} />
 *
 * // ✅ CORRECT - Use Input atom with integrated label
 * <FormProvider {...methods}>
 *   <Input name="name" label="Name" required />
 * </FormProvider>
 */
export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn('block text-sm font-medium text-gray-700 mb-1', className)}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}
