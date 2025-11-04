# Megrob Project - Complete Structure Analysis

## Project Overview
- **Project Name**: megrob (Home Management App)
- **Repository**: Located at C:\projects\megrob
- **Git Status**: Clean working directory on main branch, 2 commits (initial commit, more changes)
- **Type**: Monorepo with frontend and backend

## Directory Structure

### Root Directory
- `.claude/` - Claude IDE configuration
- `.git/` - Git repository
- `.serena/` - Serena agent configuration
- `backend/` - Node.js backend API
- `frontend/` - React web application
- `supabase/` - Supabase configuration files
- Configuration files: `claude.md`, `README.md`, `shopping-list.md`, `.gitignore`

### Frontend (React 19)
**Location**: `/c/projects/megrob/frontend/`

**Source Structure** (46 total TypeScript files):
```
src/
├── components/
│   ├── atoms/        (10 files: Button, Input, Checkbox, Badge, Card, etc.)
│   ├── molecules/    (6 files: FormField, AddItemInput, EmptyState, etc.)
│   ├── organisms/    (4 files: LoginForm, ShoppingListDetail, etc.)
│   └── templates/    (1 file: AuthLayout)
├── contexts/         (1 file: AuthContext)
├── guards/          (1 file: ProtectedRoute)
├── hooks/
│   ├── shoppingList/
│   │   ├── useShoppingListItems.ts
│   │   └── useShoppingLists.ts
│   ├── useAuth.ts
│   ├── useData.ts
│   ├── usePaginatedData.ts
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   └── queryKeys.ts
│   ├── errors.ts
│   ├── queryClient.ts
│   ├── schemas.ts
│   ├── supabaseClient.ts
│   ├── utils.ts
│   └── validators.ts
├── pages/           (5 files: HomePage, LoginPage, ShoppingListsPage, etc.)
├── types/
│   ├── api.ts
│   ├── auth.ts
│   └── shoppingList.ts
├── App.tsx
├── main.tsx
└── index.css
```

**Configuration Files**:
- `package.json` - Dependencies and scripts
- `tsconfig.json` - Root TS config (references app and node)
- `tsconfig.app.json` - App-specific TS config (strict mode)
- `tsconfig.node.json` - Node tools TS config
- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS theming
- `postcss.config.js` - PostCSS configuration
- `eslint.config.js` - ESLint rules
- `.env` - Local environment variables
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules

**Documentation**:
- `README.md` - Project documentation
- `CLAUDE.md` - Frontend coding guidelines (28KB - comprehensive)
- `STYLE_GUIDE.md` - Frontend style guidelines (12KB - deprecated)

### Backend (Node.js/Hono)
**Location**: `/c/projects/megrob/backend/`

**Source Structure** (6 total TypeScript files):
```
src/
├── db/
│   ├── index.ts
│   └── schema.ts
├── middleware/
│   └── auth.ts
├── routes/
│   ├── shoppingLists.ts
│   └── shoppingListItems.ts
└── index.ts
```

**Configuration Files**:
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `drizzle.config.ts` - Drizzle ORM configuration
- `.env` - Local environment variables (contains actual secrets for local dev)
- `.env.example` - Environment template

**Database**:
- `drizzle/` - Database migrations folder
  - `meta/_journal.json` - Migration journal
  - `meta/0000_snapshot.json` - Initial schema snapshot

### Supabase Configuration
**Location**: `/c/projects/megrob/supabase/`
- `config.toml` - Supabase project configuration
- `.branches/` - Branch management
- `.temp/` - Temporary files
- `.gitignore` - Git ignore for Supabase files

## Technology Stack

### Frontend Dependencies
- React 19.1.1
- TypeScript 5.9.3
- Vite 7.1.7
- React Router 7.9.5
- Tailwind CSS 4.1.16
- React Hook Form 7.66.0
- TanStack React Query 5.90.6
- Headless UI 2.2.9
- Framer Motion 12.23.24
- Zod 4.1.12
- Supabase JS 2.78.0
- clsx 2.1.1
- tailwind-merge 3.3.1

### Backend Dependencies
- Hono 4.10.4
- @hono/node-server 1.19.6
- Drizzle ORM 0.44.7
- drizzle-kit 0.31.6
- Supabase JS 2.78.0
- postgres 3.4.7
- dotenv 17.2.3
- TypeScript 5.9.3
- tsx 4.20.6 (dev)

## Database Schema

**Current Tables**:
1. `shopping_lists` - Main shopping list entity
   - Fields: id, name, description, createdAt, updatedAt, createdBy, updatedBy
   
2. `shopping_list_items` - Items within shopping lists
   - Fields: id, listId, name, category, quantity, unit, notes, checked, checkedAt, checkedBy, position, createdAt, updatedAt, createdBy, updatedBy

**Note**: User authentication handled by Supabase's auth.users table

## API Structure

### Routes Implemented
- `GET /` - Health check (public)
- `GET /health` - Health status (public)
- `GET /api/shopping-lists` - List all lists (paginated, auth required)
- `POST /api/shopping-lists` - Create new list (auth required)
- `GET /api/shopping-lists/:id` - Get single list (auth required)
- `PUT /api/shopping-lists/:id` - Update list (auth required)
- `DELETE /api/shopping-lists/:id` - Delete list (auth required)
- (Shopping list items routes structure present but not fully detailed in main routes file)

### Middleware
- CORS enabled globally
- Authentication middleware - Verifies Supabase JWT tokens

## Frontend Pages/Routes
- `/` - HomePage (protected)
- `/login` - LoginPage
- `/reset-password` - ResetPasswordPage
- `/shopping-lists` - ShoppingListsPage (protected)
- `/shopping-lists/:id` - ShoppingListDetailPage (protected)

## Environment Configuration

### Frontend Environment Variables
Required:
- `VITE_API_URL` - Backend API URL (default: http://localhost:3000)
- `VITE_SUPABASE_URL` - Supabase URL (default: http://127.0.0.1:54321)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Public Supabase key
- `VITE_FRONTEND_URL` - Frontend URL (default: http://localhost:5173)

### Backend Environment Variables
Required:
- `PORT` - Server port (default: 3000)
- `SUPABASE_URL` - Supabase REST API URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service key
- `DATABASE_URL` - PostgreSQL connection string

## Architecture Adherence

### Atomic Design Implementation
- Atoms: 10 components (Button, Input, Checkbox, Badge, Card, Label, Textarea, IconButton, ErrorMessage)
- Molecules: 6 components (FormField, AddItemInput, EmptyState, InputWrapper, ListHeader, ShoppingListItem)
- Organisms: 4 components (LoginForm, ResetPasswordForms, ShoppingListCard, ShoppingListDetail)
- Templates: 1 component (AuthLayout)
- Pages: 5 pages (HomePage, LoginPage, ResetPasswordPage, ShoppingListsPage, ShoppingListDetailPage)

### Data Flow
- Forms: React Hook Form with FormProvider context
- Data Fetching: TanStack Query with custom hooks (useData, usePaginatedData)
- Styling: Tailwind CSS utility classes exclusively
- Components: Headless UI for complex components, Framer Motion for animations

## Documentation Files

### Present
- `claude.md` (3.7KB) - Home Management App overview
- `frontend/CLAUDE.md` (28KB) - Comprehensive frontend coding guidelines
- `shopping-list.md` (7.1KB) - Shopping list feature documentation
- `README.md` (3.3KB) - Project README
- `.env.example` files in both frontend and backend

### Missing/Partially Documented
- `frontend/STYLE_GUIDE.md` mentioned but appears deprecated (12KB file exists but references CLAUDE.md for guidelines)
- Backend documentation/CLAUDE.md
- API documentation
- Architecture decision records (ADRs)
- Contributing guidelines

## Testing
- **Test Files**: None found in project source code (no .test.ts, .spec.ts files in src/)
- **Missing**: Unit tests, integration tests, E2E tests

## CI/CD & Deployment
- **No CI/CD Configuration**: No GitHub Actions, GitLab CI, Travis CI, or similar
- **No Docker Configuration**: No Dockerfile or docker-compose.yml files
- **Missing**: Deployment strategy, build/deploy scripts

## Known Issues & Gaps

### Based on CLAUDE.md vs Implementation

**What's Completed**:
✅ Authentication system (login, password reset)
✅ Protected routing with auth guards
✅ Atomic component library
✅ Supabase integration
✅ TypeScript strict configuration
✅ Tailwind CSS setup
✅ React Hook Form integration
✅ TanStack Query setup
✅ Shopping list feature (basic CRUD)
✅ Frontend coding guidelines

**What's Planned but Missing**:
❌ Shopping list feature (mentioned as planned, but actually partially implemented)
❌ Recipe management (0 files)
❌ Meal planning (0 files)
❌ Household task tracking (0 files)
❌ Inventory tracking (0 files)
❌ Mobile responsive design (not explicitly built in)
❌ Dark mode support (0 configuration)
❌ PWA features (no manifest, no service worker)

### Critical Gaps
1. **No Tests**: Zero test coverage despite 46 frontend files and 6 backend files
2. **No CI/CD**: No automated testing or deployment pipeline
3. **No Docker**: No containerization for development or production
4. **Backend Documentation**: No CLAUDE.md or STYLE_GUIDE for backend
5. **API Documentation**: No OpenAPI/Swagger documentation
6. **Error Handling**: Limited error handling patterns documented
7. **Security**: No documented security practices or review
8. **Performance**: No performance monitoring or optimization guidelines
9. **Logging**: Minimal logging setup visible
10. **Database Migrations**: Drizzle migrations exist but process unclear

### Code Organization Issues
1. Inconsistent documentation between frontend and backend
2. Backend lacks the same level of code guidelines as frontend
3. No clear separation of concerns documentation for API layer
4. Missing type definitions for some API responses
5. Limited example implementations for new developers

### Potential Red Flags
1. Actual `.env` files committed to repository (contains real Supabase credentials)
2. Complex CLAUDE.md for frontend but nothing for backend
3. Shopping list feature marked as "planned" but substantially implemented
4. No error boundary or fallback UI patterns
5. No rate limiting or request throttling documented
