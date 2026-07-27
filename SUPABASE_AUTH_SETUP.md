# Supabase Authentication Setup Guide

This guide will help you set up Supabase Authentication for the The Cash Kings platform.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up or log in
2. Click **New Project**
3. Fill in the project details and click **Create new project**
4. Wait for it to initialize (2–3 minutes)

## Step 2: Enable Email/Password Authentication

1. Go to **Authentication** → **Providers**
2. Find **Email** and toggle it **ON**
3. Save

## Step 3: Create the `admins` Table

1. Go to **SQL Editor** → **New Query**
2. Paste and run the following SQL:

```sql
-- Create admins table
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to check if they are in the admins table
-- (reading only their own row)
CREATE POLICY "Users can check their own admin status"
  ON public.admins
  FOR SELECT
  USING (auth.uid() = user_id);
```

3. Click **Run**

> **Why this policy?** The app checks `admins` using the logged-in user's JWT, so each user
> can only ever read their own row — they cannot enumerate other admins.

## Step 4: Get Your Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL**
   - **Anon / Public Key**

## Step 5: Set Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key-here"
```

Restart the dev server after updating `.env`.

## Step 6: Create Your First Admin User

### Option A: Via Supabase Dashboard (recommended)

1. Go to **Authentication** → **Users** → **Add user**
2. Enter an email and password, click **Create**
3. Copy the user's **UID**
4. Go to **SQL Editor** and run:

```sql
INSERT INTO public.admins (user_id) VALUES ('paste-uid-here');
```

### Option B: Sign up via the app then promote via SQL

1. Use the Admin Login form on the home page to create an account
   (sign-up currently requires Supabase dashboard — see Optional Enhancements in `todo.md`)
2. Get the UID from **Authentication** → **Users**
3. Run the INSERT above

## Step 7: Test the Login

1. Run `npm run dev`
2. Go to `http://localhost:3000`
3. Click **Admin Login**, enter your credentials
4. You should see the **Draw Area** button in the nav
5. Click it to access the admin panel

## Troubleshooting

| Problem | Fix |
|---|---|
| `VITE_SUPABASE_URL is not defined` | Add vars to `.env` and restart dev server |
| `Invalid login credentials` | Check user exists in **Authentication → Users** |
| Logged in but still "Access Denied" | User not in `admins` table — run the INSERT SQL |
| `Cannot connect to Supabase` | Verify URL and Anon Key are correct |

## Security Notes

- **Anon Key** — safe to include in frontend code (it's public by design)
- **Service Role Key** — never expose in client-side code
- The `admins` table is protected by RLS; users can only read their own row

## Next Steps

- Add a sign-up form for self-registration
- Build an admin management UI to promote/demote users
- Add password reset via `supabase.auth.resetPasswordForEmail()`
- Enable MFA in Supabase **Authentication → MFA**

---

**References**
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
