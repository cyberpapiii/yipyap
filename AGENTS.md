# Repository Guidelines

## Project Structure & Module Organization
The SvelteKit app lives in `src/`, with routes scoped under `src/routes/` (for example `src/routes/thread/[id]`). Shared UI, stores, and helpers belong in `src/lib/`; colocate component-specific utilities beside their owners. Database SQL and Supabase RPC definitions stay in `supabase/migrations/`. Static icons and manifest assets sit in `static/` or `public/`. Legacy push handlers under `server/` are reference-only and should not receive new logic.

## Build, Test, and Development Commands
Run `npm run dev` for the hot-reloading local server. Use `npm run build` to compile the production server, client, and service worker bundles, and `npm run preview` to smoke-test the build locally. Execute `npm run check` before opening a pull request to surface TypeScript and Svelte diagnostics. When you add tests, run them with `npx vitest` or wire them into `npm run check`.

## Coding Style & Naming Conventions
Write TypeScript-first Svelte 5 components using runes. Components in `src/lib/components/` use PascalCase filenames; route folders remain lowercase. Keep modules small, prefer colocated helpers, and default to explicit types in shared APIs. Use two-space indentation and keep Tailwind utility chains concise. Default to ASCII unless an existing file requires otherwise.

## Testing Guidelines
Reach for Vitest with `@testing-library/svelte` to cover critical flows like feed loading, posting, voting, and commenting. Place test files next to their targets, e.g. `src/lib/components/Composer.test.ts`. Favor behavioural assertions over implementation details and update fixtures when Supabase RPCs change.

## Commit & Pull Request Guidelines
Write commits in imperative mood optionally scoped, such as `feat(feed): add Hot RPC`. Pull requests should summarize the change, link related issues, list validation steps, and include screenshots for any UI updates. Call out affected routes or migrations so reviewers can focus their checks.

## Security & Configuration Tips
Route all database writes through Supabase RPCs to respect RLS. Keep secrets in environment variables and never commit them. Pair schema changes with a matching migration under `supabase/migrations/` and document any manual setup required for reviewers.
