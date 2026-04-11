# Dazzle Divas v3 Final Team Handoff

Updated: April 8, 2026

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

## What Changed Since The Previous Handoff
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

## Recommended Next Moves
1. Build the next enhancement batch from real cleaner/admin feedback, not speculation.
2. Keep finance changes narrow until admins trust the current numbers and approval flow day to day.
3. Re-run real-device photo QA on both iPhone and Android before changing capture flows again.
4. Audit Convex production usage before the next reporting-heavy or photo-heavy batch.
5. Keep fixes additive and always verify whether the rollout needs frontend deploy, Convex deploy, or both.
