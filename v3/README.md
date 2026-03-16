# Dazzle Divas v3

Updated: March 15, 2026

## Summary
v3 is the active Dazzle Divas field operations app built on Bun, React, Vite, and Convex.

The product is already usable for:
- admin property, staffing, template, and dispatch operations
- cleaner and inspector schedule-driven checklist execution
- room tasks, notes, issue capture, and proof photo capture
- offline queueing and replay for field work

The main remaining product feature is on the admin side:
- review completed checklists in a workflow-friendly way
- download photo evidence cleanly for upload into Breezeway

After that, the app should move into final hardening and deployment.

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
- Completed checklist history
- Offline outbox and replay with conflict handling
- Pilot test property seeding
- Mobile UX improvements driven by cleaner feedback

### Still Missing
- Admin-friendly completed checklist review flow
- Bulk/clean photo download workflow for Breezeway upload
- Invite/reset-password flow
- Final deployment pass and launch checklist execution

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

## Current Finalization Focus
1. Admin completed checklist review workflow.
2. Photo evidence download/export for completed jobs.
3. Final deployment hardening and production rollout.

See:
- [HANDOFF_TEST_PLAN.md](./HANDOFF_TEST_PLAN.md)
- [BENCHMARK_MATRIX.md](./BENCHMARK_MATRIX.md)
- [NEXT_ITERATION_PROMPT.md](./NEXT_ITERATION_PROMPT.md)
- [FINALIZATION_DEPLOY_HANDOFF.md](./FINALIZATION_DEPLOY_HANDOFF.md)
