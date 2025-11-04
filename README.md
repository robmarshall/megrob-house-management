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
- **Supabase** - PostgreSQL database
- **TypeScript** - Type-safe development

### Frontend

- **Vite** - Fast build tool
- **React** - UI library
- **TypeScript** - Type-safe development

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- Supabase account (for database)

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

4. Update `.env` with your Supabase credentials:

```env
SUPABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
PORT=3000
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

The backend uses Drizzle ORM with Supabase PostgreSQL:

1. Define your schema in `backend/src/db/schema.ts`
2. Push changes to the database: `npm run db:push`
3. Use Drizzle Studio to view your data: `npm run db:studio`

### API Endpoints

Example endpoints available in the backend:

- `GET /` - Hello world
- `GET /health` - Health check
- `GET /users` - Get all users (example endpoint)

## Next Steps

- Add more database tables in `backend/src/db/schema.ts`
- Create API routes in `backend/src/index.ts`
- Build UI components in `frontend/src`
- Set up authentication (consider Supabase Auth)
- Add environment-specific configurations
- Set up CI/CD pipeline

## Learn More

- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
