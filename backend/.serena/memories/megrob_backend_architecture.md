# Megrob House Management Backend - Architecture & Patterns

## Project Overview
A Node.js backend API using Hono framework with TypeScript, Drizzle ORM, and Supabase PostgreSQL database. Currently implements a shopping list management system with authentication.

## Technology Stack

### Core Framework & Runtime
- **Framework**: Hono (lightweight web framework)
- **Runtime**: Node.js with @hono/node-server
- **Language**: TypeScript (ES2020 target)
- **Build Tool**: tsup (ES module format)
- **Dev Server**: tsx watch

### Database & ORM
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM with postgres.js driver
- **Migrations**: Drizzle Kit
- **Connection**: Direct PostgreSQL connection string (not Supabase REST API)

### Authentication
- **Auth Provider**: Supabase Authentication
- **Token Type**: JWT tokens
- **Token Verification**: Supabase SDK (getUser())
- **Session Management**: Bearer token in Authorization header

### Other Libraries
- dotenv: Environment variable management
- @supabase/supabase-js: Supabase client for auth verification
- hono/cors: CORS middleware

## Environment Configuration

### Required Environment Variables
```
PORT=3000
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
FRONTEND_URL=<optional, currently allows all origins with "*">
```

### Startup Validation
- Server validates all required environment variables at startup
- Exit with error code if any are missing
- Clear error messages showing which variables are missing

## Folder Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── index.ts          # Drizzle client initialization
│   │   └── schema.ts         # Database table definitions
│   ├── middleware/
│   │   └── auth.ts           # Authentication middleware & helpers
│   ├── routes/
│   │   ├── shoppingLists.ts  # Shopping lists CRUD endpoints
│   │   └── shoppingListItems.ts # Shopping list items CRUD endpoints
│   └── index.ts              # Main application setup & routing
├── drizzle/
│   ├── meta/
│   │   ├── _journal.json     # Migration tracking
│   │   └── 0000_snapshot.json
│   └── 0000_ordinary_luke_cage.sql # Generated migration
├── dist/                     # Build output
├── node_modules/
├── .env.example
├── drizzle.config.ts         # Drizzle Kit configuration
├── package.json
├── tsconfig.json
└── package-lock.json
```

## Database Setup & Configuration

### Drizzle Configuration (drizzle.config.ts)
- Uses PostgreSQL dialect
- Schema location: `./src/db/schema.ts`
- Migrations output: `./drizzle` directory
- Credentials: Pulls DATABASE_URL from environment

### Database Client Initialization (src/db/index.ts)
```typescript
- Uses postgres.js driver (prepare: false for compatibility)
- Exports: client (raw postgres connection), db (drizzle instance with schema)
- Schema imported and passed to drizzle() for type safety
```

### Database Tables

#### shopping_lists
- `id` (serial, primary key)
- `name` (text, required)
- `description` (text, optional)
- `createdAt` (timestamp, default now())
- `updatedAt` (timestamp, default now())
- `createdBy` (uuid, references auth.users)
- `updatedBy` (uuid, references auth.users)

#### shopping_list_items
- `id` (serial, primary key)
- `listId` (integer, foreign key → shopping_lists.id, ON DELETE cascade)
- `name` (text, required)
- `category` (text, e.g., "produce", "dairy")
- `quantity` (numeric, default '1')
- `unit` (text, e.g., "lbs", "oz")
- `notes` (text, optional)
- `checked` (boolean, default false)
- `checkedAt` (timestamp, optional)
- `checkedBy` (uuid, optional)
- `position` (integer, default 0, for custom ordering)
- `createdAt` (timestamp, default now())
- `updatedAt` (timestamp, default now())
- `createdBy` (uuid)
- `updatedBy` (uuid)

**Note**: User authentication is handled by Supabase's `auth.users` table (not managed in this schema)

## Authentication & Authorization

### Auth Middleware Pattern (src/middleware/auth.ts)

**Purpose**: Verify JWT tokens and attach user to request context

**Functionality**:
1. Extracts Bearer token from Authorization header
2. Verifies token using Supabase SDK (`supabase.auth.getUser()`)
3. Attaches verified user ID to Hono context with `c.set("userId", user.id)`
4. Returns 401 for missing/invalid tokens

**Usage in Routes**:
```typescript
app.use('*', authMiddleware);  // Apply to all routes
const userId = getUserId(c);   // Extract in route handlers
```

**Helper Function**: `getUserId(c)` - Retrieves user ID from context, throws if missing

### Authorization Pattern
- **Data Ownership Verification**: All routes verify that resources belong to authenticated user
- **Query Filtering**: Queries filtered by `eq(resource.createdBy, userId)` to ensure data isolation
- **Ownership Checks**: Before update/delete, verify current user owns the resource

## API Routing Structure

### Route Organization
- Main app in `src/index.ts`
- Routes defined in separate files under `src/routes/`
- Routes mounted with `app.route()` in main app
- Each route handler is a separate Hono app instance

### Hono App Pattern
```typescript
// In route files
const app = new Hono();
app.use('*', authMiddleware);  // Apply auth to route-specific app
app.get('/', handler);
export default app;

// In index.ts
app.route("/api/shopping-lists", shoppingListsRoutes);
```

### CORS Configuration
- Middleware applied globally in main app: `app.use("/*", cors(...))`
- Current config:
  - Origin: "*" (allows all, FRONTEND_URL is commented out)
  - Methods: GET, POST, PATCH, DELETE, OPTIONS
  - Headers: Content-Type, Authorization

## API Endpoints

### Shopping Lists (src/routes/shoppingLists.ts)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/shopping-lists` | List all lists for authenticated user (paginated) |
| POST | `/api/shopping-lists` | Create new shopping list |
| GET | `/api/shopping-lists/:id` | Get single list by ID |
| PATCH | `/api/shopping-lists/:id` | Update list (name, description) |
| DELETE | `/api/shopping-lists/:id` | Delete list (cascade deletes items) |

**Query Parameters for GET**:
- `page` (default: 1)
- `pageSize` (default: 20)

**Response Format** (list endpoints):
```json
{
  "data": [...],
  "total": number,
  "page": number,
  "pageSize": number,
  "totalPages": number
}
```

### Shopping List Items (src/routes/shoppingListItems.ts)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/shopping-lists/:listId/items` | Get items for a list (paginated) |
| POST | `/api/shopping-lists/:listId/items` | Add item to list |
| PATCH | `/api/shopping-lists/:listId/items/:itemId` | Update item |
| PATCH | `/api/shopping-lists/:listId/items/:itemId/toggle` | Toggle checked state |
| DELETE | `/api/shopping-lists/:listId/items/:itemId` | Delete item |

**Query Parameters**:
- `page` (default: 1)
- `pageSize` (default: 50)

## Error Handling Patterns

### Standard Error Responses
- **400**: Invalid input (missing required fields, invalid IDs)
- **401**: Authentication errors (missing token, invalid token)
- **404**: Resource not found
- **500**: Server errors

### Error Response Format
```json
{ "error": "Error message describing what went wrong" }
```

### Error Handling in Routes
1. Try-catch blocks wrap database operations
2. Validation of required fields returns 400
3. Ownership/existence checks return 404
4. Database errors logged to console, return 500
5. All errors return appropriate JSON response

### Validation Pattern
- Manual validation in route handlers
- Type validation: `typeof name !== 'string'`
- ID validation: `isNaN(id)` check
- Required field checks before database operations
- No request body schema validation library (e.g., Zod) used currently

## Data Patterns

### Timestamps
- Always include `createdAt`, `updatedAt` with `defaultNow()`
- `updatedAt` manually set on updates to `new Date()`
- Timestamp fields for tracking: `checkedAt`, `checkedBy`

### User Tracking
- Every row tracks: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`
- Authentication user ID always available via `getUserId(c)`
- User IDs are UUIDs from Supabase auth

### Pagination Pattern
```typescript
const page = parseInt(c.req.query('page') || '1');
const pageSize = parseInt(c.req.query('pageSize') || '20');
const offset = (page - 1) * pageSize;

// Get total and paginated data separately
const allRecords = await db.select().from(table);
const total = allRecords.length;
const totalPages = Math.ceil(total / pageSize);
const data = await db.select().from(table).limit(pageSize).offset(offset);
```

### Ordering Pattern
- List endpoints order by `desc(updatedAt)` (most recently updated first)
- Item endpoints order by `asc(position)` then `asc(createdAt)`

## Drizzle ORM Usage Patterns

### Query Building
- Uses Drizzle query builder: `.select()`, `.insert()`, `.update()`, `.delete()`
- Conditions with `eq()`, `and()`, `or()` operators
- Always returns array, destructure with `[record]` pattern

### Commonly Used Functions
```typescript
import { eq, and, desc, asc } from 'drizzle-orm';

// SELECT with WHERE
const [record] = await db.select().from(table)
  .where(eq(table.id, id));

// SELECT with multiple conditions
.where(and(
  eq(table.id, id),
  eq(table.createdBy, userId)
))

// INSERT and return
const [newRecord] = await db.insert(table)
  .values({...})
  .returning();

// UPDATE and return
const [updated] = await db.update(table)
  .set({...})
  .where(eq(table.id, id))
  .returning();

// DELETE
await db.delete(table).where(eq(table.id, id));

// ORDERING
.orderBy(desc(table.updatedAt))
.orderBy(asc(table.position), asc(table.createdAt))

// PAGINATION
.limit(pageSize).offset(offset)
```

### Conditional Field Updates
Pattern for optional updates (only update if provided):
```typescript
name: name !== undefined ? name : existingRecord.name,
checked: checked !== undefined ? checked : existingRecord.checked,
```

Pattern for dependent field updates (e.g., timestamps):
```typescript
checkedAt: checked === true ? new Date() : checked === false ? null : existingItem.checkedAt,
checkedBy: checked === true ? userId : checked === false ? null : existingItem.checkedBy,
```

## Build & Deployment

### Scripts
- `dev`: Run with hot reload using tsx watch
- `build`: Build with tsup to ESM format, clean dist
- `start`: Run built output
- `db:generate`: Generate migration files
- `db:migrate`: Apply migrations
- `db:push`: Push schema to database
- `db:studio`: Open Drizzle Studio GUI

### Build Configuration (tsup)
- Format: ES modules (esm)
- Input: src/index.ts
- Output: dist/index.js
- Cleans dist before building

## Key Architectural Decisions & Patterns

1. **Modular Route Structure**: Each resource has its own file, mounted in main app
2. **Middleware-Based Auth**: Authentication applied at route level, user ID available in context
3. **Explicit Ownership Verification**: Every data operation checks user ownership
4. **Drizzle ORM**: Type-safe database queries with migrations
5. **Service Role Authentication**: Uses Supabase service role key for server-side auth verification
6. **Direct DB Connection**: Direct PostgreSQL connection for ORM, separate from Supabase REST API
7. **No Third-Party Validation**: Manual field validation instead of schema libraries
8. **Transaction-Less**: No complex transaction handling currently implemented
9. **No Soft Deletes**: Hard deletes with cascade constraints
10. **UUID User IDs**: From Supabase authentication system

## Common Implementation Patterns

### Creating a New Resource
1. Add table to `src/db/schema.ts` with pgTable()
2. Generate migration with `npm run db:generate`
3. Push migration with `npm run db:push`
4. Create route file in `src/routes/`
5. Apply authMiddleware to route app
6. Implement CRUD endpoints with ownership checks
7. Mount route in `src/index.ts` with `app.route()`

### Adding a Field to Existing Table
1. Update schema definition in `src/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Verify migration SQL looks correct
4. Run `npm run db:push` to apply
5. Update route handlers to handle new field
6. Update response types (TypeScript infers from schema)

### Authorization Pattern
1. Apply authMiddleware to route: `app.use('*', authMiddleware)`
2. Extract userId: `const userId = getUserId(c)`
3. Check ownership before operations:
   ```typescript
   const [resource] = await db.select().from(table)
     .where(and(
       eq(table.id, resourceId),
       eq(table.createdBy, userId)
     ));
   if (!resource) return c.json({ error: "Not found" }, 404);
   ```

## Deployment Notes
- Uses Vercel-compatible format (@hono/node-server compatible)
- Environment variables required at startup
- Database connection string validated before server starts
- All routes require authentication (except health check)
- CORS currently allows all origins (should restrict in production)
