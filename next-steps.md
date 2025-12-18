# Migration Next Steps: Supabase to Better Auth

This document outlines the remaining steps to complete the migration from Supabase to PostgreSQL + Better Auth.

---

## 1. Set Up Environment Variables

### Backend (`backend/.env`)

Create or update the `.env` file with these variables:

```env
# Server Configuration
PORT=3000

# Database Connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/homemanagement

# Better Auth Configuration
BETTER_AUTH_SECRET=<generate-a-32-char-secret>
BETTER_AUTH_URL=http://localhost:3000

# Frontend URL (for CORS and password reset redirects)
FRONTEND_URL=http://localhost:5173

# SMTP Configuration (for password reset emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Home Management <your-email@gmail.com>"
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
VITE_FRONTEND_URL=http://localhost:5173
```

---

## 2. Generate BETTER_AUTH_SECRET

The secret must be at least 32 characters. Generate one using:

```bash
# Using OpenSSL
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output to your `BETTER_AUTH_SECRET` environment variable.

---

## 3. Set Up SMTP for Email

The app uses Nodemailer to send password reset emails via SMTP. You can use any SMTP provider.

### Option A: Gmail (Free - 500 emails/day)

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Sign in and create a new App Password for "Mail"
3. Copy the 16-character password

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # App password (not your regular password)
SMTP_FROM="Home Management <your-email@gmail.com>"
```

**Note**: You must have 2-Factor Authentication enabled on your Google account to use App Passwords.

### Option B: Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM="Home Management <your-email@outlook.com>"
```

### Option C: Custom SMTP Server

```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM="Home Management <noreply@yourdomain.com>"
```

### Option D: Third-party Services (Mailgun, SendGrid, etc.)

These services often have free tiers and better deliverability:

**Mailgun:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
SMTP_FROM="Home Management <noreply@yourdomain.com>"
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM="Home Management <noreply@yourdomain.com>"
```

**Note**: In development, password reset URLs are also logged to the console as a fallback if email fails.

---

## 4. Run Database Migration

The migration will create these new tables:
- `user` - User accounts
- `session` - Active sessions
- `account` - Authentication providers (stores password hashes)
- `verification` - Password reset tokens

It will also update:
- `shopping_lists.created_by` - UUID → TEXT
- `shopping_lists.updated_by` - UUID → TEXT
- `shopping_list_items.created_by` - UUID → TEXT
- `shopping_list_items.updated_by` - UUID → TEXT
- `shopping_list_items.checked_by` - UUID → TEXT

### Run the migration:

```bash
cd backend

# Generate migration files
npm run db:generate

# Apply to database
npm run db:push
```

---

## 5. Migrate Existing Users from Supabase

Since password hashes cannot be exported from Supabase, all migrated users will need to reset their passwords.

### Step 5.1: Export Users from Supabase

In Supabase Dashboard:
1. Go to **Authentication** → **Users**
2. Export users (or query directly)

Or use SQL:
```sql
SELECT id, email, raw_user_meta_data->>'name' as name, created_at
FROM auth.users;
```

### Step 5.2: Create Migration Script

Create a file `backend/scripts/migrate-users.ts`:

```typescript
import { db } from '../src/db/index.js';
import { user, account } from '../src/db/schema.js';
import { sendPasswordResetEmail } from '../src/lib/email.js';

// Users exported from Supabase
const supabaseUsers = [
  { id: 'uuid-from-supabase', email: 'user@example.com', name: 'User Name' },
  // Add more users...
];

async function migrateUsers() {
  for (const supaUser of supabaseUsers) {
    console.log(`Migrating user: ${supaUser.email}`);

    // Generate a new ID or use the existing UUID as text
    const userId = supaUser.id;

    // Insert user
    await db.insert(user).values({
      id: userId,
      email: supaUser.email.toLowerCase(),
      name: supaUser.name || supaUser.email.split('@')[0],
      emailVerified: true, // They verified via Supabase
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    // Create account with placeholder password
    // Users will need to reset their password
    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: userId,
      providerId: 'credential',
      password: 'NEEDS_RESET', // Placeholder - won't work for login
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    console.log(`  ✓ User migrated: ${supaUser.email}`);
  }

  console.log('\nMigration complete!');
  console.log('Users will need to use "Forgot Password" to set their password.');
}

migrateUsers().catch(console.error);
```

### Step 5.3: Run Migration

```bash
cd backend
npx tsx scripts/migrate-users.ts
```

### Step 5.4: Notify Users

Send an email to all migrated users asking them to reset their password:

```typescript
// In the migration script, add:
for (const supaUser of supabaseUsers) {
  // After inserting user...
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password`;
  await sendPasswordResetEmail(
    supaUser.email,
    resetUrl // They'll need to enter email on this page
  );
}
```

Or send a bulk notification separately explaining the migration.

---

## 6. Update Existing Data (If Applicable)

If you have existing `shopping_lists` or `shopping_list_items` records that reference Supabase user IDs, you may need to update the foreign key references.

The column type has changed from `uuid` to `text`, but the values should still be compatible if you used the same user IDs during migration.

If you used new IDs, update the references:

```sql
-- Example: Update shopping_lists to use new user IDs
UPDATE shopping_lists
SET created_by = (
  SELECT u.id FROM "user" u
  WHERE u.email = (
    SELECT email FROM supabase_auth_users_backup
    WHERE id = shopping_lists.created_by::text
  )
);
```

---

## 7. Test the Authentication Flow

### 7.1 Start the servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 7.2 Test Login

1. Go to `http://localhost:5173/login`
2. Enter credentials for a migrated user
3. If password wasn't set, use "Forgot Password"

### 7.3 Test Password Reset

1. Go to `http://localhost:5173/reset-password`
2. Enter email address
3. Check email (or console logs in dev) for reset link
4. Click link and set new password
5. Login with new password

### 7.4 Test Protected Routes

1. After login, navigate to shopping lists
2. Create, edit, delete items
3. Verify user ID is properly associated

### 7.5 Test Logout

1. Click logout
2. Verify redirect to login page
3. Verify protected routes are inaccessible

---

## 8. Clean Up (Optional)

After successful migration and testing:

### 8.1 Remove Supabase Local Config

```bash
rm -rf supabase/
```

### 8.2 Update .gitignore

Remove Supabase-related entries if no longer needed.

### 8.3 Remove Old Documentation References

Update any remaining documentation that references Supabase.

---

## Troubleshooting

### "Missing required environment variables"

Ensure all required env vars are set in `.env` files. Check the `.env.example` files for reference.

### "Invalid or expired session"

- Clear browser cookies
- Check that `FRONTEND_URL` in backend matches the actual frontend URL
- Ensure CORS is configured correctly (credentials: true)

### "Failed to send password reset email"

- Verify SMTP credentials are correct
- For Gmail, ensure you're using an App Password (not your regular password)
- Check that 2FA is enabled on your Google account
- Check console logs for the reset URL (fallback in dev)
- Try a different SMTP provider

### Database connection errors

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check database exists and user has permissions

### CORS errors

- Ensure `FRONTEND_URL` in backend `.env` matches exactly (including port)
- Check browser console for specific CORS error messages

---

## Summary Checklist

- [ ] Backend `.env` configured with all variables
- [ ] Frontend `.env` configured
- [ ] `BETTER_AUTH_SECRET` generated (32+ chars)
- [ ] SMTP credentials configured and tested
- [ ] Database migration run (`npm run db:push`)
- [ ] Existing users migrated from Supabase
- [ ] Users notified to reset passwords
- [ ] Login flow tested
- [ ] Password reset flow tested
- [ ] Protected routes tested
- [ ] Logout tested
- [ ] Old Supabase config cleaned up (optional)
