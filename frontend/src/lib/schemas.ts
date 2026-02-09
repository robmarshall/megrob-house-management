import { z } from 'zod'

// Category enum for shopping list items
const categoryEnum = [
  'fruitveg',
  'dairy',
  'meat',
  'fish',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'household',
  'toiletries',
  'medicine',
  'other',
  'default'
] as const

// Unit enum for shopping list items
const unitEnum = ['g', 'kg', 'ml', 'L', 'oz', 'lb', 'pcs', 'pack', 'can', 'bottle', 'bunch', 'bag'] as const

export type UnitType = typeof unitEnum[number]

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
  category: z.enum(categoryEnum).optional(),
  quantity: z.number().positive('Quantity must be positive').default(1),
  unit: z.string().max(20, 'Unit must be less than 20 characters').optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  position: z.number().int('Position must be an integer').nonnegative('Position must be non-negative').default(0),
})

export type CreateShoppingListItemFormData = z.infer<typeof createShoppingListItemSchema>

export const updateShoppingListItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100, 'Name must be less than 100 characters').optional(),
  category: z.enum(categoryEnum).optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unit: z.string().max(20, 'Unit must be less than 20 characters').optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  checked: z.boolean().optional(),
  position: z.number().int('Position must be an integer').nonnegative('Position must be non-negative').optional(),
})

export type UpdateShoppingListItemFormData = z.infer<typeof updateShoppingListItemSchema>

// Quick Add Item Schema (for AddItemInput component)
export const quickAddItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100, 'Name must be less than 100 characters'),
  category: z.enum(categoryEnum).or(z.literal('')).optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unit: z.enum(unitEnum).or(z.literal('')).optional(),
})

export type QuickAddItemFormData = z.infer<typeof quickAddItemSchema>

// Recipe Schemas

const difficultyEnum = ['easy', 'medium', 'hard'] as const
const categoryTypeEnum = ['meal_type', 'dietary', 'allergen'] as const

export const recipeIngredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  quantity: z.number().positive().optional().or(z.literal('')),
  unit: z.string().optional(),
  notes: z.string().optional(),
})

export type RecipeIngredientFormData = z.infer<typeof recipeIngredientSchema>

export const recipeCategorySchema = z.object({
  type: z.enum(categoryTypeEnum),
  value: z.string().min(1),
})

export type RecipeCategoryFormData = z.infer<typeof recipeCategorySchema>

// Instruction step schema - using object for proper useFieldArray support
export const recipeInstructionSchema = z.object({
  step: z.string().min(1, 'Instruction step is required'),
})

export type RecipeInstructionFormData = z.infer<typeof recipeInstructionSchema>

export const createRecipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  servings: z.number().int().positive('Servings must be a positive number'),
  prepTimeMinutes: z.number().int().nonnegative().optional().or(z.literal('')),
  cookTimeMinutes: z.number().int().nonnegative().optional().or(z.literal('')),
  difficulty: z.enum(difficultyEnum).optional(),
  cuisine: z.string().max(50).optional(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
  ingredients: z.array(recipeIngredientSchema).min(1, 'At least one ingredient is required'),
  instructions: z.array(recipeInstructionSchema).min(1, 'At least one instruction step is required'),
  categories: z.array(recipeCategorySchema).optional(),
})

export type CreateRecipeFormData = z.infer<typeof createRecipeSchema>

/** Data shape after RecipeForm transforms instructions from { step }[] to string[] */
export type RecipeFormSubmitData = Omit<CreateRecipeFormData, 'instructions'> & {
  instructions: string[]
}

export const updateRecipeSchema = createRecipeSchema.partial()

export type UpdateRecipeFormData = z.infer<typeof updateRecipeSchema>

export const importRecipeSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
})

export type ImportRecipeFormData = z.infer<typeof importRecipeSchema>

// User Profile Schemas

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
})

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
