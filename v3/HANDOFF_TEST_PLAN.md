# Dazzle Divas v3 Finalization Test Plan

Updated: March 15, 2026

## Purpose
This plan is for the next team finishing the app for production use.

The app is no longer in broad rebuild mode.
The remaining work is:
1. ship the admin completed-checklist review flow
2. make completed photo evidence easy to download for Breezeway upload
3. finish deployment and launch validation

## Current Reality

### Already Working
- admin properties, templates, staffing, dispatch, and service plans
- generated jobs and manual jobs
- cleaner/inspector worker schedule
- room-first checklist execution
- proof photo capture
- task issue capture and persistence into history/report data
- offline queue, replay, and conflict handling
- mobile UX refinements from field feedback

### Not Finished
- admin review UX for completed checklists is still basic
- no clean admin photo-download/export workflow yet
- deployment needs a final launch pass after the admin review feature lands

## Main Feature Under Test Next
Admin must be able to:
- find completed checklists quickly
- review the completed checklist with enough context to verify the work
- access/download the room photos cleanly
- use those downloaded photos in Breezeway for the day’s client work

This should be treated as the last major product feature before deployment.

## Acceptance Criteria

### A. Completed Checklist Admin Review
- Admin can open completed checklist history without using CLI or database tools.
- Admin can distinguish checklist type, property, completion time, and issue count quickly.
- Admin can open a completed checklist/report view and review room-by-room completion details.
- Admin can review issue notes and room notes from the completed run.

### B. Photo Evidence Access
- Admin can see the photo evidence associated with the completed checklist.
- Photo grouping/order is understandable enough for manual client upload.
- Download action is obvious and reliable.
- Downloaded files are identifiable enough for reuse outside the app.
- Permissions remain enforced so only allowed roles can access completed evidence.

### C. Breezeway Workflow Fit
- Admin can move from “completed clean” to “photos ready for Breezeway upload” without manual data digging.
- The workflow should be fast enough for same-day client turnover usage.
- At minimum, single-photo download must work cleanly.
- Preferred outcome: easy batch download or checklist-scoped download.

### D. Deployment Readiness
- final web build passes
- backend typecheck passes
- rollout smoke passes
- pilot deployment runbook is current
- manual field smoke checklist is current

## Test Matrix

| Area | Scenario | Expected |
| --- | --- | --- |
| History list | Completed checklist appears after worker finishes it | Item shows property, type, completion time, and issue count if present |
| History detail | Admin opens completed checklist | Completed rooms, notes, and issue details are visible |
| Photo review | Completed checklist contains photos | Photos are visible and associated with the right completed checklist |
| Photo download | Admin downloads photo(s) | Download succeeds and files are reusable outside the app |
| Permissions | Cleaner/inspector attempts admin-only review/download path | Access is blocked appropriately |
| Offline regression | Worker completes checklist offline then replay syncs | Completed review data and photos remain available after replay |
| Issue persistence | Worker flags issue with notes before completion | Issue count and issue text remain visible in completed review flow |
| Build/deploy | Production build and rollout smoke | Commands succeed without regressions |

## Required Manual Smoke

### Worker Flow
1. Cleaner starts a scheduled clean.
2. Cleaner completes room tasks.
3. Cleaner uploads proof photos.
4. Cleaner completes checklist.
5. Repeat once with issue notes.

### Admin Review Flow
1. Admin opens completed history.
2. Admin opens the finished checklist.
3. Admin verifies room notes, issue notes, and photo evidence.
4. Admin downloads photo evidence.
5. Admin confirms the files are usable for Breezeway upload.

### Offline Recovery Flow
1. Put a worker device offline.
2. Complete at least one room and capture photos.
3. Reconnect.
4. Confirm replay succeeds.
5. Confirm completed review data is still correct from admin side.

## Required Verification Commands
Run after the next feature slice lands:

```bash
bun run test
bun run typecheck
bun run typecheck:backend
bun run build:web
bun run smoke:rollout
```

Run Convex codegen if backend schema or function surfaces change:

```bash
cd packages/backend
bun run build
```

## Priority Order For Next Team
1. Completed checklist review UX
2. Photo download/export UX
3. Deployment/launch hardening
4. Only then any additional polish

## Guardrails
- Keep backend permission checks enforced.
- Keep offline queue/replay coherent.
- Keep `COMPLETED` tied to checklist completion.
- Do not expand into broad new feature work before admin review/download is done.
