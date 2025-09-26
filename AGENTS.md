# Repository Guidelines

## Project Structure & Module Organization
The SvelteKit app lives in `src/`, with routes under `src/routes/` (e.g., `thread/[id]`) and shared UI or utilities in `src/lib/`. Database SQL and Supabase RPC definitions are kept in `supabase/migrations/`. Static assets, including the manifest and icons, stay in `static/` and `public/`. Legacy push handlers remain in `server/` for reference but are not part of the current flow.

## Build, Test, and Development Commands
Use `npm run dev` to start the hot-reloading dev server. `npm run build` compiles the server, client, and service worker bundles, and `npm run preview` serves the production build for local verification. Run `npm run check` before committing to ensure Svelte and TypeScript diagnostics pass.

## Coding Style & Naming Conventions
Code is TypeScript-first with Svelte 5 runes. Favor small modules and colocated helpers. Components live in `src/lib/components/` using PascalCase filenames, while routes are lowercase folders. Keep indentation at two spaces and limit Tailwind utility chains to what is necessary. Prefer explicit types in shared APIs.

## Testing Guidelines
There is no formal suite yet; when adding coverage, reach for Vitest and `@testing-library/svelte`. Place component tests beside their subjects (e.g., `Component.test.ts`). Tests should cover critical flows like feed loading, posting, voting, and commenting. Run them with `npx vitest` or integrate into `npm run check` if scripted.

## Commit & Pull Request Guidelines
Write commit subjects in the imperative mood with optional scopes, such as `feat(feed): add Hot RPC`. Pull requests should include a brief summary, validation steps, and screenshots for UI changes. Link related issues and call out affected routes or migrations so reviewers can focus their checks.

## Security & Configuration Tips
All database writes must flow through Supabase RPCs because RLS is enforced; avoid direct table mutations from the client. Store secrets in environment variables and sync any schema change with a migration under `supabase/migrations/`.
