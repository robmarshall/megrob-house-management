# Frontend Coding Guidelines

## Project Overview & Tech Stack

This is a React-based frontend application built with modern tooling and best practices.

### Core Technologies
- **React 19.1.1** - Latest React with concurrent features
- **TypeScript** - Strict mode enabled for type safety
- **Vite 7.1.7** - Fast build tool and dev server
- **React Router 7.9.5** - Client-side routing
- **Better Auth** - Session-based authentication

### Required UI Libraries
- **Tailwind CSS 4.1.16** - Utility-first CSS framework (MANDATORY for all styling)
- **React Hook Form** - Form state management (MANDATORY for all forms)
- **TanStack Query** - Server state management and data fetching (MANDATORY for all API calls)
- **Headless UI** - Unstyled, accessible UI components (MANDATORY for dialogs, popovers, menus, etc.)
- **Framer Motion** - Animation library (MANDATORY for animations)

### Development Tools
- **ESLint** - Code linting with TypeScript and React plugins
- **PostCSS** - CSS processing with Autoprefixer

---

## Core Principles

### 1. Atomic Design Methodology

All components MUST follow the Atomic Design pattern:

```
src/components/
├── atoms/         # Basic building blocks (Button, Input, Label, etc.)
├── molecules/     # Simple combinations of atoms (FormField, Card, etc.)
├── organisms/     # Complex components (LoginForm, Header, etc.)
└── templates/     # Page layouts (AuthLayout, DashboardLayout, etc.)
```

**Guidelines:**
- **Atoms**: Smallest reusable components (inputs, buttons, labels, icons)
- **Molecules**: Combinations of 2-3 atoms that work together
- **Organisms**: Complex components with business logic
- **Templates**: Layout components that define page structure

### 2. TypeScript-First Development

- TypeScript strict mode is enabled
- All components MUST be properly typed
- Use interfaces for component props
- Avoid `any` type - use `unknown` if truly dynamic
- Export types alongside components for reusability

```tsx
// ✅ CORRECT
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', ...props }) => {
  // implementation
};

// ❌ WRONG
export const Button = (props: any) => {
  // implementation
};
```

### 3. Accessibility-First Approach

All components MUST be accessible:
- Use semantic HTML elements
- Include ARIA attributes where needed
- Support keyboard navigation
- Provide meaningful labels and descriptions
- Test with screen readers when possible

---

## Styling Guidelines

### ⭐ MANDATORY: Tailwind CSS Only

**ALL styling MUST use Tailwind CSS utility classes. No exceptions.**

❌ **FORBIDDEN:**
- Inline styles (`style={{}}`)
- CSS Modules
- styled-components or CSS-in-JS libraries
- Separate .css files for component styles

✅ **ALLOWED:**
- Tailwind utility classes
- Global styles in `src/index.css` using `@layer`
- Custom Tailwind configuration in `tailwind.config.js`

### Use the `cn()` Utility for Conditional Classes

Create a `src/lib/utils.ts` file with a className utility:

```tsx
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Usage:**

```tsx
// ✅ CORRECT - Using cn() utility
import { cn } from '@/lib/utils';

export const Button = ({ variant, className, ...props }) => {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-colors',
        variant === 'primary' && 'bg-primary-600 text-white hover:bg-primary-700',
        variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        className
      )}
      {...props}
    />
  );
};

// ❌ WRONG - String concatenation
className={`px-4 py-2 ${variant === 'primary' ? 'bg-primary-600' : 'bg-gray-200'} ${className}`}
```

### Custom Tailwind Configuration

The project uses a custom primary color palette defined in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        // ... 900: '#1e3a8a',
        950: '#172554',
      }
    }
  }
}
```

Use these colors: `bg-primary-600`, `text-primary-700`, etc.

---

## Form Implementation Guidelines

### ⭐ MANDATORY: React Hook Form for All Forms

**ALL form inputs and forms MUST use React Hook Form. No manual state management with `useState`.**

### Pattern: Context-Wrapped Atomic Components

All atomic form components (Input, Textarea, Select, Checkbox, etc.) MUST be individually wrapped with React Hook Form context using `useFormContext()`. This allows clean reusability without repeatedly wrapping components.

### Implementation Pattern

#### 1. Atomic Input Components Use `useFormContext()`

```tsx
// src/components/atoms/Input.tsx
import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string; // REQUIRED - field name for RHF registration
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ name, label, className, type = 'text', ...props }, ref) => {
    const {
      register,
      formState: { errors },
    } = useFormContext();

    const error = errors[name];

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          id={name}
          type={type}
          className={cn(
            'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors',
            error ? 'border-red-500' : 'border-gray-300',
            className
          )}
          {...register(name)}
          {...props}
          ref={ref}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {error.message as string}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

#### 2. Forms Use `FormProvider`

```tsx
// src/components/organisms/LoginForm.tsx
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm = () => {
  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    // Handle form submission
    console.log(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <Input name="email" label="Email" type="email" />
        <Input name="password" label="Password" type="password" />

        <Button type="submit" isLoading={methods.formState.isSubmitting}>
          Sign In
        </Button>
      </form>
    </FormProvider>
  );
};
```

### Key Rules

1. **All form inputs MUST accept a `name` prop** for RHF registration
2. **Use `useFormContext()` in atomic components** instead of passing register/errors as props
3. **Always use `FormProvider`** to wrap forms
4. **Use Zod or Yup for validation schemas** (prefer Zod for TypeScript)
5. **Handle errors within atomic components** - show error messages automatically
6. **Support all standard HTML input props** via spreading

### Benefits of This Pattern

- ✅ Clean component usage - just pass `name` prop
- ✅ Automatic error handling - no need to pass errors down
- ✅ Type-safe form data with TypeScript + Zod
- ✅ Reusable across all forms
- ✅ Minimal boilerplate

---

## Data Fetching with TanStack Query

### ⭐ MANDATORY: TanStack Query for All API Calls

**ALL data fetching and mutations MUST use TanStack Query through our base hooks system. No direct API calls with `fetch` or `axios`.**

The application uses a standardized CRUD pattern with two base hooks that handle all API interactions:

### Core Technologies

- **@tanstack/react-query** - Server state management, caching, and data synchronization
- **@tanstack/react-query-devtools** - Development tools for debugging queries

### Architecture Overview

```
Base Layer:
├── useData<T>              → Single-item CRUD (create, edit, delete)
└── usePaginatedData<T>     → List fetching with pagination

Collection Layer (feature-specific):
└── hooks/[featureName]/
    ├── use[Feature]s.ts         → Typed wrappers for lists
    └── use[Feature]Data.ts      → Typed wrappers for CRUD
```

### Base Hooks

#### 1. `useData<T>` - Single Item CRUD Operations

Located at: `src/hooks/useData.ts`

Use this for creating, editing, and deleting individual items.

**Signature:**
```typescript
function useData<T>(collection: string): {
  create: (data: Partial<T>) => Promise<T>
  edit: (id: string | number, data: Partial<T>) => Promise<T>
  delete: (id: string | number) => Promise<void>
  isLoading: boolean
}
```

**Example:**
```tsx
const { create, edit, delete: deleteItem, isLoading } = useData<ShoppingList>('shopping-lists');

// Create a new item
await create({ name: 'Groceries', description: 'Weekly shopping' });

// Update an item
await edit(1, { name: 'Updated Groceries' });

// Delete an item
await deleteItem(1);
```

**Features:**
- Automatic query cache invalidation after mutations
- Combined loading state for all operations
- Type-safe with TypeScript generics
- Automatic error handling

#### 2. `usePaginatedData<T>` - Paginated List Fetching

Located at: `src/hooks/usePaginatedData.ts`

Use this for fetching lists of items with pagination support.

**Signature:**
```typescript
function usePaginatedData<T>(
  collection: string,
  options?: PaginationOptions
): {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isLoading: boolean
  error: Error | null
  nextPage: () => void
  prevPage: () => void
  goToPage: (page: number) => void
  refetch: () => void
}
```

**Example:**
```tsx
const {
  data,           // Current page of items
  total,          // Total number of items
  page,           // Current page number
  pageSize,       // Items per page
  totalPages,     // Total number of pages
  isLoading,      // Loading state
  error,          // Error state
  nextPage,       // Go to next page
  prevPage,       // Go to previous page
  goToPage,       // Jump to specific page
  refetch,        // Manually refetch
} = usePaginatedData<ShoppingList>('shopping-lists', {
  page: 1,
  pageSize: 20
});
```

**Features:**
- Automatic pagination state management
- Navigation helpers for page controls
- Loading and error states
- Automatic caching and refetching
- Query parameter support (page, pageSize)

### Creating Collection-Specific Hooks

**MANDATORY:** Never use the base hooks directly in components. Always create typed collection-specific wrappers.

#### File Structure

Create a folder for each feature in `src/hooks/[featureName]/`:

```
src/hooks/
├── useData.ts                    # Base CRUD hook
├── usePaginatedData.ts           # Base pagination hook
└── [featureName]/                # Feature-specific hooks
    ├── use[Feature]s.ts          # List hook
    └── use[Feature]Items.ts      # Items/nested hook (if needed)
```

#### Example: Shopping Lists

**File:** `src/hooks/shoppingList/useShoppingLists.ts`

```tsx
import { useData } from '../useData';
import { usePaginatedData } from '../usePaginatedData';
import type { PaginationOptions } from '@/types/api';

export interface ShoppingList {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Hook for fetching paginated shopping lists
 */
export function useShoppingLists(options?: PaginationOptions) {
  return usePaginatedData<ShoppingList>('shopping-lists', options);
}

/**
 * Hook for shopping list CRUD operations
 */
export function useShoppingListData() {
  return useData<ShoppingList>('shopping-lists');
}
```

#### Example: Nested Resources (Shopping List Items)

**File:** `src/hooks/shoppingList/useShoppingListItems.ts`

```tsx
import { useData } from '../useData';
import { usePaginatedData } from '../usePaginatedData';
import type { PaginationOptions } from '@/types/api';

export interface ShoppingListItem {
  id: number;
  listId: number;
  name: string;
  category?: string;
  quantity: number;
  checked: boolean;
  // ... other fields
}

/**
 * Hook for fetching items for a specific shopping list
 */
export function useShoppingListItems(
  listId: number,
  options?: PaginationOptions
) {
  return usePaginatedData<ShoppingListItem>(
    `shopping-lists/${listId}/items`,
    options
  );
}

/**
 * Hook for shopping list item CRUD operations
 */
export function useShoppingListItemData(listId: number) {
  return useData<ShoppingListItem>(`shopping-lists/${listId}/items`);
}
```

### Usage in Components

#### Fetching Lists

```tsx
import { useShoppingLists } from '@/hooks/shoppingList/useShoppingLists';

export function ShoppingListsPage() {
  const { data, isLoading, error, nextPage, prevPage, page, totalPages } =
    useShoppingLists({ page: 1, pageSize: 20 });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {data.map(list => (
        <ShoppingListCard key={list.id} list={list} />
      ))}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onNext={nextPage}
        onPrev={prevPage}
      />
    </div>
  );
}
```

#### Creating Items

```tsx
import { useShoppingListData } from '@/hooks/shoppingList/useShoppingLists';

export function CreateListForm() {
  const { create, isLoading } = useShoppingListData();

  const methods = useForm<CreateListInput>({
    resolver: zodResolver(createListSchema),
  });

  const onSubmit = async (data: CreateListInput) => {
    try {
      await create(data);
      // Success! Query cache is automatically updated
      toast.success('List created successfully');
    } catch (error) {
      toast.error('Failed to create list');
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Input name="name" label="List Name" />
        <Input name="description" label="Description" />
        <Button type="submit" isLoading={isLoading}>
          Create List
        </Button>
      </form>
    </FormProvider>
  );
}
```

#### Editing Items

```tsx
import { useShoppingListData } from '@/hooks/shoppingList/useShoppingLists';

export function EditListDialog({ listId, currentName }: Props) {
  const { edit, isLoading } = useShoppingListData();

  const handleSave = async (newName: string) => {
    try {
      await edit(listId, { name: newName });
      toast.success('List updated');
      onClose();
    } catch (error) {
      toast.error('Failed to update list');
    }
  };

  return (
    <Dialog>
      {/* ... form UI ... */}
    </Dialog>
  );
}
```

#### Deleting Items

```tsx
import { useShoppingListData } from '@/hooks/shoppingList/useShoppingLists';

export function DeleteListButton({ listId }: Props) {
  const { delete: deleteList, isLoading } = useShoppingListData();

  const handleDelete = async () => {
    const confirmed = await confirm('Delete this list?');
    if (!confirmed) return;

    try {
      await deleteList(listId);
      toast.success('List deleted');
    } catch (error) {
      toast.error('Failed to delete list');
    }
  };

  return (
    <Button onClick={handleDelete} isLoading={isLoading} variant="danger">
      Delete
    </Button>
  );
}
```

### API Client Configuration

The API client is located at `src/lib/api/client.ts` and provides:

- **Automatic authentication**: Uses session cookies (credentials: 'include')
- **Base URL handling**: Uses `VITE_API_URL` environment variable
- **Error handling**: Converts API errors to user-friendly messages
- **Type safety**: Generic functions with TypeScript support

**Available functions:**
```typescript
apiGet<T>(endpoint: string, params?: QueryParams): Promise<T>
apiPost<T>(endpoint: string, data: unknown): Promise<T>
apiPatch<T>(endpoint: string, data: unknown): Promise<T>
apiDelete<T>(endpoint: string): Promise<T>
```

**DO NOT call these directly** - always use through `useData` or `usePaginatedData`.

### Query Keys

Located at `src/lib/api/queryKeys.ts`

Query keys are automatically managed by the base hooks. They follow this pattern:

```typescript
// List queries
[collection, 'list', { page: 1, pageSize: 20 }]

// Detail queries
[collection, 'detail', id]

// Collection base (for invalidation)
[collection]
```

### Cache Invalidation

Cache invalidation is **automatic** after mutations:

- `create()` → Invalidates all list queries for that collection
- `edit()` → Invalidates all list queries for that collection
- `delete()` → Invalidates all list queries for that collection

No manual cache management needed!

### Query Client Configuration

Located at `src/lib/queryClient.ts`

Default settings:
- **Stale time**: 5 minutes
- **Cache time**: 10 minutes
- **Retry**: 3 attempts with exponential backoff
- **Refetch on focus**: Only in production

### TanStack Query DevTools

Available in development mode only. Access with:
- Click the React Query icon in the bottom corner
- View active queries, mutations, and cache state
- Manually refetch or invalidate queries
- Debug stale/fresh data states

### Best Practices

1. **Always create collection-specific hooks** - Never use base hooks directly
2. **Define TypeScript interfaces** in collection hook files
3. **One folder per feature** - `hooks/[featureName]/`
4. **Handle errors in components** - Use try/catch with user feedback
5. **Use loading states** - Show spinners during mutations
6. **Trust automatic cache invalidation** - Don't manually refetch
7. **Pagination options** - Pass via props, not useState
8. **Nested resources** - Use path syntax: `collection/${id}/subcollection`

### Common Patterns

#### Optimistic Updates (Future)

```tsx
// Will be added when needed
const { edit } = useData<ShoppingList>('shopping-lists', {
  optimisticUpdate: true
});
```

#### Dependent Queries

```tsx
// Fetch items only when list is selected
const { data: items, isLoading } = useShoppingListItems(
  selectedListId,
  { enabled: !!selectedListId }
);
```

#### Manual Refetch

```tsx
const { data, refetch } = useShoppingLists();

// Force refetch on user action
const handleRefresh = () => {
  refetch();
};
```

### Checklist for New Collections

When adding a new data collection:

- [ ] Create folder: `hooks/[collectionName]/`
- [ ] Create list hook: `use[Collection]s.ts`
- [ ] Create data hook: `use[Collection]Data.ts`
- [ ] Define TypeScript interfaces in hook files
- [ ] Export both pagination and CRUD hooks
- [ ] Add JSDoc comments with examples
- [ ] Test in a component with loading/error states

---

## Component Architecture Guidelines

### ⭐ MANDATORY: Headless UI for Complex Components

**Use Headless UI for all dialogs, popovers, dropdowns, menus, comboboxes, and transitions.**

Headless UI provides unstyled, accessible components that you style with Tailwind CSS.

#### When to Use Headless UI

| Component Type | Use Headless UI | Example |
|---------------|-----------------|---------|
| Modal/Dialog | ✅ YES | `<Dialog>` |
| Dropdown Menu | ✅ YES | `<Menu>` |
| Popover | ✅ YES | `<Popover>` |
| Combobox/Autocomplete | ✅ YES | `<Combobox>` |
| Select Dropdown | ✅ YES | `<Listbox>` |
| Tabs | ✅ YES | `<Tab>` |
| Disclosure/Accordion | ✅ YES | `<Disclosure>` |
| Radio Group | ✅ YES | `<RadioGroup>` |
| Switch/Toggle | ✅ YES | `<Switch>` |
| Transitions | ✅ YES | `<Transition>` |

#### Example: Dialog with Headless UI + Tailwind

```tsx
// src/components/organisms/ConfirmDialog.tsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Button } from '@/components/atoms/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-gray-500">
                  {message}
                </Dialog.Description>

                <div className="mt-4 flex gap-2 justify-end">
                  <Button variant="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={onConfirm}>
                    Confirm
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
```

### ⭐ MANDATORY: Framer Motion for Custom Animations

**Use Framer Motion for all custom animations beyond simple transitions.**

#### When to Use Framer Motion

| Animation Type | Use Framer Motion | Example |
|---------------|-------------------|---------|
| Page transitions | ✅ YES | Route animations |
| List animations | ✅ YES | Staggered children |
| Gesture-based | ✅ YES | Drag, swipe, hover |
| Complex keyframes | ✅ YES | Multi-step animations |
| Layout animations | ✅ YES | Shared element transitions |
| Scroll-triggered | ✅ YES | Parallax, reveal on scroll |

#### Example: Framer Motion Animation

```tsx
// src/components/molecules/Card.tsx
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <motion.div
      className={cn(
        'bg-white rounded-lg shadow-md p-6',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
};
```

#### Example: Staggered List Animation

```tsx
// src/components/organisms/AnimatedList.tsx
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
};

export const AnimatedList: React.FC<{ items: string[] }> = ({ items }) => {
  return (
    <motion.ul
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {items.map((text, index) => (
        <motion.li
          key={index}
          variants={item}
          className="p-4 bg-white rounded-lg shadow"
        >
          {text}
        </motion.li>
      ))}
    </motion.ul>
  );
};
```

### Integration Guidelines

- **Combine Headless UI with Framer Motion** for animated dialogs/menus
- **Use Tailwind for all styling** on Headless UI components
- **Keep animations subtle** - prefer 200-300ms durations
- **Use `prefers-reduced-motion`** media query for accessibility

---

## File Organization

### Directory Structure

```
frontend/src/
├── components/
│   ├── atoms/           # Basic UI elements
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Label.tsx
│   │   └── ErrorMessage.tsx
│   ├── molecules/       # Composite components
│   │   ├── FormField.tsx
│   │   ├── Card.tsx
│   │   └── SearchBar.tsx
│   ├── organisms/       # Complex components
│   │   ├── LoginForm.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   └── templates/       # Page layouts
│       ├── AuthLayout.tsx
│       └── DashboardLayout.tsx
├── contexts/            # React Context providers
│   └── AuthContext.tsx
├── hooks/               # Custom React hooks
│   └── useAuth.ts
├── lib/                 # Utilities and helpers
│   ├── utils.ts         # cn() utility, formatters
│   ├── validators.ts    # Zod schemas
│   └── auth-client.ts       # Better Auth client
├── pages/               # Route components
│   ├── LoginPage.tsx
│   └── HomePage.tsx
├── types/               # TypeScript type definitions
│   └── auth.ts
├── guards/              # Route guards
│   └── ProtectedRoute.tsx
├── App.tsx
├── main.tsx
└── index.css            # Global Tailwind imports
```

### Naming Conventions

- **Components**: PascalCase with descriptive names (`LoginForm.tsx`, `UserAvatar.tsx`)
- **Hooks**: camelCase starting with `use` (`useAuth.ts`, `useFormValidation.ts`)
- **Utilities**: camelCase (`formatDate.ts`, `cn.ts`)
- **Types**: PascalCase for interfaces (`UserProfile`, `AuthContextValue`)
- **Files**: Match the primary export name

### Where to Place New Components

1. **Creating a new input type?** → `atoms/`
2. **Combining 2-3 atoms?** → `molecules/`
3. **Building a form or complex feature?** → `organisms/`
4. **Creating a page layout?** → `templates/`
5. **Full page component?** → `pages/`

### Import Aliases

Use `@/` alias for cleaner imports:

```tsx
// ✅ CORRECT
import { Button } from '@/components/atoms/Button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ❌ WRONG
import { Button } from '../../../components/atoms/Button';
```

---

## Summary Checklist

When creating or modifying components, ensure:

- [ ] ✅ Using Tailwind CSS exclusively for styling
- [ ] ✅ Form inputs use React Hook Form with `useFormContext()`
- [ ] ✅ Data fetching uses TanStack Query hooks (never raw `fetch`)
- [ ] ✅ Collection-specific hooks created (not using base hooks directly)
- [ ] ✅ Dialogs/popovers use Headless UI
- [ ] ✅ Animations use Framer Motion
- [ ] ✅ Component follows Atomic Design pattern
- [ ] ✅ TypeScript types are properly defined
- [ ] ✅ Accessibility attributes included
- [ ] ✅ Component is in the correct directory
- [ ] ✅ Using `cn()` utility for conditional classes
- [ ] ✅ Using `@/` import alias
