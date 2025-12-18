# Monorepo Project

A full-stack monorepo project with separate frontend and backend applications.

## Project Structure

```
.
├── backend/          # Hono API with Drizzle ORM
├── frontend/         # Vite + React application
└── README.md
```

## Tech Stack

### Backend

- **Hono** - Fast, lightweight web framework
- **Drizzle ORM** - TypeScript ORM for PostgreSQL
- **PostgreSQL** - Database (hosted on Coolify)
- **Better Auth** - Session-based authentication
- **TypeScript** - Type-safe development

### Frontend

- **Vite** - Fast build tool
- **React** - UI library
- **TypeScript** - Type-safe development

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- PostgreSQL database (local or hosted on Coolify)

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update `.env` with your database credentials (see `.env.example` for all options):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/homemanagement
PORT=3000
BETTER_AUTH_SECRET=your-secret-key-here-minimum-32-characters
BETTER_AUTH_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

5. Generate and push the database schema:

```bash
npm run db:push
```

6. Start the development server:

```bash
npm run dev
```

The API will be running at `http://localhost:3000`

#### Backend Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update `.env` with your backend API URL (default is fine for local dev):

```env
VITE_API_URL=http://localhost:3000
```

5. Start the development server:

```bash
npm run dev
```

The frontend will be running at `http://localhost:5173`

#### Frontend Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Development Workflow

### Running Both Applications

In separate terminal windows:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Database Management

The backend uses Drizzle ORM with PostgreSQL:

1. Define your schema in `backend/src/db/schema.ts`
2. Push changes to the database: `npm run db:push`
3. Use Drizzle Studio to view your data: `npm run db:studio`

### Connecting to the Database

#### Local Development

For local development, you can use a local PostgreSQL instance:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/homemanagement
```

#### Production (Coolify)

The production database is hosted on Coolify. To connect:

1. **Via Coolify Dashboard**: Go to your PostgreSQL resource and find the connection details
2. **Connection String Format**:
   ```
   postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require
   ```
3. **With SSL enabled** (recommended for production):
   ```env
   DATABASE_URL=postgresql://postgres:yourpassword@your-coolify-host:5432/postgres?sslmode=require
   ```

#### Using psql CLI

```bash
# Local
psql -h localhost -U postgres -d homemanagement

# Production (with SSL)
psql "postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require"
```

#### Using Drizzle Studio

```bash
cd backend
npm run db:studio
```

This opens a web UI at `https://local.drizzle.studio` to browse and edit your data.

### API Endpoints

Example endpoints available in the backend:

- `GET /` - Hello world
- `GET /health` - Health check
- `GET /users` - Get all users (example endpoint)

## Next Steps

- Add more database tables in `backend/src/db/schema.ts`
- Create API routes in `backend/src/index.ts`
- Build UI components in `frontend/src`
- Add environment-specific configurations
- Set up CI/CD pipeline

## Learn More

- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Better Auth Documentation](https://www.better-auth.com/)
- [Coolify Documentation](https://coolify.io/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
