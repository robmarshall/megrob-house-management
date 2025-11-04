import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const resetPasswordRequestSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
})

export type ResetPasswordRequestFormData = z.infer<typeof resetPasswordRequestSchema>

export const resetPasswordConfirmSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type ResetPasswordConfirmFormData = z.infer<typeof resetPasswordConfirmSchema>

// Shopping List Schemas

export const createShoppingListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

export type CreateShoppingListFormData = z.infer<typeof createShoppingListSchema>

export const updateShoppingListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'Name must be less than 100 characters').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

export type UpdateShoppingListFormData = z.infer<typeof updateShoppingListSchema>

// Shopping List Item Schemas

export const createShoppingListItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100, 'Name must be less than 100 characters'),
  category: z.string().max(50, 'Category must be less than 50 characters').optional(),
  quantity: z.number().positive('Quantity must be positive').default(1),
  unit: z.string().max(20, 'Unit must be less than 20 characters').optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  position: z.number().int('Position must be an integer').nonnegative('Position must be non-negative').default(0),
})

export type CreateShoppingListItemFormData = z.infer<typeof createShoppingListItemSchema>

export const updateShoppingListItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100, 'Name must be less than 100 characters').optional(),
  category: z.string().max(50, 'Category must be less than 50 characters').optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unit: z.string().max(20, 'Unit must be less than 20 characters').optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  checked: z.boolean().optional(),
  position: z.number().int('Position must be an integer').nonnegative('Position must be non-negative').optional(),
})

export type UpdateShoppingListItemFormData = z.infer<typeof updateShoppingListItemSchema>
