# Frontend Style Guide

This style guide outlines the standards and conventions for developing frontend components in the Home Management App. Following these guidelines ensures consistency, maintainability, and high-quality code across the project.

## Table of Contents
1. [Component Patterns & Architecture](#component-patterns--architecture)
2. [Styling Conventions](#styling-conventions)

---

## Component Patterns & Architecture

### Atomic Design Methodology

We follow **Atomic Design** principles to organize components into a clear hierarchy:

```
src/components/
├── atoms/       # Basic building blocks (Button, Input, Label)
├── molecules/   # Simple combinations (FormField, Card)
├── organisms/   # Complex components (LoginForm, RecipeCard, ShoppingList)
└── templates/   # Page layouts (AuthLayout, DashboardLayout)
```

**Guidelines:**
- **Atoms**: Single-purpose, highly reusable elements with no dependencies on other components
- **Molecules**: Combine 2-3 atoms, represent simple UI patterns
- **Organisms**: Feature-complete, complex components that may contain atoms, molecules, and business logic
- **Templates**: Define page structure and layout, accept content as props

### File Organization

**Component File Structure:**
```typescript
// ComponentName.tsx
import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

interface ComponentNameProps extends ComponentProps<'element'> {
  // Custom props
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export function ComponentName({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ComponentNameProps) {
  return (
    <element
      className={cn(
        'base-classes',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </element>
  )
}
```

**Key Principles:**
1. **One component per file** - Component name matches file name
2. **Named exports** - Use `export function ComponentName()` instead of default exports
3. **TypeScript first** - All components use TypeScript with proper type definitions
4. **Props extend native elements** - Inherit HTML attributes via `ComponentProps<'element'>`
5. **Forward refs when needed** - For form inputs and focusable elements

### Component API Design

**Props Best Practices:**

```typescript
// ✅ Good: Extend native HTML props
interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

// ✅ Good: Use optional props with defaults
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(/* ... */)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner /> : children}
    </button>
  )
}

// ❌ Bad: Not extending native props
interface ButtonProps {
  text: string
  onClick: () => void
}
```

**Props Naming Conventions:**
- Boolean props: Use `is*`, `has*`, `should*` prefixes (`isLoading`, `hasError`, `shouldAutoFocus`)
- Event handlers: Use `on*` prefix (`onClick`, `onSubmit`, `onChange`)
- Size/variant props: Use string unions for type safety
- Required vs optional: Make props optional unless absolutely required

### Form Handling

**Always use React Hook Form:**

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Define schema
const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof formSchema>

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    // Handle submission
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField
        label="Email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" isLoading={isSubmitting}>
        Sign In
      </Button>
    </form>
  )
}
```

**Form Guidelines:**
- Use Zod for schema validation
- Connect React Hook Form with `zodResolver`
- Display validation errors inline with fields
- Show loading states during submission
- Disable forms during submission
- Handle both client and server errors

### State Management

**Local State:**
```typescript
// ✅ Good: useState for simple component state
const [isOpen, setIsOpen] = useState(false)

// ✅ Good: useReducer for complex state
const [state, dispatch] = useReducer(reducer, initialState)
```

**Global State:**
```typescript
// ✅ Good: React Context for auth, theme, etc.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Accessibility

**Required Practices:**
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`)
- Add ARIA labels when text content isn't descriptive (`aria-label`, `aria-labelledby`)
- Ensure keyboard navigation works (focus states, tab order)
- Provide alternative text for images and icons
- Use proper heading hierarchy (`<h1>` → `<h2>` → `<h3>`)
- Mark required form fields with `aria-required`
- Associate labels with inputs using `htmlFor`

```typescript
// ✅ Good: Accessible form field
<div>
  <label htmlFor="email" className={cn(/* ... */)}>
    Email
    {required && <span aria-label="required">*</span>}
  </label>
  <input
    id="email"
    type="email"
    aria-required={required}
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && <p id="email-error" role="alert">{error}</p>}
</div>
```

---

## Styling Conventions

### Tailwind CSS Guidelines

**Core Principles:**
1. **Tailwind CSS only** - No CSS modules, styled-components, or inline styles
2. **Utility-first approach** - Compose styles using utility classes
3. **Use the `cn()` utility** - For conditional and merged class names
4. **Mobile-first responsive** - Default styles for mobile, use `sm:`, `md:`, `lg:` for larger screens

### The `cn()` Utility Function

**Always use `cn()` for className composition:**

```typescript
import { cn } from '@/lib/utils'

// ✅ Good: Using cn() utility
<button
  className={cn(
    'px-4 py-2 rounded-md font-medium transition-colors',
    variant === 'primary' && 'bg-primary-600 text-white hover:bg-primary-700',
    variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    size === 'sm' && 'text-sm px-3 py-1.5',
    size === 'lg' && 'text-lg px-6 py-3',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  )}
/>

// ❌ Bad: Template string concatenation
<button
  className={`px-4 py-2 ${variant === 'primary' ? 'bg-blue-600' : 'bg-gray-200'} ${className}`}
/>
```

**Benefits of `cn()`:**
- Properly merges conflicting Tailwind classes
- Handles conditional classes cleanly
- Supports arrays and objects
- Type-safe with TypeScript

### Responsive Design

**Mobile-first breakpoints:**
```typescript
// Base styles apply to mobile
// sm: 640px and up (tablets)
// md: 768px and up (small laptops)
// lg: 1024px and up (desktops)
// xl: 1280px and up (large desktops)

<div className={cn(
  'p-4',           // Mobile: 1rem padding
  'sm:p-6',        // Tablet: 1.5rem padding
  'md:p-8',        // Laptop: 2rem padding
  'lg:p-10'        // Desktop: 2.5rem padding
)} />
```

### Color Palette

**Use semantic color names from Tailwind config:**

```typescript
// Primary (blue scale)
'bg-primary-50'    // Lightest background
'bg-primary-100'
'bg-primary-600'   // Main brand color
'bg-primary-700'   // Hover states
'bg-primary-950'   // Darkest

// Neutral (gray scale)
'bg-gray-50'       // Light backgrounds
'bg-gray-200'      // Borders
'bg-gray-600'      // Secondary text
'bg-gray-900'      // Dark text

// Semantic colors
'bg-red-500'       // Errors
'bg-green-500'     // Success
'bg-yellow-500'    // Warnings
'bg-blue-500'      // Info
```

**Color Usage Guidelines:**
- Primary colors for CTAs and key actions
- Gray scale for text, borders, backgrounds
- Red for errors and destructive actions
- Green for success states
- Use consistent shades (e.g., always use `*-600` for primary buttons)

### Spacing Scale

**Follow Tailwind's spacing scale consistently:**

```typescript
// Spacing: 0.25rem increments
'p-1'   // 0.25rem (4px)
'p-2'   // 0.5rem (8px)
'p-3'   // 0.75rem (12px)
'p-4'   // 1rem (16px)  ← Common default
'p-6'   // 1.5rem (24px)
'p-8'   // 2rem (32px)

// Component spacing patterns
<button className="px-4 py-2" />           // Standard button padding
<input className="px-3 py-2" />            // Standard input padding
<div className="p-6 space-y-4" />          // Card with stacked children
<section className="py-12 px-4 md:px-8" /> // Section padding
```

### Typography

**Font sizes and weights:**

```typescript
// Headings
<h1 className="text-3xl md:text-4xl font-bold" />
<h2 className="text-2xl md:text-3xl font-semibold" />
<h3 className="text-xl md:text-2xl font-semibold" />
<h4 className="text-lg font-medium" />

// Body text
<p className="text-base" />        // 16px (default)
<small className="text-sm" />      // 14px
<span className="text-xs" />       // 12px

// Font weights
'font-normal'    // 400 (body text)
'font-medium'    // 500 (emphasis)
'font-semibold'  // 600 (headings)
'font-bold'      // 700 (strong emphasis)
```

### Interactive States

**Always style all interactive states:**

```typescript
<button className={cn(
  // Base styles
  'px-4 py-2 rounded-md transition-colors',

  // Hover state
  'hover:bg-primary-700',

  // Focus state (accessibility)
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',

  // Active state
  'active:bg-primary-800',

  // Disabled state
  'disabled:opacity-50 disabled:cursor-not-allowed',
)} />
```

**State Guidelines:**
- Always include focus states for keyboard navigation
- Use `transition-*` classes for smooth state changes
- Disabled states should have reduced opacity
- Loading states should disable interaction

### Common Patterns

**Card Component:**
```typescript
<div className={cn(
  'bg-white rounded-lg shadow-md',
  'p-6',
  'border border-gray-200',
  'hover:shadow-lg transition-shadow'
)} />
```

**Input Field:**
```typescript
<input className={cn(
  'w-full px-3 py-2 rounded-md',
  'border border-gray-300',
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
  'disabled:bg-gray-100 disabled:cursor-not-allowed',
  hasError && 'border-red-500 focus:ring-red-500'
)} />
```

**Centered Content:**
```typescript
<div className="flex items-center justify-center min-h-screen">
  <div className="w-full max-w-md p-6">
    {/* Content */}
  </div>
</div>
```

### Animations with Framer Motion

**Use Framer Motion for complex animations:**

```typescript
import { motion } from 'framer-motion'

// Page transitions
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>

// List animations
<motion.ul>
  {items.map((item) => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      layout
    >
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

### Dark Mode (Future)

**Prepare for dark mode with class-based approach:**

```typescript
// Structure for future dark mode support
<div className={cn(
  'bg-white text-gray-900',
  'dark:bg-gray-900 dark:text-white'
)} />
```

---

## Code Quality Checklist

Before submitting code, ensure:
- [ ] Component follows Atomic Design structure
- [ ] TypeScript types are properly defined
- [ ] Props extend native HTML attributes where applicable
- [ ] Forms use React Hook Form + Zod
- [ ] All className compositions use `cn()` utility
- [ ] Imports use `@/` path aliases
- [ ] Responsive design is mobile-first
- [ ] All interactive elements have hover/focus/active states
- [ ] Accessibility requirements are met (ARIA, semantic HTML, keyboard navigation)
- [ ] Colors use semantic names from Tailwind config
- [ ] Spacing follows Tailwind's scale
- [ ] No inline styles or CSS modules
- [ ] Component is tested for different states (loading, error, disabled)

---

## Questions or Suggestions?

This is a living document. If you have suggestions for improvements or need clarification on any guideline, please discuss with the team.
