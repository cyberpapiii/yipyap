# YipYap

Local-first anonymous social playground built with SvelteKit 5 runes and Supabase realtime.

## Quickstart

```bash
npm install
supabase start
npm run dev
```

The app reads `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from your `.env`. For the bundled local Supabase stack they should be:

```ini
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHA6Ly8xMjcuMC4wLjE6NTQzMjEvYXV0aC92MSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJpYXQiOjE3NTg4MjcxMzksImV4cCI6MjA3NDQwMzEzOX0.byK4I20bS0CpsjSErsR7acfZNxDLlDTLHQJu6kcYM8M
```

Those values are JWTs signed with the local Supabase auth secret (`super-secret-jwt-token-with-at-least-32-characters-long`). If you ever rotate the secret, mint fresh anon/service tokens with the small helper below:

```bash
node ./scripts/generate-supabase-token.mjs anon   # or service
```

_(Script example lives in `scripts/generate-supabase-token.mjs`; copy the output into `.env`.)_

## Routine Tasks

- `npm run check` – static type and Svelte diagnostics.
- `npm run build` / `npm run preview` – production bundle & local preview.
- `supabase db reset --yes` – rebuild the local database and replay migrations.

Supabase REST and RPC access is RLS-locked; all writes must go through the RPCs defined under `supabase/migrations/006*_identity.sql`.
