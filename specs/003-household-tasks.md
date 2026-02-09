# Spec 003: Household Task Management

## Problem
Families need a way to organize, assign, and track recurring household chores and one-off tasks. Currently no task management exists in the app.

## Requirements
- Create tasks with title, description, assignee, due date, and priority (low/medium/high)
- Support recurring tasks (daily, weekly, biweekly, monthly, custom)
- Mark tasks as complete; track who completed and when
- Filter tasks by status (pending, completed, overdue), assignee, priority
- Dashboard view showing today's tasks and overdue items
- Automatic creation of next occurrence when a recurring task is completed

## Database Schema
- `household_tasks` table: id, title, description, assignee_id (FK user, nullable), created_by, priority (low/medium/high), status (pending/completed), due_date (timestamp, nullable), completed_at, completed_by, recurrence_rule (text, nullable - e.g. "weekly:mon,thu"), recurrence_parent_id (FK self, nullable), created_at, updated_at
- Index on: assignee_id, status, due_date, created_by

## API Endpoints
- `GET /api/tasks` - List tasks with filters (status, assignee, priority, due_date range)
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get single task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task (and future recurrences)
- `POST /api/tasks/:id/complete` - Mark complete (auto-creates next recurrence)

## Frontend
- `TasksPage` - Task list with filters and quick-add
- `TaskCard` molecule - Task display with complete/edit actions
- `TaskForm` organism - Create/edit task form
- `useTasks` / `useTaskData` hooks following existing patterns
- Route: `/tasks` (protected)
- Home page card linking to tasks

## Out of Scope
- Points/gamification system
- Calendar integration (Google Calendar, etc.)
- Push notifications
