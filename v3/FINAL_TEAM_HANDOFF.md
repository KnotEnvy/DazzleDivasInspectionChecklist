# Dazzle Divas v3 Final Team Handoff

Updated: July 18, 2026

## Purpose
This is the active high-level handoff for the next working team.
The app is live in production with real business data, real staff usage, and a newly added finance workflow that admins are expected to rely on.
Treat this repository like operating infrastructure, not a rebuild sandbox.

## Current Product State
### Live and working
- Production auth runs through Convex Auth.
- Admins manage staff, properties, templates, schedules, recurring plans, and disposable jobs.
- Cleaners and inspectors complete field checklists room by room.
- Completed-work review is live for admins.
- Photo review and iPhone-friendly save/export flows are live.
- Backend photo retention is live: photos older than 90 days are purged monthly.
- Offline queue/replay is live and remains business-critical for field use.
- The finance module is now live for admin operations.

### Finance v1 is now part of the core app
The new finance section is not a prototype stub. It is the first real back-office layer built on top of jobs/checklists.

Current finance behavior:
- admin-only `Finance` tab exists in the main app shell
- finance includes `Overview`, `Payroll`, `Revenue`, and `Jobs` views
- payroll weeks run Thursday through Wednesday
- weekly payroll rows show the date the clean was performed
- properties store their own finance config, not one shared global setting
- property creation supports setting finance defaults at create time
- cleaners can have pay profiles with room-combo rate and unit bonus
- completed checklist review includes a finance panel for draft review, approval, and unlock
- revenue/payroll stay live-derived for unapproved work and become locked snapshots once approved
- finance is currently cleaning-focused and admin-facing; exports and broader accounting workflows are still future work

### Operating reality
- There is real production data.
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Any schema/auth/env change must be treated as a rollout change.
- Cloudflare Pages and Convex deploy separately. Do not assume a frontend deploy updated backend behavior.
- Convex production is warning that the project is above or near Free plan limits. Bandwidth, storage, and usage headroom are active operational concerns.
- Photo storage is now controlled by a 90-day retention policy. Do not bypass it or leave manual purge credentials enabled.

## What Changed Since The Previous Handoff
### July 16 production-feedback enhancement batch (deployed)
This batch was deployed on July 16, 2026. Convex production received the schema and backend functions first, followed by the matching Cloudflare Pages frontend from commit `e30aa21`. Future changes that span both surfaces still require coordinated deployment and verification.

- A started checklist can be stopped only while it is untouched. The backend rejects stopping after any task, note, issue, room, or photo is marked; a successful stop deletes the empty checklist scaffold, unlinks the job, and returns it to `SCHEDULED` so it can restart later.
- Dispatch Controls now keep a primary assignee while allowing admins to add or remove up to 7 additional team members (8 workers total).
- Job urgency does not become `Overdue` until after 4:00 PM on the scheduled day.
- Active admins receive in-app notifications when a job starts or completes. The notification panel stays above normal application content, uses a viewport-safe mobile layout with its own scrolling and close control, links to the dispatch drawer, and supports individual/all read actions.
- Inactive users have a permanent delete action. The July 17 fix replaced production-wide history reads with indexed reference checks, so unused accounts can be deleted at production scale while job, checklist, finance, audit, and admin history remains protected.
- Payroll payee job lists can be collapsed, and admins can move backward through Thursday-to-Wednesday weekly payroll or calendar-month payroll.
- The worker seven-day schedule no longer stretches every day card to the height of the busiest day.
- Clicking a day in the admin Week Ahead chart now loads that date into the operations panel.
- Daily Spark is visible on both admin and field-staff dashboards and uses 100 refreshed messages across the existing five categories.

### Checklist execution and field workflow
- A job-linked checklist can only be started on the day it is due or later.
- Start is blocked before 7:00 AM in the property's local timezone.
- Cleaners can now have up to 3 active checklists.
- Inspectors can now have up to 5 active checklists.
- Step 3A (`Room Notes`) was compacted so it collapses into the heading only.
- On Android, `Add Photo` now uses a camera-targeted capture path and a separate gallery option.
- Marking a room complete now scrolls to the next room in list order without auto-expanding it.

### Admin/history quality-of-life updates
- `History -> Finished Today` now shows the cleaner name at a glance.
- Finance property settings were fixed to be truly per-property and to rehydrate correctly when switching between properties.

### Finance rollout
- Admin-only finance reporting and approval is now wired into the product.
- Property finance settings and cleaner pay profiles are editable in the admin UI.
- Job financial review/approval is embedded in completed checklist review.
- Thursday-to-Wednesday weekly payroll reporting is the current business rule.

### Photo retention and capacity
- Convex now runs `purge photos older than 90 days` monthly on the 1st at `06:00 UTC`.
- Retention implementation lives in `packages/backend/convex/crons.ts`, `photoRetention.ts`, `photoRetentionBatches.ts`, `photoRetentionAdmin.ts`, and `lib/photoRetention.ts`.
- The retention purge deletes Convex storage objects and `photos` rows, then recomputes room photo counts without reopening completed checklists.
- The manual purge entrypoint is `photoRetentionAdmin:purgeExpiredPhotosNow`; it requires the temporary server env var `PHOTO_RETENTION_PURGE_TOKEN`.
- July 4, 2026 production catch-up purge completed with 564 photos deleted, 444,408,306 bytes removed, 223 room inspections touched, `0` failures, and `incomplete: false`.
- July 16, 2026 pre-May cleanup used cutoff `2026-05-01T04:00:00.000Z` and completed with 1,840 photos deleted, 542,414,995 bytes removed, 751 room inspections touched, `0` failures, and `incomplete: false`.
- The temporary production purge token was removed after each manual run; the standard 90-day retention action was restored and redeployed after the July 16 cleanup.

## Priority Workstreams For The Next Team
### 1. Cleaner/admin workflow polish from real usage
Primary goal: improve daily speed and clarity without changing the underlying business workflow casually.

Focus:
- cleaner friction in checklist execution
- admin friction in dispatch, review, and finance flows
- small, high-signal reductions in taps, confusion, and missed context
- preserving current workflow shape while making it more forgiving and more obvious

### 2. Finance reliability and operational usefulness
Primary goal: make finance trustworthy enough that admins stop maintaining shadow spreadsheets.

Focus:
- edge cases in payroll/revenue review
- clearer status distinctions between forecast, pending review, and approved
- better filtering, summaries, and audit clarity
- future export/reporting needs only after the current approval flow feels stable

### 3. Mobile checklist and photo confidence
Primary goal: make field workers trust what they just captured and completed.

Focus:
- real-device testing on both iPhone and Android
- confidence messaging during capture/upload/retry
- weak-connectivity behavior that feels obvious to non-technical cleaners
- protecting the current offline queue/replay stability

### 4. Deployment and rollout discipline
Primary goal: stop production drift between Cloudflare and Convex.

Rule:
- Any schema-backed UI change is not done until Convex production is deployed and verified.
- Any web-only change is not done until the frontend deploy is live and smoke-checked.

### 5. Convex usage and capacity
Primary goal: keep the app online and responsive under real usage growth.

Focus:
- inspect Convex bandwidth, storage, and function usage in the dashboard
- understand the cost of photos, finance queries, and history/reporting volume
- confirm monthly photo retention is running before storage pressure returns
- decide whether to reduce usage or move plans before growth forces the decision

## Validation Standard
Before shipping meaningful changes, validate:
- Admin sign-in
- Create staff account
- Invite email arrival
- Password setup completion
- Correct admin status after setup
- Cleaner and inspector schedule access
- Quick Add Turnover including B2B behavior
- Assign multiple same-time jobs to the same cleaner in dispatch
- Checklist start gating for future jobs and pre-7:00 AM attempts
- Cleaner active-checklist limit of 3 and inspector limit of 5
- Checklist completion with photos on a real phone where possible
- Android camera capture flow
- Conflict recovery and offline queue behavior for at least one worker scenario
- Admin review of completed work
- Finance approval/unlock on a completed job
- Payroll totals and Thursday-through-Wednesday grouping
- Property create/edit including finance config
- History `Finished Today` cleaner attribution
- Convex production deploy after any retention, photo storage, or cron change
- Untouched checklist stop/restart, including rejection after one marked task, note, issue, room, or photo
- Add and remove dispatch teammates without changing the intended primary assignee
- Admin notification creation, unread count, mark-read behavior, and dispatch link
- Inactive unused-user deletion plus protected rejection for a user with history
- Previous weekly and monthly payroll navigation and payee collapse state
- Overdue labels immediately before and after 4:00 PM

## Recommended Next Moves
1. Build the next enhancement batch from real cleaner/admin feedback, not speculation.
2. Keep finance changes narrow until admins trust the current numbers and approval flow day to day.
3. Re-run real-device photo QA on both iPhone and Android before changing capture flows again.
4. Audit Convex production usage after the July 4 photo purge and before the next reporting-heavy or photo-heavy batch.
5. Keep fixes additive and always verify whether the rollout needs frontend deploy, Convex deploy, or both.
