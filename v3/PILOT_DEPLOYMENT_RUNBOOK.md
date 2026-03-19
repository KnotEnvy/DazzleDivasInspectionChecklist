# Dazzle Divas v3 Pilot Deployment Runbook

Updated: March 16, 2026

## Pilot Readiness Recommendation
v3 is ready for a tightly controlled deployment with 1-2 cleaners, 1-2 inspectors, and one active admin because:
- internal user network tests have been successful
- admin completed review and photo save flows are now shipped
- admin can clean up disposable dispatch jobs directly before launch
- the remaining work is deployment execution and launch validation, not another product rebuild

This is still a controlled rollout recommendation, not a broad open invite.

## Current State
- the app is in deployment-prep mode
- admin completed checklist review is shipped
- completed photo save/download is shipped, including iPhone-sized copies
- dispatch job deletion is shipped for non-linked, non-completed jobs
- deployment should now be treated as the primary workstream

## Recommended Free Host
Use Cloudflare Pages for the frontend deployment.

Why this still fits:
- the web app is a static Vite build
- Pages covers static assets, SSL, and global delivery cleanly
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
6. Run the deployed manual checks below.

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

## Cloudflare Pages Setup
1. Push the current `v3` branch to GitHub.
2. In Cloudflare Pages, create a new project from that repository.
3. Set the project root to `v3`.
4. Set the build command to `bun run build:web`.
5. Set the output directory to `apps/web/dist`.
6. Add the environment variable `VITE_CONVEX_URL` using the target Convex deployment URL.
7. Trigger the first deployment.

## Included Hosting Safeguards
- `apps/web/public/_redirects` rewrites SPA routes to `index.html`, so deep links like `/my-schedule` and `/checklists/:id` work on refresh.
- `apps/web/public/_headers` keeps the HTML, service worker, and manifest fresh while allowing hashed assets to cache aggressively.
- the frontend fails with a visible configuration screen if `VITE_CONVEX_URL` is missing or malformed instead of crashing silently

## Pilot Operations Rules
- start with admin-managed accounts only
- keep the pilot group small enough that queue conflicts can be reviewed manually
- ask cleaners to report any sync warning immediately with a screenshot of the queue panel
- review today's completed history and at least one completed checklist every day during the pilot week
- validate iPhone-sized photo save and dispatch job deletion during the first deployment day

## Deployed Smoke

### Worker
1. Open schedule.
2. Start or resume checklist.
3. Complete tasks.
4. Add issue notes.
5. Upload photos.
6. Complete checklist.

### Admin
1. Open `/history`.
2. Confirm today's finished jobs appear first.
3. Open a completed checklist.
4. Save at least one iPhone-sized photo copy.
5. Confirm the file is easy to reuse outside the app.
6. Delete one disposable scheduled or cancelled job from dispatch.

### Offline
1. Put a worker device offline.
2. Capture progress and photos.
3. Reconnect.
4. Confirm replay.
5. Confirm completed evidence is still correct from admin side.

## Known Non-Blocking Gaps
- no invite/reset-password flow yet
- starting a checklist fully offline from the schedule still queues the start instead of opening a local draft immediately
- conflict handling is strong, but still depends on operators reviewing the queue panel when conflicts appear
