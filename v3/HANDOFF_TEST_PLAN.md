# Dazzle Divas v3 - Rebuild Handoff Brief

## Purpose
Hand this to the next engineering team so they can finish the v3 rebuild into a production-viable field operations product and safely push it into real cleaner feedback loops.

This is not a QA-only handoff. It is a delivery blueprint for the remaining hardening work after the core product rebuild:
- Property management (admin CRUD)
- User administration (admin-managed staffing)
- Cleaning schedules per property
- Calendar planning for cleaners + inspectors
- Field execution reliability
- Competitive capability benchmarking (Breezeway-level baseline)

## Current State (As Of March 8, 2026 - Latest Session Update)

### What v3 already has
- Bun monorepo with React + Vite web app and Convex backend.
- Convex Auth with 3 roles: `ADMIN`, `CLEANER`, `INSPECTOR`.
- Password auth is staff-only on `/login`.
- Open self-signup is disabled in both UI and backend auth flow.
- Admin role can change user roles in Admin Console.
- Admin can create users from the app with initial password, role, and activation state.
- Checklist execution core:
  - create checklist
  - room/task/photo tracking
  - complete checklist
  - history view
- Field checklist execution is room-driven:
  - select room
  - complete room tasks
  - flag task issues
  - save task issue notes
  - upload/remove proof photos
  - save room notes
  - mark room complete
  - finalize overall checklist
- Checklist template admin route shipped: `/admin/templates` with:
  - room CRUD
  - task CRUD
  - active/inactive room management
  - room generation mode (`SINGLE`, `PER_BEDROOM`, `PER_BATHROOM`)
  - starter template bootstrap from the app
- Property-specific checklist generation shipped:
  - property `bedrooms` / `bathrooms` fields exposed in admin UI
  - checklist preview on `/admin/properties`
  - new checklists derive room instances from base templates + property counts
  - optional property override library
- Admin property management route shipped: `/admin/properties` with:
  - create/edit/search/archive-unarchive
  - bedroom/bathroom counts
  - effective checklist preview (base template or property override)
  - operations metadata fields (`timezone`, `accessInstructions`, `entryMethod`, `serviceNotes`)
  - schedule summary + assignment summary visibility
  - cleaner/inspector assignment management
  - property-specific checklist override editor
- Scheduling/job data model shipped:
  - `servicePlans`
  - `jobs`
  - `jobEvents`
- Idempotent job generation shipped:
  - `scheduling.generateJobs({ from, to })`
  - currently used for 14-day generation windows
- Field schedule route shipped:
  - `/my-schedule` worker-focused operating screen
  - current-job focus card
  - explicit start/resume checklist CTA
  - assignee-safe worker status controls (`IN_PROGRESS`, `BLOCKED`)
  - upcoming list + week calendar
- Admin dispatch route shipped:
  - `/schedule` with month/week/day views
  - filters (`assignee`, `property`, `status`, `job type`)
  - manual turnover job creation
  - turnover-intake metadata capture (`source`, `client/account`, `arrival deadline`)
  - unassigned-job queue
  - quick assignment from queue
  - job detail drawer
  - checklist start/open action from job drawer
  - save-all dispatch changes flow in drawer
- Admin dispatch controls shipped:
  - reassign assignee
  - clear assignee / leave unassigned
  - reschedule start/end
  - status transitions (`SCHEDULED`/`IN_PROGRESS`/`BLOCKED`/`CANCELLED`)
  - overlap guardrails + archived/inactive property guardrails
- Dispatch assignment flow supports flexible daily staffing:
  - manual jobs can be created with or without an assignee
  - dispatch can assign any active cleaner/inspector with the required role
  - property assignments remain useful as roster/preference data, not a hard dispatch gate
- Job/checklist convergence shipped:
  - start checklist from job via `jobId`
  - `jobs.linkedInspectionId` set on start
  - linked jobs auto-transition to `COMPLETED` when checklist is completed
  - audit events written to `jobEvents`
  - `COMPLETED` remains tied to checklist completion
- Offline field support is materially expanded:
  - create checklist
  - start checklist from worker schedule
  - task completion toggles
  - task issue flags and issue notes
  - room notes
  - photo uploads/removals
  - room completion
  - checklist completion
  - worker job status changes
- Offline replay diagnostics UI shipped:
  - app shell queue visibility
  - dashboard outbox panel
  - checklist sync panel
  - worker schedule sync panel
- Inspection creation uses the effective property checklist library.
  - if a property has overrides, new checklists use them
  - if not, base template behavior remains unchanged
- History now surfaces issue counts on completed checklists.
- Completed inspection report output includes issue flags and issue notes per task.
- Competitive benchmark matrix doc shipped:
  - `v3/BENCHMARK_MATRIX.md`
- Root Vitest harness shipped with current automated coverage for:
  - checklist derivation helpers
  - scheduling recurrence rules
  - job/checklist lifecycle guards
  - offline replay classification
  - offline inspection overlay behavior

### What is still missing
- No password reset / invite-email flow yet for admin-created staff.
- Offline replay conflict policy is only partially implemented.
  - queue items can land in `CONFLICT`
  - diagnostics are surfaced
  - but server-wins/client-wins resolution semantics are not fully codified yet
  - operator recovery flow is still light
- Worker mobile execution polish is still open beyond the core flow.
  - `/my-schedule` and checklist execution are usable, but tap-count and scan speed can still improve from real cleaner feedback
- Starting a checklist fully offline from schedule queues the start correctly, but does not yet open a fully local draft checklist immediately.
- No notification/messaging layer yet.
- No reporting primitives yet beyond history/report details.
  - still missing completion-rate, SLA-miss, and photo-compliance dashboards
- Automated coverage is stronger than before, but still thin for:
  - offline replay conflict resolution semantics
  - end-to-end issue capture persistence
  - permissions/integration regressions across mutations

## Handoff Update - Recent Batch Progress

### Completed from prior "First 72-Hour Task List" (March 5, 2026)
1. `/admin/properties` implemented end-to-end.
2. `servicePlans` + `jobs` (+ `jobEvents`) schema and indexes added.
3. `scheduling.generateJobs` implemented for selected date windows (14-day flow supported).
4. `/my-schedule` shipped with list + simple week calendar.
5. "Start Checklist" from job details shipped and linked to `jobs.linkedInspectionId`.
6. Benchmark matrix published with gap severity mapping.

### Completed in March 6, 2026 session
1. `/schedule` admin dispatch board implemented with week/day views, filters, and job drawer.
2. Admin dispatch actions shipped:
   - reassign assignee
   - reschedule start/end
   - status transitions (`SCHEDULED`/`IN_PROGRESS`/`BLOCKED`/`CANCELLED`)
3. Dispatch conflict guardrails shipped:
   - overlapping assignments
   - archived/inactive property guardrails
4. Property assignment management hardened inside `/admin/properties`.
5. Admin user creation shipped in-app with auditable bootstrap flow.
6. Default worker assignment shipped on service plans.
7. Checklist template manager shipped at `/admin/templates`.
8. Checklist generation now derives repeated bedrooms/bathrooms from property counts.
9. Property page includes live checklist preview and starter-template bootstrap.
10. Field checklist execution moved from summary-only to room-by-room execution.

### Completed in March 7, 2026 follow-up
1. `/my-schedule` upgraded into the primary worker operating screen.
2. Worker-safe job status controls shipped:
   - assigned user can move job to `IN_PROGRESS`
   - assigned user can move job to `BLOCKED`
   - `COMPLETED` remains tied to checklist completion
3. Start/resume checklist is the primary worker CTA from schedule UI.
4. `/schedule` supports manual turnover dispatch.
5. Dispatch staffing is no longer hard-coupled to property assignments.

### Completed in March 8, 2026 earlier follow-up
1. Open self-signup disabled for production use.
2. Manual turnover jobs gained first-class intake metadata.
3. Dispatch drawer and worker schedule surface turnover-intake metadata.
4. Per-property checklist overrides shipped on `/admin/properties`.
5. Inspection creation now uses the effective property checklist library.
6. Verification completed for that slice:
   - Convex codegen
   - backend typecheck
   - web typecheck
   - production web build

### Completed in March 8, 2026 latest build sessions
1. Offline outbox generalized beyond checklist creation.
2. Auto replay + diagnostics UI shipped for worker/checklist flows.
3. `/schedule` gained month view and faster staffing/save-all admin workflow.
4. Root Vitest harness added at repo root.
5. Scheduling, checklist derivation, lifecycle, and offline helper tests added.
6. Task-level issue capture shipped in checklist execution.
7. Issue counts now surface in completed history and report output.
8. Convex codegen, tests, backend typecheck, web typecheck, and production web build all passed after these updates.

## Important implementation notes for next team
- `CUSTOM_RRULE` is represented in schema but not yet executed by generator logic.
- `/schedule` now has month/week/day views and better dispatch ergonomics, but further scale/performance work may still be needed later.
- `/login` is staff-only.
  - Admin-created accounts are the expected production path.
  - Invite/reset-password flow is still not implemented.
- Dispatch reassignment no longer depends on property assignments.
  - Role compatibility and overlap checks still apply.
  - Property assignments should be treated as roster/preference data, not the only eligible-assignee source.
- Template library is a global base checklist model with optional property-specific override snapshots.
  - `rooms.generationMode` controls whether a room appears once, once per bedroom, or once per bathroom.
  - Property checklists are derived from the effective library for that property plus property `bedrooms` / `bathrooms`.
- Old-app visual references provided by product owner are in `old_pics/` at repo root.
  - Use those screenshots as guidance for room-first field UX, not as a strict architecture reference.
- Offline replay currently distinguishes retryable failures from `CONFLICT`, but deeper field-resolution policy is still open.
- Issue capture now exists at the task level, but richer downstream reporting/aggregation has not been built yet.
- Job status flow is linked to checklist completion; admin override flow for incomplete checklists is not implemented.
- The product supports two job-input models:
  - recurring service plans for predictable work
  - manual admin-created jobs for turnover work arriving by email/text

## Product Target
Deliver a field-first operations app where:
1. Admin can create and manage properties.
2. Admin can define service schedules per property (cleaning/inspection cadence).
3. Cleaners + inspectors can view jobs in calendar and list formats.
4. Jobs flow from `SCHEDULED` to `COMPLETED` with accountability evidence.
5. Product reaches competitive baseline against Breezeway-like workflows.

## Delivery Strategy
Build in vertical slices, not isolated UI/backend chunks.
Each slice must ship with:
- schema + functions
- web UI
- auth/permissions
- smoke tests

## Workstream Snapshot

### Workstream A - Property Management (Admin)
- Outcome status: complete for M1 baseline.

### Workstream A1 - User Administration (Admin)
- Outcome status: basic complete.
- Remaining gap:
  - invite/reset-password flow

### Workstream B - Scheduling Engine (Per Property)
- Outcome status: basic complete.
- Remaining gap:
  - `CUSTOM_RRULE`

### Workstream C - Calendar + Dispatch UX
- Outcome status: baseline complete with month/week/day views now shipped.
- Remaining gap:
  - future performance and UX refinement after real dispatch usage

### Workstream D - Checklist/Job Convergence
- Outcome status: core complete.
- Remaining gap:
  - no admin override path for incomplete linked jobs/checklists

### Workstream E - Offline Field Reliability
- Outcome status: substantially advanced and close to rollout-ready.
- Remaining gap:
  - stronger conflict-resolution policy
  - stronger operator recovery flow for `CONFLICT`
  - fully local offline checklist draft creation from offline schedule start

### Workstream F - Competitive Benchmark Hardening
- Outcome status: matrix exists; most competitive add-ons still open.
- Remaining gap:
  - notifications/messaging
  - richer reporting
  - differentiated workflows beyond core cleaning/inspection

## Recommended Next Build Focus

### Priority theme
Move from "major missing workflow gaps" to "deployment safety + field feedback loop."

### Recommended next slice
Deployment readiness and field rollout hardening.

### Concrete next tasks
1. Finish replay conflict policy + recovery flow.
   - codify server-owned schedule fields vs client-owned evidence fields
   - improve user handling of `CONFLICT` items
2. Add final deployment smoke coverage for:
   - issue capture persistence in completed history/report output
   - replay conflict/resolution behavior
   - job/checklist lifecycle regressions
3. Perform a production deployment pass and field smoke checklist.
   - admin can create/assign/reschedule jobs
   - worker can start/resume checklist
   - worker can complete room/checklist
   - worker can capture issue + photo
   - offline queue replays correctly after reconnect
4. Then collect live cleaner feedback before building broader platform expansion.

## Suggested Milestones

### M1: Operational Baseline
- A: complete
- A1: basic complete
- B: basic complete (`CUSTOM_RRULE` pending)
- C: complete for baseline, including admin month/week/day dispatch
- D: core link complete

### M2: Field-Ready Reliability
- Workstream E is substantially advanced.
- Remaining blockers are replay/conflict hardening and rollout validation.

### M3: Competitive Hardening
- Reporting, notifications, and differentiated workflows remain open.

## Technical Guardrails
- Keep Bun/Convex stack.
- Preserve role/permission boundaries in backend (never trust client role input).
- Prefer additive schema changes with migration helpers.
- Keep admin actions auditable (`jobEvents`, mutation logs).
- Keep `COMPLETED` tied to checklist completion.
- Add tests for:
  - permissions
  - schedule generation correctness
  - offline replay/conflict correctness
  - issue capture persistence

## Next 72-Hour Task List For Incoming Team
1. Finish replay conflict policy + manual recovery UX.
2. Add final deployment smoke scripts/checklists and execute them against production/staging.
3. Add tests for:
   - issue capture persistence in history/report output
   - replay conflict resolution
   - job/checklist lifecycle integration regressions
4. Ship any high-signal mobile UX fixes that come directly from cleaner feedback.
5. Hold broader feature expansion until field validation confirms the workflow is stable.

## Ready-For-User-Testing Gate
Proceed to broad user testing only when:
- Admin can operate properties + schedules + staffing without CLI.
- Cleaner and inspector have usable upcoming-jobs calendar.
- Scheduled job lifecycle works through checklist completion.
- Offline mode covers real field actions, not just checklist creation.
- Replay conflicts are understandable and recoverable by operators.
- P0 issues from benchmark matrix are closed or explicitly accepted for initial rollout.
