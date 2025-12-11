# Repository Guidelines

## Project Structure & Module Organization
- SvelteKit 5 lives in `src/`; routes sit in `src/routes` (`+layout/+page`), shared code in `src/lib` (`components`, `stores`, `api`, `services`, `realtime`, `config`, `types`, `utils`), and shell files in `src/app.html|app.css|service-worker.js`.
- Assets live in `static/`; Supabase migrations/config in `supabase/`; helper scripts in `scripts/` (e.g., `generate-supabase-token.mjs`); tests in `tests/` (API, database, auth, E2E); docs in `docs/`.

## Build, Test, and Development Commands
```bash
npm install               # install dependencies
npm run dev               # Vite dev server
npm run check             # types + Svelte diagnostics
npm run build             # production build
npm run preview           # preview built app
npm test                  # Vitest unit/integration (happy-dom)
npm run test:e2e          # Playwright E2E (requires dev server)
supabase start            # start local Supabase stack
supabase db reset --yes   # rebuild local DB + migrations
```
Use `node scripts/generate-supabase-token.mjs anon|service` to mint JWTs.

## Coding Style & Naming Conventions
- TypeScript-first Svelte 5 (runes); keep existing tab indentation, single quotes, and trailing commas. Match surrounding formatting; no repo-wide formatter.
- Components/files use PascalCase (`Feed.svelte`, `PostCardSkeleton.svelte`); stores/services/utils use camelCase; classes are suffixed with their role (`*API`, `*Service`, `*Manager`).
- Organize components by feature (`feed`, `community`, `compose`, etc.); keep shadcn UI pieces inside `src/lib/components/ui`. Tailwind v4 is available—use concise, purposeful class names.
- Run `npm run check` before pushing; prefer small, focused modules with colocated types and helpers.

## Testing Guidelines
- Vitest covers API/auth/database helpers in `tests/api|auth|database`; Playwright flows live in `tests/e2e`. Naming mirrors the domain (`posts.test.ts`, `user-flows.spec.ts`); add snapshots only when stable.
- Prereqs: Supabase running for all tests; dev server for E2E. Use `npm run test:all` for a full gate. Investigate RLS/permission regressions before marking green.

## Commit & Pull Request Guidelines
- Use the conventional prefixes in the history (`fix: ...`, `refactor: ...`, `chore: ...`, `feat: ...`) with concise scope.
- PRs should state intent, risk, and rollout; link issues/tasks; include screenshots or GIFs for UI changes; note Supabase migration IDs when touched.
- Keep changes small and feature-scoped; add or update tests alongside code.

## Security & Configuration Tips
- Do not commit `.env`; required keys are `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` (local defaults in `README.md`). Rotate tokens with the generator script when the auth secret changes.
- All database writes must use Supabase RPCs (`supabase/migrations/006*_identity.sql`); avoid direct table inserts in code or tests.
- For realtime additions, reuse `src/lib/realtime` managers to preserve connection health and optimistic updates.
