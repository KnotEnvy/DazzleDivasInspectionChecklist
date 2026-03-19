# Dazzle Divas v3 Finalization And Deployment Handoff

Updated: March 16, 2026

## Audience
This handoff is for the team executing the deployment and final launch validation.

## Product State
v3 is no longer in rebuild mode.
The app is in deployment-prep mode.

### Already Shipped
- admin property management
- admin staffing and role management
- checklist templates and property overrides
- service plans, generated jobs, and dispatch scheduling
- cleaner and inspector worker schedule
- room-first checklist execution
- issue notes and proof photo capture
- offline queue, replay, and conflict handling
- admin completed history with today's finished jobs surfaced first
- admin completed checklist review with room notes, issue visibility, and photo galleries
- photo save/download workflow for completed jobs, including iPhone-sized copies
- admin dispatch job deletion for disposable jobs that have not turned into checklist history

### Still Remaining
- production deployment execution
- launch smoke and signoff
- invite/reset-password flow is still manual

## Deployment Readiness Read
Internal user network tests and recent workflow updates have been successful.
The current app state is strong enough to move from finalization into controlled deployment.

## Deployment Expectations

### Frontend
- target host: Cloudflare Pages
- build command: `bun run build:web`
- output: `apps/web/dist`
- required env var: `VITE_CONVEX_URL`

### Backend
- deploy via Convex
- run backend codegen whenever Convex schema or function surfaces change

## Required Verification Before Release
```bash
bun run test
bun run typecheck
bun run typecheck:backend
bun run build:web
bun run smoke:rollout
```

If backend surface changes:
```bash
cd packages/backend
bun run build
```

## Launch Checklist
1. Run the verification commands above on the release branch.
2. Confirm `VITE_CONVEX_URL` points at the intended Convex deployment.
3. Deploy the backend.
4. Deploy the frontend to Cloudflare Pages.
5. Run the manual smoke below against the deployed environment.
6. Confirm admin and worker devices can both sign in and sync.

## Manual Production Smoke

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
4. Review notes, issues, and photo evidence.
5. Save at least one iPhone-sized photo copy.
6. Delete one disposable scheduled or cancelled job from dispatch.

### Offline
1. Put a worker device offline.
2. Capture progress and photos.
3. Reconnect.
4. Confirm replay.
5. Confirm completed evidence is still correct from admin side.

## Guardrails
- Keep `COMPLETED` tied to checklist completion.
- Preserve backend permission boundaries.
- Preserve offline replay coherence.
- Do not allow deletion of jobs that are in progress, completed, or already linked to checklist history.

## Immediate Next Work
1. execute backend and frontend deployment
2. run launch smoke on the deployed environment
3. capture launch notes and any environment fixes
