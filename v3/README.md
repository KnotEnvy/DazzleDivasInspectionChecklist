# Dazzle Divas v3

Updated: March 16, 2026

## Summary
v3 is the active Dazzle Divas field operations app built on Bun, React, Vite, and Convex.

The product is already usable for:
- admin property, staffing, template, dispatch, and job cleanup operations
- cleaner and inspector schedule-driven checklist execution
- room tasks, notes, issue capture, and proof photo capture
- admin completed checklist review with photo save/download
- offline queueing and replay for field work

The primary remaining work is deployment execution and launch validation.

## Stack
- Web app: React 19 + Vite 6 + Tailwind 4 + React Router 7
- Backend: Convex functions + Convex storage + Convex Auth
- Runtime/package manager: Bun workspaces
- Offline foundation: IndexedDB outbox queue + PWA service worker
- Shared package: `@dazzle/shared`

## Repo Layout
```text
v3/
  apps/
    web/                # Admin + field web app
  packages/
    backend/            # Convex schema, auth, queries, mutations
    shared/             # shared constants and types
```

## Current Product State

### Shipped
- Staff-only auth with `ADMIN`, `CLEANER`, `INSPECTOR`
- Admin property management
- Admin staffing and assignment management
- Global checklist templates and property-specific overrides
- Service plans, generated jobs, dispatch, and month/week/day scheduling
- Worker-focused `/my-schedule`
- Room-first checklist execution
- Task-level issue capture with notes
- Proof photo upload/removal
- Completed checklist history with today's finished jobs surfaced first
- Admin completed checklist review with room notes, issue visibility, and photo galleries
- Photo save/download workflow for completed jobs, including iPhone-sized copies
- Admin dispatch job deletion for non-linked, non-completed jobs
- Offline outbox and replay with conflict handling
- Pilot test property seeding
- Mobile UX improvements driven by cleaner feedback

### Still Missing
- deployment execution and launch signoff
- invite/reset-password flow

## Local Setup
1. Install dependencies.

```bash
cd v3
bun install
```

2. Configure env files.

```bash
cp packages/backend/.env.local.example packages/backend/.env.local
cp apps/web/.env.local.example apps/web/.env.local
```

3. Start backend.

```bash
bun run dev:backend
```

4. Configure Convex Auth once per project.

```bash
bun run setup:auth
```

5. Start the web app.

```bash
bun run dev:web
```

Or run both from one terminal:

```bash
bun run dev
```

The web dev server is configured for LAN testing on port `5173`.

## Deployment Shape
- Frontend host: Cloudflare Pages
- Backend host: Convex
- Required frontend env var: `VITE_CONVEX_URL`
- Frontend build command: `bun run build:web`
- Frontend output directory: `apps/web/dist`

See [PILOT_DEPLOYMENT_RUNBOOK.md](./PILOT_DEPLOYMENT_RUNBOOK.md) for the full deploy process.

## Verification Commands
Run these before shipping meaningful changes:

```bash
bun run test
bun run typecheck
bun run typecheck:backend
bun run build:web
```

For rollout validation:

```bash
bun run smoke:rollout
```

## Current Focus
1. Execute backend and frontend deployment.
2. Run launch smoke on the deployed environment.
3. Capture final environment fixes and rollout notes.

See:
- [PILOT_DEPLOYMENT_RUNBOOK.md](./PILOT_DEPLOYMENT_RUNBOOK.md)
- [FINALIZATION_DEPLOY_HANDOFF.md](./FINALIZATION_DEPLOY_HANDOFF.md)
- [HANDOFF_TEST_PLAN.md](./HANDOFF_TEST_PLAN.md)
