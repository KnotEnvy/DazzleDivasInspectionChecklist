# Dazzle Divas v3 Final Team Handoff

Updated: April 1, 2026

## Purpose
This is the active high-level handoff for the next working team.
The app is live in production with real business data and real field usage.
Treat this repository like operating infrastructure, not a rebuild sandbox.

## Current Product State
### Live and working
- Production auth runs through Convex Auth.
- Admins manage staff, properties, templates, schedules, recurring plans, and disposable jobs.
- Cleaners and inspectors complete real field checklists.
- Admin completed-checklist review is live.
- Photo review and iPhone-friendly save/export flows are live.
- Offline queue/replay is live and has already been used in practice.
- The first full day with all staff accounts active completed successfully after the latest production fixes.

### Operating reality
- There is real production data.
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Any schema/auth/env change must be treated as a rollout change.
- Cloudflare Pages and Convex deploy separately. Do not assume a frontend deploy updated production backend behavior.
- Convex production is warning that the project is above Free plan limits. Bandwidth, storage, and usage headroom are active operational concerns.

## Source Of Truth
Current active docs:
- `README.md`
- `FINAL_TEAM_HANDOFF.md`
- `NEXT_TEAM_HANDOFF.md`

Historical setup and checkpoint docs live in `archive/` and should be treated as reference only.

## Recent Production Fixes That Matter
### Dispatch and turnover operations
- Quick Add Turnover now supports B2B jobs.
- B2B jobs automatically set the guest-arrival deadline to 4:00 PM on the same day.
- Quick Add defaults to a 10:00 AM start and automatically sets the end four hours later.
- Cleaners can now be assigned multiple overlapping jobs in dispatch.
- The server still enforces one active checklist at a time for a worker.
- Turnover creation now uses a two-step confirmation to reduce accidental incomplete jobs.

### Production incidents resolved
- `users:listActiveStaff` crashed production because the query was brittle against bad or legacy user data. It was hardened server-side.
- Dispatch reassignment still blocked overlapping cleaner jobs even after create/reschedule rules were relaxed. `jobs.reassign` was patched in production.
- Mobile photo uploads could appear to save, then disappear, while outbox conflicts accumulated. The frontend sync path was hardened so retryable photo failures stay retryable and conflicted local photos remain visible in the checklist.

### Deployment lesson repeated again
- Some fixes were backend-only, some frontend-only, and some required both. The next team must verify the deployment surface for every change before rollout is called complete.

## Priority Workstreams
### 1. Mobile checklist and photo confidence
Primary goal: make field workers trust what they just captured.

Focus:
- real-device testing on iPhone with weak connectivity
- confidence messaging during background photo upload
- conflict recovery that makes sense to non-technical cleaners
- avoiding UI states where recently captured evidence appears to vanish

### 2. Dispatch and admin throughput
Primary goal: improve operator speed without changing the real business workflow casually.

Focus:
- same-day turnover visibility
- B2B clarity in admin schedule and worker schedule views
- assignment speed for cleaners carrying multiple same-time jobs
- small reductions in accidental admin actions

### 3. Auth, roster, and production hardening
Primary goal: keep user management boring and reliable.

Focus:
- invite email delivery
- password setup completion state
- accurate admin roster status
- defensive handling of legacy or malformed user data

### 4. Deployment and rollout discipline
Primary goal: stop production drift between Cloudflare and Convex.

Rule:
- Any schema-backed UI change is not done until Convex production is deployed and verified.
- Any web-only change is not done until Cloudflare/frontend production is deployed and smoke-checked.

### 5. Convex usage and capacity
Primary goal: keep the app online and responsive under growing real usage.

Focus:
- inspect Convex bandwidth, storage, and function usage in the dashboard
- understand what photos, exports, and query volume cost in practice
- decide whether to reduce usage, change behavior, or move off the Free plan immediately

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
- Start only one active checklist at a time for a worker
- Checklist completion with photos
- Rapid successive photo capture on a real phone
- Conflict recovery and offline queue behavior for at least one worker scenario
- Admin review of completed work
- Photo export/save flow
- Property create/edit including Client / Account

## Recommended Next Moves
1. Build the next enhancement batch from real dispatch and field usage, not speculation.
2. Re-run mobile photo QA on a real iPhone in weak connectivity conditions before changing that flow again.
3. Audit Convex production usage and plan headroom before the next photo-heavy or query-heavy feature batch.
4. Keep fixes narrow and verify both frontend and backend deploy needs before calling rollout complete.

