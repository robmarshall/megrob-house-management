# Home Management App

## Purpose

This is a comprehensive home management application designed to simplify and organize daily household activities. The app serves as a central hub for managing various aspects of home life, helping families and individuals stay organized and efficient.

## Core Features

### 1. Shopping List Management
- Create and maintain multiple shopping lists (groceries, hardware, etc.)
- Organize items by category or store
- Share lists with family members in real-time
- Check off items as you shop
- Track purchase history

### 2. Recipe Management
- Store and organize favorite recipes
- Search recipes by ingredients, cuisine, or dietary restrictions
- Scale recipes for different serving sizes
- Add notes and modifications to recipes
- Link recipes directly to shopping lists

### 3. Meal Planning
- Plan meals for the week or month
- Automatically generate shopping lists from meal plans
- Track nutritional information
- Reuse favorite meal plans

### 4. Household Task Management (Planned)
- Create and assign chores
- Set recurring tasks with reminders
- Track completion and household contributions
- Manage maintenance schedules for appliances and systems

### 5. Inventory Tracking (Planned)
- Keep track of pantry items and their expiration dates
- Monitor household supplies
- Get alerts when items are running low
- Track warranty information for appliances

## Technology Stack

### Frontend
- **React 19** - Modern UI framework with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first styling framework
- **React Router** - Client-side routing
- **React Hook Form** - Efficient form state management
- **Headless UI** - Accessible component primitives
- **Framer Motion** - Smooth animations and transitions

### Backend
- **Supabase** - Backend-as-a-Service platform
  - PostgreSQL database
  - Real-time subscriptions
  - Authentication and user management
  - Row-level security
  - File storage

## Architecture

The frontend follows **Atomic Design** methodology:
- **Atoms**: Basic UI elements (buttons, inputs, labels)
- **Molecules**: Simple component combinations (form fields, cards)
- **Organisms**: Complex, reusable components (forms, navigation)
- **Templates**: Page layouts and structure
- **Pages**: Complete views with data and routing

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Git

### Getting Started

1. Clone the repository
```bash
git clone <repository-url>
cd megrob
```

2. Install frontend dependencies
```bash
cd frontend
npm install
```

3. Install backend dependencies
```bash
cd ../backend
npm install
```

4. Set up environment variables
```bash
# In frontend/.env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# In backend/.env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

5. Run the development server
```bash
# Frontend
cd frontend
npm run dev

# Backend (if needed)
cd backend
npm run dev
```

## Project Status

### ✅ Completed
- Authentication system (login, password reset)
- Protected routing with auth guards
- Basic atomic component library
- Supabase integration
- TypeScript configuration
- Tailwind CSS theming

### 🚧 In Progress
- Code refactoring to align with best practices
- Enhanced component library
- Frontend style guide

### 📋 Planned
- Shopping list feature
- Recipe management
- Meal planning
- Household task tracking
- Inventory management
- Mobile responsive design
- Dark mode support
- Progressive Web App (PWA) features

## Contributing

See `frontend/STYLE_GUIDE.md` for frontend development guidelines and `CLAUDE.md` for comprehensive coding standards.

## License

[To be determined]
