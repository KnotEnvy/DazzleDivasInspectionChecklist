# Dazzle Divas v3 (Bun + Convex + PWA)

This is the new `v3` starter optimized for fast field workflows and simple free-tier deployment.

## Stack

- Web app: React 19 + Vite 6 + Tailwind 4 + React Router 7
- Backend: Convex functions + Convex storage + Convex Auth
- Package manager/runtime: Bun workspaces
- Monorepo orchestration: Bun workspaces + filtered scripts
- Offline foundation: IndexedDB outbox queue + PWA service worker
- Shared domain package: `@dazzle/shared`

## Folder Layout

```text
v3/
  apps/
    web/                # Field + admin web app (PWA)
  packages/
    backend/            # Convex schema + functions + auth
    shared/             # shared constants/types (roles, checklist types)
```

## What Is Included

- Three-role model from day one: `ADMIN`, `CLEANER`, `INSPECTOR`
- Checklist type split: `CLEANING` and `INSPECTION`
- Property assignment model keyed by role (`CLEANER`/`INSPECTOR`)
- Secure access checks in backend helpers for inspection/room/task/photo operations
- Mobile-first shell with large touch targets
- Offline outbox for "create checklist" when offline
- PWA manifest + service worker + installable app shell

## Local Setup

1. Install dependencies.

```bash
cd v3
bun install
```

2. Configure environment files.

```bash
cp packages/backend/.env.local.example packages/backend/.env.local
cp apps/web/.env.local.example apps/web/.env.local
```

3. Start backend codegen + dev server (required first run).

```bash
bun run dev:backend
```

4. Configure Convex Auth env vars (required once per Convex project).

```bash
bun run setup:auth
```

When prompted, keep `SITE_URL` as `http://localhost:5173` for local dev and allow key generation (`JWT_PRIVATE_KEY` + `JWKS`).

5. Start the web app.

```bash
bun run dev:web
```

Or start both from `/v3` in one terminal:

```bash
bun run dev
```

## Reusing Your Existing Convex Dev Deployment

If `npx convex dev` reports schema validation errors from old v2 data (for example missing `rooms.isActive`), wipe the existing deployment data in the Convex dashboard first, then run v3.

In Convex Dashboard -> Data, clear these tables:

- `photos`
- `taskResults`
- `roomInspections`
- `inspections`
- `propertyAssignments`
- `tasks`
- `rooms`
- `properties`
- `users`
- `authVerificationCodes`
- `authRefreshTokens`
- `authSessions`
- `authVerifiers`
- `authAccounts`
- `authRateLimits`

After clearing tables:

```bash
cd v3
bun run dev:backend
```

Optional: once backend is running, you can also run a full reset from CLI:

```bash
npx convex run devTools:resetProjectData '{"confirm":"RESET_DAZZLE_V3"}'
```

Then seed base v3 data:

```bash
npx convex run devTools:seedStarterData '{"confirm":"RESET_DAZZLE_V3"}'
```

If you see `Missing environment variable JWT_PRIVATE_KEY`, run:

```bash
cd v3
bun run setup:auth
```

Then restart `bun run dev:backend`.

## Test Users (Credentials)

Create these via the login page Sign Up flow.
New accounts default to `CLEANER`.

- Admin: `admin@dazzledivas.test` / `DazzleAdmin123!`
- Cleaner: `cleaner@dazzledivas.test` / `DazzleCleaner123!`
- Inspector: `inspector@dazzledivas.test` / `DazzleInspector123!`

Assign roles after signup:

```bash
npx convex run devTools:setUserRoleByEmail '{"confirm":"RESET_DAZZLE_V3","email":"admin@dazzledivas.test","role":"ADMIN"}'
npx convex run devTools:setUserRoleByEmail '{"confirm":"RESET_DAZZLE_V3","email":"cleaner@dazzledivas.test","role":"CLEANER"}'
npx convex run devTools:setUserRoleByEmail '{"confirm":"RESET_DAZZLE_V3","email":"inspector@dazzledivas.test","role":"INSPECTOR"}'
```

Assign cleaner and inspector to all active properties:

```bash
npx convex run devTools:assignUserToAllProperties '{"confirm":"RESET_DAZZLE_V3","email":"cleaner@dazzledivas.test","assignmentRole":"CLEANER"}'
npx convex run devTools:assignUserToAllProperties '{"confirm":"RESET_DAZZLE_V3","email":"inspector@dazzledivas.test","assignmentRole":"INSPECTOR"}'
```

After at least one admin exists, role changes can also be done in the web Admin Console.

## Important Convex Note

The web package imports `convex/_generated/*` from `packages/backend/convex/_generated`.
Those files appear after `convex dev` or `convex codegen` runs.

## Cloudflare Pages (Free Tier) Deploy

Use this for the web app.

- Project root: `v3`
- Build command: `bun run build:web`
- Build output directory: `apps/web/dist`

Required env var in Cloudflare Pages:

- `VITE_CONVEX_URL` = your production Convex URL

Before each production deploy, ensure Convex generated files are up to date:

```bash
cd v3/packages/backend
bun run build
```

Commit the generated backend files if your Pages build does not run Convex codegen.

## Convex Deployment

Deploy backend separately:

```bash
cd v3/packages/backend
bun run deploy
```

## Next Priorities

1. Add room-level pages for task/photo capture in v3 web.
2. Expand outbox queue from "create checklist" to room task/photo operations.
3. Add tests for permission boundaries and offline sync behavior.
4. Add CSV/PDF export actions.
