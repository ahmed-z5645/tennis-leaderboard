# Supabase setup (one-time)

The app code is committed, but the cloud project must be created and wired up by hand.

## 1. Create the project
1. Create a project at [supabase.com](https://supabase.com).
2. Project Settings → API: copy the **Project URL** and the **anon public** key into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```
   (Copy `.env.example` to `.env.local` first.)

## 2. Configure auth (magic link only)
- Authentication → Providers → **Email**: enable it, turn **Confirm email / Magic Link** on,
  and disable every other provider.
- Authentication → URL Configuration:
  - **Site URL**: `http://localhost:5173`
  - **Redirect URLs**: add `http://localhost:5173/#/` and your production URL `https://<app>/#/`.

## 3. Apply the schema
```bash
npx supabase login                 # opens a browser for an access token
npx supabase link --project-ref <ref>
npx supabase db push               # applies supabase/migrations/0001_init.sql
```

## 4. Deploy the Edge Functions
```bash
npx supabase functions deploy log-match
npx supabase functions deploy delete-match
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
in the Edge Function runtime — no manual secrets needed.

## 5. Realtime
The migration already adds `matches` and `players` to the `supabase_realtime` publication, so no
dashboard step is required. (Verify under Database → Replication if needed.)

## Local testing (optional)
```bash
npx supabase start                       # local stack (needs Docker)
npx supabase functions serve             # serve functions locally
```
