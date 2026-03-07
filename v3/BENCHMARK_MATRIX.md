# Dazzle Divas v3 Competitive Benchmark Matrix

Updated: March 7, 2026

Legend:
- Gap severity: `P0` = blocks operational baseline, `P1` = high-value gap, `P2` = polish/optimization.
- Owner is the suggested workstream owner (assign names as staffing is finalized).

| Capability | Breezeway Support | Peer Support (Turno/Hostaway/ResortCleaning) | v3 Current Status | Gap Severity | Owner |
| --- | --- | --- | --- | --- | --- |
| Property CRUD (create/edit/archive) | Yes (baseline) | Yes | Implemented in app via `/admin/properties` with archive/unarchive and operations metadata. | Closed for M1 | Workstream A |
| Property operations metadata (timezone/access/entry/service notes) | Yes | Yes | Implemented in schema + admin forms. | Closed for M1 | Workstream A |
| Property assignment visibility | Yes | Yes | Assignment counts surfaced; assignment workflows exist in backend/admin flows. | P1 (UI polish + bulk ops) | Workstream A |
| Recurring service plans per property | Yes | Yes | Implemented `servicePlans` schema + CRUD. | Closed for M1 (core) | Workstream B |
| Job generation from plans | Yes | Yes | Implemented `scheduling.generateJobs({from,to})` with idempotency and timezone-aware scheduling. | Closed for M1 (core) | Workstream B |
| Dispatch calendar (global admin board) | Yes | Yes | Implemented `/schedule` with week/day views, manual job creation, unassigned queue, drawer actions, and checklist launch. | Closed for M1 (core) | Workstream C |
| Assignee schedule calendar/list | Yes | Yes | Implemented `/my-schedule` with worker-focused current-job flow, start/resume checklist CTA, and assignee-safe status controls. | Closed for M1 (core) | Workstream C |
| Reassign/reschedule jobs in UI | Yes | Yes | Implemented in `/schedule` with overlap guardrails and unassigned-job support. | Closed for M1 (core) | Workstream C |
| Manual turnover dispatch | Yes | Yes | Implemented manual admin job creation for specific days with optional assignee and unassigned queue flow. | Closed for M1 (core) | Workstream C |
| Job lifecycle audit trail | Yes | Yes | Implemented `jobEvents` + events for generation/checklist start/checklist completion. | Closed for M1 (core) | Workstream B/D |
| Job to checklist linkage | Yes | Yes | Implemented via `inspections.create({ jobId })` and linked status transitions. | Closed for M1 | Workstream D |
| Mobile-friendly job execution | Yes | Yes | Implemented worker-first `/my-schedule` plus room-first checklist execution. | P1 (deeper field UX polish) | Workstream D |
| Inspection evidence capture (tasks/photos) | Yes | Yes | Existing v3 checklist/photo foundation in place. | Closed for M1 | Workstream D |
| Turnover intake metadata | Yes | Yes | Manual jobs exist, but dispatch still lacks first-class source/client/arrival-deadline metadata. | P1 | Workstream C |
| Offline reliability beyond checklist creation | Yes | Yes | Not yet complete; outbox still mostly checklist creation-only. | P0 | Workstream E |
| Conflict resolution policy + replay diagnostics | Yes | Yes | Not yet implemented. | P0 | Workstream E |
| Messaging/notifications | Yes | Mixed | Not yet implemented. | P1 | Workstream F |
| Reporting (completion rate/SLA/photo compliance) | Yes | Mixed | Not yet implemented. | P1 | Workstream F |

## Milestone Parity Snapshot

### M1: Operational Baseline
- Progress: dispatch baseline is now shipped; remaining `P0` blocker is offline field reliability + replay/conflict handling.

### M2: Field-Ready Reliability
- Primary focus: Workstream E completion and schedule UX hardening.

### M3: Competitive Hardening
- Primary focus: Reporting, notifications, and closing high-impact `P1` gaps.
