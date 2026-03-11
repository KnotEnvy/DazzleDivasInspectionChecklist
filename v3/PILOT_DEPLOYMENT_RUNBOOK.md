# Dazzle Divas v3 Pilot Deployment Runbook

Updated: March 10, 2026

## Pilot Readiness Recommendation
v3 is ready for a tightly controlled pilot with 1-2 cleaners and 1-2 inspectors if:
- one admin monitors dispatch and queue conflicts daily
- the deployment smoke checklist is run before inviting the pilot group
- the team accepts that invite/reset-password flow is still manual

This is a pilot-only recommendation, not a broad rollout recommendation.

## Recommended Free Host
Use Cloudflare Pages for the frontend pilot deployment.

Why this is the best fit for the current app:
- the web app is a static Vite build
- free Pages hosting covers static assets, SSL, and global delivery cleanly
- free Pages usage includes unlimited static requests and bandwidth, which is a better fit than low fixed bandwidth caps for field testing
- Convex remains the backend, so Pages only needs to host the frontend bundle

## Deployment Shape
- Frontend host: Cloudflare Pages
- Backend host: Convex deployment
- Required frontend environment variable: `VITE_CONVEX_URL`
- Frontend build command: `bun run build:web`
- Frontend output directory: `apps/web/dist`

## Pre-Deploy Gate
1. Run `bun run smoke:rollout`.
2. Run `bun run test`.
3. Run `bun run typecheck`.
4. Run `bun run typecheck:backend`.
5. Run `bun run build:web`.
6. Run the manual checks in `DEPLOYMENT_SMOKE_CHECKLIST.md`.

## Internal Test Data
Use the dev-only Convex mutations below to add or remove the internal network test properties:

```bash
cd v3/packages/backend
npx convex run devTools:seedPilotTestProperties "{confirm:'RESET_DAZZLE_V3'}"
```

Cleanup command:

```bash
cd v3/packages/backend
npx convex run devTools:removePilotTestProperties "{confirm:'RESET_DAZZLE_V3'}"
```

What the seed adds:
- 4 `[TEST PILOT]` residential properties with 1/1, 2/2, 4/3, and 6/4 footprints
- realistic access instructions and service notes
- cleaner/inspector assignments for all active cleaner and inspector accounts
- recurring cleaning and inspection plans
- upcoming seeded jobs when an active admin user exists

## Cloudflare Pages Setup
1. Push the current `v3` branch to GitHub.
2. In Cloudflare Pages, create a new project from that repository.
3. Set the project root to `v3`.
4. Set the build command to `bun run build:web`.
5. Set the output directory to `apps/web/dist`.
6. Add the environment variable `VITE_CONVEX_URL` using the live Convex deployment URL.
7. Trigger the first deployment.

## Included Hosting Safeguards
- `apps/web/public/_redirects` rewrites SPA routes to `index.html`, so deep links like `/my-schedule` and `/checklists/:id` work on refresh.
- `apps/web/public/_headers` keeps the HTML, service worker, and manifest fresh while allowing hashed assets to cache aggressively.
- the frontend now fails with a visible configuration screen if `VITE_CONVEX_URL` is missing or malformed instead of crashing silently

## Pilot Operations Rules
- start with admin-managed accounts only
- keep the pilot group small enough that queue conflicts can be reviewed manually
- ask cleaners to report any sync warning immediately with a screenshot of the queue panel
- review completed history and one report per day during the pilot week

## Known Non-Blocking Gaps
- no invite/reset-password flow yet
- starting a checklist fully offline from the schedule still queues the start instead of opening a local draft immediately
- conflict handling is much stronger now, but still depends on operators reviewing the queue panel when conflicts appear
