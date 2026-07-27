# Supabase Integration Guide

This guide will help you connect the Kings Draw system to Supabase for persistent audit trail storage and public verification.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up or log in
2. Click "New Project"
3. Fill in the project details:
   - **Name**: `kings-draw` (or your preferred name)
   - **Database Password**: Create a strong password and save it
   - **Region**: Choose the region closest to your users
4. Click "Create new project" and wait for it to initialize (2-3 minutes)

## Step 2: Create the `draws_audit` Table

1. In your Supabase project, go to the **SQL Editor** section
2. Click "New Query"
3. Copy and paste the following SQL:

```sql
CREATE TABLE public.draws_audit (
  draw_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_title TEXT NOT NULL,
  entry_count INTEGER NOT NULL,
  winner_tickets JSONB NOT NULL,
  proof_hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.draws_audit ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public read access
CREATE POLICY "Public can view draws_audit" ON public.draws_audit
  FOR SELECT USING (true);

-- Create an index on proof_hash for faster lookups
CREATE INDEX idx_draws_audit_proof_hash ON public.draws_audit(proof_hash);
```

4. Click "Run" to execute the SQL

## Step 3: Get Your Supabase Credentials

1. Go to **Project Settings** (gear icon in the bottom left)
2. Click on **API** in the left sidebar
3. You'll see:
   - **Project URL** (copy this)
   - **Anon Public Key** (copy this)
   - **Service Role Key** (keep this secret, don't share)

## Step 4: Update Your Environment Variables

1. Open `.env` in your project root
2. Add or update these variables:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
```

Replace:
- `your-project-id` with your actual Supabase project ID
- `your-anon-key-here` with your Anon Public Key

## Step 5: Install Supabase Client (Optional - Already Included)

The project already has the necessary dependencies. If you need to reinstall:

```bash
pnpm add @supabase/supabase-js
```

## Step 6: Update the Draw Audit Logic

The current implementation saves to the local MySQL database. To integrate Supabase:

### Option A: Hybrid Approach (Recommended)
Keep local database for immediate access, sync to Supabase asynchronously:

```typescript
// In client/src/components/draw/ClassicDraw.tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// After saving to local database
await supabase.from("draws_audit").insert({
  draw_id: drawId,
  competition_title: csvData.competitionTitle,
  entry_count: csvData.totalEntries,
  winner_tickets: drawnWinners,
  proof_hash: hash,
});
```

### Option B: Supabase Only
Replace the local database calls with Supabase:

```typescript
// Replace the tRPC call with direct Supabase insert
const { error } = await supabase.from("draws_audit").insert({
  draw_id: drawId,
  competition_title: csvData.competitionTitle,
  entry_count: csvData.totalEntries,
  winner_tickets: drawnWinners,
  proof_hash: hash,
});

if (error) throw error;
```

## Step 7: Update the Verification Logic

To verify draws from Supabase:

```typescript
// In client/src/pages/VerifyHash.tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Query Supabase for the draw
const { data, error } = await supabase
  .from("draws_audit")
  .select("*")
  .eq("proof_hash", proofHash)
  .single();

if (error) {
  // Draw not found
  return null;
}

return data;
```

## Step 8: Test the Integration

1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Log in as an admin
3. Go to the Draw Area
4. Upload a CSV file and run a draw
5. Check your Supabase dashboard → **Table Editor** → `draws_audit` to see the recorded draw
6. Go to the Verify page and paste the proof hash to confirm it's retrievable

## Troubleshooting

### "VITE_SUPABASE_URL is not defined"
- Make sure you've added the environment variables to `.env`
- Restart your dev server after updating `.env`

### "Row Level Security (RLS) policy violation"
- Ensure the RLS policy allows public read access (see Step 2)
- The `INSERT` policy should allow authenticated users or be unrestricted

### "JSONB column error"
- Supabase uses JSONB for JSON data. Make sure `winner_tickets` is properly stringified before insertion
- Example: `JSON.stringify(drawnWinners)`

### "Proof hash not found"
- Verify the hash is being stored correctly in Supabase
- Check that the hash is being queried with exact matching (case-sensitive)

## Security Considerations

1. **Anon Key**: The anon key is safe to expose in the browser (it's public)
2. **Service Role Key**: Never expose this in client-side code
3. **RLS Policies**: The current setup allows public read access to all draws (this is intentional for verification)
4. **Data Privacy**: No personal information is stored beyond participant names

## Advanced: Backup and Export

To export all draws from Supabase:

1. Go to **SQL Editor**
2. Run:
   ```sql
   SELECT * FROM draws_audit ORDER BY timestamp DESC;
   ```
3. Click the download button to export as CSV

## Support

For Supabase-specific issues, visit:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)

For Kings Draw issues, refer to the main README.md
