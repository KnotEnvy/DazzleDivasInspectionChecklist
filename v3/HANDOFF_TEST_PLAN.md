# Dazzle Divas v3 - Rebuild Handoff Brief

## Purpose
Hand this to the next engineering team so they can finish the v3 rebuild into a production-viable field operations product.

This is not a QA-only handoff. It is a delivery blueprint for missing core product capabilities:
- Property management (admin CRUD)
- Cleaning schedules per property
- Calendar planning for cleaners + inspectors
- Competitive capability benchmarking (Breezeway-level baseline)

## Current State (As Of March 5, 2026 - End Of Day Update)

### What v3 already has
- Bun monorepo with React + Vite web app and Convex backend.
- Convex Auth with 3 roles: `ADMIN`, `CLEANER`, `INSPECTOR`.
- New signup defaults to `CLEANER`.
- Admin role can change user roles in Admin Console.
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
- Scheduling/job data model shipped:
  - `servicePlans`
  - `jobs`
  - `jobEvents`
- Idempotent job generation shipped:
  - `scheduling.generateJobs({ from, to })`
  - currently used for 14-day generation windows
- Field schedule route shipped:
  - `/my-schedule` list + simple week calendar + job detail drawer
- Job/checklist convergence shipped (core linkage):
  - start checklist from job via `jobId`
  - `jobs.linkedInspectionId` set on start
  - linked jobs auto-transition to `COMPLETED` when checklist is completed
  - audit events written to `jobEvents`
- Competitive benchmark matrix doc shipped:
  - `v3/BENCHMARK_MATRIX.md`

### What is still missing
- No admin global dispatch route (`/schedule`) yet.
- No admin reassign/reschedule/conflict-check UX yet.
- Offline outbox is still limited (mostly checklist creation only).
- No full offline replay/conflict-resolution policy implementation yet.
- No notification/messaging layer yet.
- No reporting primitives yet (completion rate, SLA misses, photo compliance).
- M1/M2 test coverage is still thin for:
  - schedule generation correctness edge cases
  - job/checklist lifecycle regression checks
  - offline replay/conflict correctness

## Handoff Update - What Was Completed In This Batch (March 5, 2026)

### Completed from prior "First 72-Hour Task List"
1. `/admin/properties` implemented end-to-end.
2. `servicePlans` + `jobs` (+ `jobEvents`) schema and indexes added.
3. `scheduling.generateJobs` implemented for selected date windows (14-day flow supported).
4. `/my-schedule` shipped with list + simple week calendar.
5. "Start Checklist" from job details shipped and linked to `jobs.linkedInspectionId`.
6. Benchmark matrix published with gap severity mapping.

### Important implementation notes for next team
- `CUSTOM_RRULE` is represented in schema but not yet executed by generator logic (currently skipped).
- Assignment visibility exists on property detail, but dedicated assignment management UX inside `/admin/properties` still needs hardening.
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
- Workstream B (basic)
- Workstream C (week/day view)
- Workstream D (link job -> inspection)
Status update (March 5, 2026):
- A: largely complete (assignment UX hardening still open)
- B: basic complete (`CUSTOM_RRULE` still pending)
- C: assignee view complete (`/my-schedule`), admin global dispatch still open
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
1. Build `/schedule` admin dispatch board (week/day first) with filters: assignee, property, status, job type.
2. Add admin job actions in dispatch UI:
   - reassign assignee
   - reschedule start/end
   - status transition controls (`SCHEDULED`/`IN_PROGRESS`/`BLOCKED`/`CANCELLED`)
3. Add conflict checks for dispatch updates:
   - overlapping assignments
   - archived/inactive property guardrails
4. Expand offline outbox beyond checklist creation:
   - task completion toggles
   - room notes
   - photo metadata capture
   - job status transitions
5. Implement replay conflict policy + diagnostics UI:
   - server wins for schedule ownership fields
   - client wins for newer local evidence fields
6. Add test coverage for:
   - schedule generation edge cases (timezone, biweekly/monthly boundaries)
   - job/checklist linkage lifecycle
   - offline replay conflict resolution

## Ready-For-User-Testing Gate
Proceed to broad user testing only when:
- Admin can operate properties + schedules without CLI.
- Cleaner and inspector have usable upcoming-jobs calendar.
- Scheduled job lifecycle works through checklist completion.
- Offline mode covers real field actions, not just checklist creation.
- P0 issues from benchmark matrix are closed.
