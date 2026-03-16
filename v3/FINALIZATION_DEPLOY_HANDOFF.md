# Dazzle Divas v3 Finalization And Deployment Handoff

Updated: March 15, 2026

## Audience
This document is for the next engineering team responsible for:
- finishing the final admin feature
- validating production readiness
- deploying the app

## Product State
The app is no longer in rebuild mode.
It is in finalization mode.

### Already Shipped
- admin property management
- admin staffing and role management
- checklist templates and property overrides
- service plans and job generation
- admin dispatch with month/week/day views
- cleaner and inspector worker schedule
- room-first checklist execution
- task issue notes
- proof photo capture
- offline queue, replay, and conflict handling
- role-specific mobile UX improvements

### Still Missing
- admin-friendly completed checklist review workflow
- photo evidence download/export workflow
- final deployment execution and launch signoff

## Why The Next Feature Matters
Admin uses cleaner photos in Breezeway for client communication.

That means completed checklist review is not just a “history page polish” task.
It is an operational requirement.

The next team should optimize for:
- speed
- reliability
- easy photo access
- easy evidence download

## Expected Finalization Outcome
By the end of the next team’s work:
1. Admin can review completed checklist evidence quickly.
2. Admin can download completed photo evidence for external upload.
3. Production deployment can proceed with confidence.

## Suggested Delivery Order

### 1. Completed Checklist Review
- improve completed history usability
- make completed detail view admin-usable
- keep issue notes, room notes, and property context visible

### 2. Photo Download / Export
- make completed photo evidence easy to inspect
- make single-photo download work cleanly
- if possible, add checklist-scoped multi-download or zip export
- keep file naming practical for manual external upload

### 3. Launch Hardening
- run rollout smoke
- run manual admin/worker smoke
- deploy frontend and backend
- validate production/staging env config

## Deployment Expectations

### Frontend
- target host: Cloudflare Pages
- build command: `bun run build:web`
- output: `apps/web/dist`
- env var required: `VITE_CONVEX_URL`

### Backend
- deploy via Convex
- keep generated files current when schema/function surfaces change

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

## Manual Production Smoke

### Worker
1. Open schedule.
2. Start or resume checklist.
3. Complete tasks.
4. Add issue notes.
5. Upload photos.
6. Complete checklist.

### Admin
1. Open completed history.
2. Review completed checklist detail.
3. Verify notes, issues, and photos.
4. Download photo evidence.
5. Confirm the download is usable for Breezeway upload.

### Offline
1. Put worker offline.
2. Capture progress and photos.
3. Reconnect.
4. Confirm replay.
5. Confirm completed evidence is still correct from admin side.

## Guardrails
- Keep `COMPLETED` tied to checklist completion.
- Preserve backend permission boundaries.
- Preserve offline replay coherence.
- Do not expand into unrelated features before admin review/download is done.

## Recommended First Slice For The Next Team
Implement the smallest admin-complete flow that delivers immediate operational value:
- better completed checklist detail page
- visible photo gallery for completed work
- reliable photo download actions

After that, shift immediately into deployment and launch validation.
