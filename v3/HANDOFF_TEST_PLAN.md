# Dazzle Divas v3 - Rebuild Handoff Brief

## Purpose
Hand this to the next engineering team so they can finish the v3 rebuild into a production-viable field operations product.

This is not a QA-only handoff. It is a delivery blueprint for missing core product capabilities:
- Property management (admin CRUD)
- User administration (admin-managed staffing)
- Cleaning schedules per property
- Calendar planning for cleaners + inspectors
- Competitive capability benchmarking (Breezeway-level baseline)

## Current State (As Of March 6, 2026 - Session Update)

### What v3 already has
- Bun monorepo with React + Vite web app and Convex backend.
- Convex Auth with 3 roles: `ADMIN`, `CLEANER`, `INSPECTOR`.
- New signup defaults to `CLEANER`.
- Admin role can change user roles in Admin Console.
- Admin still cannot create users from the app yet.
- Checklist execution core:
  - Create checklist
  - Room/task/photo tracking
  - Complete checklist
  - History view
- Offline queue for checklist creation.
- Admin property management route shipped: `/admin/properties` with:
  - create/edit/search/archive-unarchive
  - operations metadata fields (`timezone`, `accessInstructions`, `entryMethod`, `serviceNotes`)
  - schedule summary + assignment summary visibility
  - cleaner/inspector assignment management
- Scheduling/job data model shipped:
  - `servicePlans`
  - `jobs`
  - `jobEvents`
- Idempotent job generation shipped:
  - `scheduling.generateJobs({ from, to })`
  - currently used for 14-day generation windows
- Field schedule route shipped:
  - `/my-schedule` list + simple week calendar + job detail drawer
- Admin dispatch route shipped:
  - `/schedule` with week/day view
  - filters (`assignee`, `property`, `status`, `job type`)
  - job detail drawer
  - checklist start/open action from job drawer
- Admin dispatch controls shipped:
  - reassign assignee
  - reschedule start/end
  - status transitions (`SCHEDULED`/`IN_PROGRESS`/`BLOCKED`/`CANCELLED`)
  - overlap guardrails + archived/inactive property guardrails
- Job/checklist convergence shipped (core linkage):
  - start checklist from job via `jobId`
  - `jobs.linkedInspectionId` set on start
  - linked jobs auto-transition to `COMPLETED` when checklist is completed
  - audit events written to `jobEvents`
- Competitive benchmark matrix doc shipped:
  - `v3/BENCHMARK_MATRIX.md`

### What is still missing
- No admin user creation flow yet (staff creation still depends on external signup/manual setup).
- No admin month view or richer dispatch polish yet.
- Inspection execution UI is still summary-only (room/task/photo interaction surface not shipped).
- Offline outbox is still limited (mostly checklist creation only).
- No full offline replay/conflict-resolution policy implementation yet.
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

### Important implementation notes for next team
- `CUSTOM_RRULE` is represented in schema but not yet executed by generator logic (currently skipped).
- `/schedule` is now usable for week/day dispatch, but month view and deeper dispatch polish remain open.
- Dispatch reassignment depends on active property assignments; those can now be managed in `/admin/properties`.
- Admin can change roles, but still cannot create staff users in-app.
- Inspection UI is still summary-only, and offline outbox support is still create-checklist-first.
- Job status flow is now linked to checklist completion, but admin override flow for incomplete checklists is not implemented.

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

## Suggested Milestones

### M1 (2-3 weeks): Operational Baseline
- Workstream A complete
- Workstream A1 basic
- Workstream B (basic)
- Workstream C (week/day view)
- Workstream D (link job -> inspection)
Status update (March 6, 2026):
- A: complete
- A1: not started
- B: basic complete (`CUSTOM_RRULE` still pending)
- C: assignee view complete (`/my-schedule`), admin week/day dispatch complete, month view still open
- D: core link complete; admin override path still open

### M2 (2 weeks): Field-Ready Reliability
- Workstream E complete
- Conflict handling + replay diagnostics
- Role-based schedule UX polish
Status update (March 5, 2026):
- not started

### M3 (1-2 weeks): Competitive Hardening
- Workstream F matrix closed for P0/P1 gaps
- Reporting primitives (job completion rate, SLA misses, photo compliance)
Status update (March 5, 2026):
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
1. Add admin user creation to Admin Console so staff accounts can be created without CLI/manual signup.
   - choose invite flow vs temporary credential bootstrap
   - ensure new users appear immediately in assignment/dispatch flows
2. Expand inspection execution UI beyond summary cards:
   - room detail panel or route
   - task toggles
   - room notes
   - photo metadata capture
3. Expand offline outbox beyond checklist creation:
   - task completion toggles
   - room notes
   - photo metadata capture
   - job status transitions
4. Add field-safe job status mutation + UI path for cleaners/inspectors:
   - allow `IN_PROGRESS` / `BLOCKED` transitions for assignee-owned jobs
   - keep `COMPLETED` tied to checklist completion
5. Implement replay conflict policy + diagnostics UI:
   - server wins for schedule ownership fields
   - client wins for newer local evidence fields
6. Add test coverage for:
   - schedule generation edge cases (timezone, biweekly/monthly boundaries)
   - job/checklist linkage lifecycle
   - offline replay conflict resolution

## Ready-For-User-Testing Gate
Proceed to broad user testing only when:
- Admin can operate properties + schedules + staffing without CLI.
- Cleaner and inspector have usable upcoming-jobs calendar.
- Scheduled job lifecycle works through checklist completion.
- Offline mode covers real field actions, not just checklist creation.
- P0 issues from benchmark matrix are closed.
