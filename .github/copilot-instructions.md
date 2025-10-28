## Repository snapshot

This is a small Vite + React + TypeScript app that uses Supabase for auth and data storage. Key folders/files:

- `src/contexts/AuthContext.tsx` — Central auth provider, reads Supabase session and keeps `user` + `profile` in context. Many components rely on `useAuth()`.
- `src/lib/supabase.ts` — Supabase client creation and TypeScript interfaces (UserProfile, Location, BETRecord).
- `src/components/*` — UI pages (LoginPage, Dashboard, UserManagement, BETRecordForm).
- `supabase/migrations/` — DB schema migration SQL (useful for understanding table shapes, e.g. `user_profiles`, `bet_records`).
- `package.json` — dev scripts: `dev`, `build`, `preview`, `lint`, `typecheck`.

## Big-picture architecture

- Single-page React app bootstrapped with Vite. `App.tsx` wraps the UI in `AuthProvider` and either shows the login page or the dashboard depending on auth state.
- Supabase is the only backend. The client is created from Vite env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` read in `src/lib/supabase.ts`.
- Data flows: UI -> Supabase client methods in components/contexts -> Supabase (tables shown in migrations). Auth state is kept in `AuthContext` which calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange`.

## What AI coding agents should know (actionable)

1. Environment & secrets
   - The app expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in env. For local dev, use a `.env` file at project root with those variables.
   - Avoid hardcoding keys. Use `import.meta.env.VITE_*` like `src/lib/supabase.ts`.

2. Auth conventions
   - `useAuth()` returns `{ user, profile, loading, signIn, signOut }` and must be called inside `AuthProvider` (see `App.tsx`).
   - User profile is fetched from the `user_profiles` table by `id` (supabase user id). Components expect `profile.role` to be one of `'super_admin'|'admin'|'user'`.

3. Database shape hints
   - Refer to `supabase/migrations/20251017054535_create_bet_tracker_schema.sql` for exact column names and constraints. Typical tables: `user_profiles`, `locations`, `bet_records` (fields match interfaces in `src/lib/supabase.ts`).

4. Coding patterns & conventions
   - TypeScript strictness: project uses typechecking via `npm run typecheck` (runs `tsc --noEmit -p tsconfig.app.json`). Prefer explicit types for exported interfaces and React props.
   - State & side effects: `AuthContext` uses `useEffect` + Supabase subscription. Follow the same pattern when adding listeners; always unsubscribe in cleanup.
   - Component styling follows Tailwind (see `tailwind.config.js`). Keep markup classNames concise and use existing utility classes.

5. Common tasks examples (copyable snippets)
   - Sign in (used in `LoginPage`):
     const { signIn } = useAuth();
     await signIn(email, password);

   - Query a table and return single result (pattern used in `AuthContext`):
     const { data, error } = await supabase
       .from('user_profiles')
       .select('*')
       .eq('id', userId)
       .maybeSingle();

6. Scripts & dev flow
   - Start dev server: `npm run dev` (Vite). App expects env vars to connect to Supabase.
   - Build: `npm run build`. Preview static build: `npm run preview`.
   - Lint: `npm run lint` (eslint configured at repo root).
   - Typecheck: `npm run typecheck`.

7. Tests & CI
   - There are no tests or CI configs included. If adding tests, keep them lightweight and isolated from Supabase (mock the client or use a test-specific Supabase project).

8. When editing backend-related code
   - If you change table/column names, update `supabase/migrations/*` and the TypeScript interfaces in `src/lib/supabase.ts` together.
   - Keep `UserProfile` and `BETRecord` interfaces in sync with DB to prevent runtime errors.

9. Files to inspect for context when working on a feature
   - `src/contexts/AuthContext.tsx` — auth lifecycle and profile fetch.
   - `src/lib/supabase.ts` — client creation + types.
   - Components that interact with data: `src/components/UserManagement.tsx`, `src/components/BETRecordForm.tsx`, `src/components/Dashboard.tsx`.

## Quick debugging tips
   - If auth seems broken, check browser env vars and Supabase keys. Inspect `supabase.auth.getSession()` output in the console.
   - For data shape mismatches, open `supabase/migrations/20251017054535_create_bet_tracker_schema.sql` to confirm expected columns.

## Do not change without human review
   - `supabase/migrations/*.sql` — schema changes affect production. Coordinate before editing.
   - Environment variable names and client creation logic in `src/lib/supabase.ts`.

---

If anything important is missing (for example local .env conventions, a staging Supabase project URL, or CI checks), tell me what to add and I'll update this file.
