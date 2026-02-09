# Spec 009: List Sharing & Household Collaboration

## Problem
The database has `created_by` and `updated_by` fields but all data is isolated per user. There's no way to share shopping lists, recipes, or meal plans with household members. The current "shared household" model mentioned in RECIPES-PLAN.md isn't actually implemented - each user only sees their own data.

## Requirements

### Household Model
- Create "households" that users belong to
- All members of a household share shopping lists, recipes, and (future) meal plans/tasks/inventory
- One user creates the household and invites others via email
- Invitation flow: invite sent by email, recipient clicks link, joins household
- A user belongs to exactly one household (or none)

### Sharing Behavior
- Shopping lists: visible and editable by all household members
- Recipes: visible and editable by all household members
- Attribution: show who created/modified items (already tracked in DB)
- All existing queries filter by household instead of individual user

### User Management
- Household creator can invite/remove members
- Members can leave a household
- Simple settings page showing household members

## Database Schema
- `households` table: id, name, created_by, created_at
- `household_members` table: id, household_id (FK), user_id (FK), role (owner/member), joined_at
- `household_invitations` table: id, household_id (FK), email, invited_by, status (pending/accepted/declined), created_at, expires_at
- Modify all data queries to filter by household_id via the user's membership

## API Endpoints
- `POST /api/households` - Create household
- `GET /api/households/current` - Get user's household with members
- `POST /api/households/invite` - Invite member by email
- `POST /api/households/join/:invitationId` - Accept invitation
- `DELETE /api/households/members/:userId` - Remove member (owner only)
- `POST /api/households/leave` - Leave household

## Frontend
- `HouseholdSettingsPage` - Manage household, invite members
- Settings accessible from AppHeader menu
- Show member avatars/names on shared lists

## Out of Scope
- Per-item permissions (all-or-nothing sharing)
- Multiple households per user
- Real-time presence (who's viewing what)
