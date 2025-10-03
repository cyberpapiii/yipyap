# Gemini Project Context: YipYap

## Project Overview

YipYap is a local-first, anonymous social playground built with SvelteKit and Supabase. It allows users to post, comment, and vote on content within communities, with a focus on anonymity through device-based identification. Each user is assigned a unique emoji and color per post to maintain anonymity while providing some context within a thread. The application is designed as a Progressive Web App (PWA) for a native-like experience on mobile devices.

**Key Technologies:**

*   **Frontend:** SvelteKit
*   **Backend:** Supabase (PostgreSQL, Auth, Realtime)
*   **Styling:** Tailwind CSS
*   **Testing:** Playwright for E2E tests, Vitest for unit tests

**Architecture:**

The application follows a client-server architecture. The SvelteKit frontend interacts with the Supabase backend through RPC functions for all write operations, ensuring data integrity and security. The database schema is well-structured with tables for users, posts, comments, and votes. Triggers and functions are used to automate tasks like updating scores, comment counts, and user karma.

## Building and Running

**1. Installation:**

```bash
npm install
```

**2. Supabase Setup:**

*   Ensure you have the Supabase CLI installed.
*   Start the local Supabase stack:

```bash
supabase start
```

**3. Environment Variables:**

Create a `.env` file in the root of the project and add the following:

```
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHA6Ly8xMjcuMC4wLjE6NTQzMjEvYXV0aC92MSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJpYXQiOjE3NTg4MjcxMzksImV4cCI6MjA3NDQwMzEzOX0.byK4I20bS0CpsjSErsR7acfZNxDLlDTLHQJu6kcYM8M
```

**4. Running the Development Server:**

```bash
npm run dev
```

## Development Conventions

**Database:**

*   All database writes must go through the RPC functions defined in the migrations.
*   Migrations are located in the `supabase/migrations` directory.
*   To reset the local database and replay migrations:

```bash
supabase db reset --yes
```

**Testing:**

*   The project has a comprehensive test suite.
*   Run unit tests with:

```bash
npm test
```

*   Run E2E tests with:

```bash
npm run test:e2e
```

**Coding Style:**

*   The project uses TypeScript and Svelte.
*   Code is formatted according to the Prettier and ESLint configurations (not explicitly found, but inferred from `package.json`).
*   Static type and Svelte diagnostics can be checked with:

```bash
npm run check
```
