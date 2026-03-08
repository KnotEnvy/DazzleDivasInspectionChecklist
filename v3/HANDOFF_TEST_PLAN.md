# Dazzle Divas v3 - Rebuild Handoff Brief

## Purpose
Hand this to the next engineering team so they can finish the v3 rebuild into a production-viable field operations product.

This is not a QA-only handoff. It is a delivery blueprint for missing core product capabilities:
- Property management (admin CRUD)
- User administration (admin-managed staffing)
- Cleaning schedules per property
- Calendar planning for cleaners + inspectors
- Competitive capability benchmarking (Breezeway-level baseline)

## Current State (As Of March 8, 2026 - Session Update)

### What v3 already has
- Bun monorepo with React + Vite web app and Convex backend.
- Convex Auth with 3 roles: `ADMIN`, `CLEANER`, `INSPECTOR`.
- Password auth is now staff-only on `/login`.
- Open self-signup is disabled in both UI and backend auth flow.
- Admin role can change user roles in Admin Console.
- Admin can create users from the app with initial password, role, and activation state.
- Checklist execution core:
  - Create checklist
  - Room/task/photo tracking
  - Complete checklist
  - History view
- Field checklist execution is now room-driven:
  - select room
  - complete room tasks
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
- Offline queue for checklist creation.
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
  - `/schedule` with week/day view
  - filters (`assignee`, `property`, `status`, `job type`)
  - manual turnover job creation
  - turnover-intake metadata capture (`source`, `client/account`, `arrival deadline`)
  - unassigned-job queue
  - job detail drawer
  - checklist start/open action from job drawer
- Admin dispatch controls shipped:
  - reassign assignee
  - clear assignee / leave unassigned
  - reschedule start/end
  - status transitions (`SCHEDULED`/`IN_PROGRESS`/`BLOCKED`/`CANCELLED`)
  - overlap guardrails + archived/inactive property guardrails
- Dispatch assignment flow now supports flexible daily staffing:
  - manual jobs can be created with or without an assignee
  - dispatch can assign any active cleaner/inspector with the required role
  - property assignments remain useful as roster/preference data, not a hard dispatch gate
- Job/checklist convergence shipped (core linkage):
  - start checklist from job via `jobId`
  - `jobs.linkedInspectionId` set on start
  - linked jobs auto-transition to `COMPLETED` when checklist is completed
  - audit events written to `jobEvents`
- Per-property checklist overrides shipped:
  - property can clone base room/task library into a private override copy
  - property-specific room CRUD
  - property-specific task CRUD
  - property-specific room activation/order/generation mode
  - checklist creation now uses effective property template library
- Competitive benchmark matrix doc shipped:
  - `v3/BENCHMARK_MATRIX.md`

### What is still missing
- No admin month view or richer dispatch polish yet.
- No password reset / invite-email flow yet for admin-created staff.
- Offline outbox is still limited (mostly checklist creation only).
- No full offline replay/conflict-resolution policy implementation yet.
- Worker mobile execution polish is still open beyond the core flow.
  - `/my-schedule` is now usable as the primary worker screen, but room-navigation speed and issue-capture ergonomics can still improve.
- No notification/messaging layer yet.
- No reporting primitives yet (completion rate, SLA misses, photo compliance).
- M1/M2 test coverage is still thin for:
  - schedule generation correctness edge cases
  - job/checklist lifecycle regression checks
  - offline replay/conflict correctness

## Handoff Update - Recent Batch Progress

### Completed from prior "First 72-Hour Task List" (March 5, 2026)
1. `/admin/properties` implemented end-to-end.
2. `servicePlans` + `jobs` (+ `jobEvents`) schema and indexes added.
3. `scheduling.generateJobs` implemented for selected date windows (14-day flow supported).
4. `/my-schedule` shipped with list + simple week calendar.
5. "Start Checklist" from job details shipped and linked to `jobs.linkedInspectionId`.
6. Benchmark matrix published with gap severity mapping.

### Completed in current session (March 6, 2026)
1. `/schedule` admin dispatch board implemented with week/day views, filters, and job drawer.
2. Admin dispatch actions shipped:
   - reassign assignee
   - reschedule start/end
   - status transitions (`SCHEDULED`/`IN_PROGRESS`/`BLOCKED`/`CANCELLED`)
3. Dispatch conflict guardrails shipped:
   - overlapping assignments
   - archived/inactive property guardrails
4. Property assignment management hardened inside `/admin/properties`:
   - assign cleaner
   - assign inspector
   - unassign active staff
5. Admin properties render-loop/query stability fixes shipped.
6. Admin user creation shipped in-app with auditable bootstrap flow.
7. Default worker assignment shipped on service plans so generated jobs route to the right worker.
8. Checklist template manager shipped at `/admin/templates`.
9. Checklist generation now derives repeated bedrooms/bathrooms from property counts.
10. Property page now includes live checklist preview and starter-template bootstrap.
11. Field checklist execution UI is no longer summary-only; workers can execute room-by-room with tasks, photos, notes, room completion, and checklist completion.

### Completed in follow-up session (March 7, 2026)
1. `/my-schedule` upgraded into the primary worker operating screen.
2. Worker-safe job status controls shipped:
   - assigned user can move job to `IN_PROGRESS`
   - assigned user can move job to `BLOCKED`
   - `COMPLETED` remains tied to checklist completion
3. Start/resume checklist is now the primary worker CTA from schedule UI.
4. `/schedule` now supports manual turnover dispatch:
   - create manual jobs without a service plan
   - create jobs unassigned or assigned
   - visible unassigned queue
5. Dispatch staffing is no longer hard-coupled to property assignments.
   - any active user with the required role can be assigned
   - property assignments remain useful for staffing visibility/preferences
6. Assigned workers can start linked checklist execution even when dispatch assignment was made outside the property-assignment roster model.

### Completed in latest follow-up session (March 8, 2026)
1. Open self-signup was disabled for production use.
   - `/login` is now staff sign-in only
   - backend password auth rejects self-signup flow
2. Manual turnover jobs now capture first-class intake metadata:
   - source (`EMAIL`, `TEXT`, `PHONE`, `MANUAL`)
   - client/account label
   - arrival/check-in deadline
3. Dispatch drawer and worker schedule now surface turnover-intake metadata.
4. Per-property checklist overrides shipped on `/admin/properties`.
   - clone base template into property-specific override copy
   - property-only room/task editing
   - property-level room activation/order/generation mode
   - reset property override copy back to base template
5. Inspection creation now uses the effective property checklist library.
   - if a property has overrides, new checklists use them
   - if not, base template behavior remains unchanged
6. Verification completed for this slice:
   - Convex codegen
   - backend typecheck
   - web typecheck
   - production web build

### Important implementation notes for next team
- `CUSTOM_RRULE` is represented in schema but not yet executed by generator logic (currently skipped).
- `/schedule` is now usable for both recurring-plan jobs and manual turnover dispatch, but month view and deeper dispatch polish remain open.
- `/login` is now staff-only.
  - Admin-created accounts are the expected production path.
  - Invite/reset-password flow is still not implemented.
- Dispatch reassignment no longer depends on property assignments.
  - Role compatibility and overlap checks still apply.
  - Property assignments should now be treated as roster/preference data, not as the only eligible-assignee source.
- Admin user creation exists, but it is still a manual bootstrap flow rather than invite/reset-email flow.
- Template library is now a global base checklist model with optional property-specific override snapshots.
  - `rooms.generationMode` controls whether a room appears once, once per bedroom, or once per bathroom.
  - Property checklists are derived from the effective library for that property plus property `bedrooms` / `bathrooms`.
  - If a property has no override copy, it still falls back to the shared base template.
- Old-app visual references provided by product owner are in `old_pics/` at repo root.
  - Use those screenshots as guidance for room-first field UX, not as a strict architecture reference.
- Inspection UI now supports room/task/photo interaction, but offline outbox support is still create-checklist-first.
- Job status flow is now linked to checklist completion, but admin override flow for incomplete checklists is not implemented.
- The product now supports two job-input models:
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

## Workstream A - Property Management (Admin)

### Outcome
Admin can create, edit, search, archive, and assign properties from the app.

### Backend tasks
- Extend/confirm `properties` shape for operations use:
  - `timezone`
  - `accessInstructions`
  - `entryMethod`
  - `serviceNotes`
  - `isArchived`
- Add robust admin mutations/queries:
  - `properties.create`
  - `properties.update`
  - `properties.archive`
  - `properties.listAdmin`
  - `properties.search`
- Enforce admin-only writes.

### Web tasks
- New route: `/admin/properties`
- Forms:
  - create property
  - edit property
  - archive/unarchive
- Property detail panel:
  - metadata
  - assignment summary
  - schedule summary (once Workstream B lands)

### Done criteria
- Admin can create property and it appears immediately for assignment/scheduling flows.
- Archived properties are hidden from active job creation.

## Workstream A1 - User Administration (Admin)

### Outcome
Admin can create staff users and set initial role/status without CLI or external signup workarounds.

### Backend tasks
- Add admin-only user creation flow compatible with Convex Auth.
- Enforce unique email constraints and valid role assignment.
- Decide creation path explicitly:
  - invite email flow, or
  - temporary password/manual credential bootstrap
- Keep user creation auditable.

### Web tasks
- Extend Admin Console with create-user form.
- Capture at minimum:
  - name
  - email
  - initial role
  - activation/invite state
- New users should appear immediately in assignment/dispatch flows.

### Done criteria
- Admin can create `CLEANER`, `INSPECTOR`, and `ADMIN` users from the app.
- No CLI/manual auth-table workaround is required for normal staffing operations.

## Workstream B - Scheduling Engine (Per Property)

### Outcome
Each property has service plans that generate actionable jobs.

### Proposed schema additions
- `servicePlans`
  - `propertyId`
  - `planType` (`CLEANING`, `INSPECTION`, `DEEP_CLEAN`, optional future `MAINTENANCE`)
  - `frequency` (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `CUSTOM_RRULE`)
  - `daysOfWeek`
  - `timeWindowStart`, `timeWindowEnd`
  - `defaultDurationMinutes`
  - `defaultAssigneeRole` (`CLEANER`, `INSPECTOR`)
  - `isActive`
- `jobs`
  - `propertyId`
  - `servicePlanId` (optional for manual jobs)
  - `jobType`
  - `scheduledStart`
  - `scheduledEnd`
  - `assigneeId` (nullable until assigned)
  - `status` (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `BLOCKED`)
  - `priority`
  - `notes`
  - `createdById`
  - `completedAt`
  - `linkedInspectionId` (optional when checklist is started/completed)
- `jobEvents` (audit log)
  - `jobId`
  - `eventType`
  - `actorId`
  - `metadata`
  - `createdAt`

### Engine behavior
- Add idempotent generator function:
  - `scheduling.generateJobs({ from, to })`
- Generation rules:
  - no duplicate jobs per plan/time window
  - skip archived properties/inactive plans
  - respect property timezone

### Done criteria
- Admin can define recurring service plans.
- Jobs auto-generate for a selected date window.

## Workstream C - Calendar + Dispatch UX

### Outcome
Admin and field users can see and act on upcoming work in calendar form.

### Web routes
- `/schedule` (global dispatch board for admin)
- `/my-schedule` (assignee-focused view for cleaner/inspector)

### UX requirements
- Month + week + day views.
- Filters:
  - role
  - assignee
  - property
  - status
  - job type
- Click event -> job drawer with:
  - property details
  - notes
  - checklist start/open action
- Reassign and reschedule controls for admins.

### Done criteria
- Cleaner/inspector can see upcoming jobs in time order.
- Admin can reassign job and assignee calendar updates immediately.

## Workstream D - Checklist/Job Convergence

### Outcome
Jobs and checklists become one coherent workflow.

### Required behavior
- Starting a checklist from a scheduled job links `jobs.linkedInspectionId`.
- Completing inspection transitions job status to `COMPLETED`.
- Incomplete checklist prevents job completion unless admin override.
- History shows completed jobs + completed inspections with linkage.

### Done criteria
- No duplicate "work objects" for the same execution event.

## Workstream E - Offline Field Reliability

### Outcome
Field execution works reliably with poor connectivity.

### Required upgrades
- Expand outbox beyond checklist creation:
  - task completion toggles
  - notes
  - photo uploads metadata
  - job status transitions
- Add conflict policy for replay:
  - server wins for schedule ownership fields
  - client wins for local evidence fields (if timestamps are newer)
- Add sync status UI on inspection/job pages.

### Done criteria
- A full room completion can be performed offline and eventually synced.

## Legacy-App Alignment Remaining

### Goal
Match and exceed the practical field workflow of the old Dazzle Divas app before chasing broader platform expansion.

### What is already at parity or better
- Generated room-by-room checklist flow now exists in v3.
- Bedroom and bathroom counts now actually affect checklist shape in v3.
  - This did not exist in the old app.
- Room execution now includes:
  - task completion
  - proof photo capture
  - room notes
  - room completion

### What is still needed to feel fully aligned with the old app
- Improve mobile room navigation polish.
  - The old app was very list-driven and quick to scan.
  - v3 should keep its stronger data model but tighten the tap path and visual hierarchy for field users.
- Add stronger issue capture for failed inspection items.
  - Example: flag a room/task issue and preserve it in reporting/history.
- Tighten test coverage around checklist generation and room completion guardrails.

### Product reference files
- Old screenshots: `old_pics/`
- Old legacy app: `dazzle-divas-inspection/`

## Workstream F - Competitive Benchmark (Breezeway + Peers)

### Goal
Define explicit capability targets and close gaps intentionally, not by guesswork.

### Sources to review
- Breezeway product + operations resources:
  - https://www.breezeway.io/
  - https://help.breezeway.io/
- Turno:
  - https://turno.com/
- Hostaway:
  - https://www.hostaway.com/
- ResortCleaning:
  - https://www.resortcleaning.com/

### Benchmark process
1. Build a feature matrix with columns:
   - capability
   - Breezeway support
   - peer support
   - current v3 status
   - gap severity (P0/P1/P2)
   - implementation owner
2. Minimum benchmark categories:
   - property operations setup
   - recurring scheduling
   - dispatch/calendar
   - mobile execution
   - inspections + photo proof
   - messaging/notifications
   - reporting/audit trail
3. Define parity level by milestone:
   - M1: operational baseline
   - M2: strong parity
   - M3: differentiated workflows

### Non-negotiable parity baseline
- Property CRUD and assignment
- Recurring schedules
- Calendar dispatch view
- Mobile-friendly job execution
- Inspection evidence capture
- Audit history for operational accountability

## Recommended Next Build Focus After Legacy Alignment

### Priority theme
Move from "core production access + property standards are in place" to "field reliability and replay are production-safe."

### Recommended next slice
Finish the remaining field-reliability gaps that still block real operational rollout.

### Concrete next tasks
1. Expand offline outbox + replay for field execution.
   - task toggles
   - room notes
   - photo metadata
   - worker job status changes
2. Implement replay conflict policy + diagnostics UI.
   - server wins for schedule ownership fields
   - client wins for newer local evidence fields
3. Add dispatch ergonomics on `/schedule`.
   - month view
   - faster reassignment/reschedule actions
   - stronger daily staffing flow
4. Add test coverage for:
   - schedule generation edge cases
   - property override checklist generation
   - job/checklist linkage lifecycle
   - offline replay conflict resolution
5. Then evaluate Breezeway-style additions in this order:
   - messaging/notifications
   - issue escalation/follow-up tasks
   - reporting/SLA dashboards
   - differentiated workflows beyond baseline cleaning + inspection

## Suggested Milestones

### M1 (2-3 weeks): Operational Baseline
- Workstream A complete
- Workstream A1 basic
- Workstream B (basic)
- Workstream C (week/day view)
- Workstream D (link job -> inspection)
Status update (March 6, 2026):
- A: complete
- A1: basic complete (manual bootstrap flow shipped; invite/reset flow still open)
- B: basic complete (`CUSTOM_RRULE` still pending)
- C: assignee view complete (`/my-schedule`), admin week/day dispatch complete, manual turnover dispatch complete, month view still open
- D: core link complete; admin override path still open

### M2 (2 weeks): Field-Ready Reliability
- Workstream E complete
- Conflict handling + replay diagnostics
- Role-based schedule UX polish
Status update (March 6, 2026):
- partially started
- room-by-room field execution shipped
- offline replay/conflict handling still not started
- worker schedule/status core flow shipped
- offline replay/conflict handling still open

### M3 (1-2 weeks): Competitive Hardening
- Workstream F matrix closed for P0/P1 gaps
- Reporting primitives (job completion rate, SLA misses, photo compliance)
Status update (March 6, 2026):
- matrix published; P0/P1 closure and reporting still open

## Technical Guardrails
- Keep Bun/Convex stack.
- Preserve role/permission boundaries in backend (never trust client role input).
- Prefer additive schema changes with migration helpers.
- Keep admin actions auditable (`jobEvents`, mutation logs).
- Add tests for:
  - permissions
  - schedule generation correctness
  - offline replay correctness

## Next 72-Hour Task List For Incoming Team
1. Expand offline outbox beyond checklist creation:
   - task completion toggles
   - room notes
   - photo metadata capture
   - job status transitions
2. Implement replay conflict policy + diagnostics UI:
   - server wins for schedule ownership fields
   - client wins for newer local evidence fields
3. Add dispatch polish for admins:
   - month view
   - faster reassignment/reschedule interactions
   - stronger daily staffing workflow
4. Add test coverage for:
   - schedule generation edge cases (timezone, biweekly/monthly boundaries)
   - property-derived + property-override checklist generation
   - job/checklist linkage lifecycle
   - offline replay conflict resolution
5. Add issue capture for failed inspection items and preserve it in history/reporting.

## Ready-For-User-Testing Gate
Proceed to broad user testing only when:
- Admin can operate properties + schedules + staffing without CLI.
- Cleaner and inspector have usable upcoming-jobs calendar.
- Scheduled job lifecycle works through checklist completion.
- Offline mode covers real field actions, not just checklist creation.
- P0 issues from benchmark matrix are closed.
