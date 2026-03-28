# Dazzle Divas v3 Final Team Handoff

Updated: March 28, 2026

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

### Operating reality
- There is real production data.
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Any schema/auth/env change must be treated as a rollout change.
- Cloudflare Pages and Convex deploy separately. Do not assume a frontend deploy updated production backend behavior.
- Convex production is now warning that the project is above Free plan limits. Bandwidth, storage, and usage headroom are active operational concerns.

## Source Of Truth
Current active docs:
- `README.md`
- `FINAL_TEAM_HANDOFF.md`
- `NEXT_TEAM_HANDOFF.md`

Historical setup and checkpoint docs live in `archive/` and should be treated as reference only.

## Priority Workstreams
### 1. Auth and onboarding correctness
Primary goal: boring, reliable staff onboarding.

Focus:
- invite email delivery
- password setup completion state
- accurate admin roster status
- production custom-domain auth correctness

### 2. Deployment and rollout discipline
Primary goal: stop production drift between Cloudflare and Convex.

Recent incident that matters:
- Property create/edit with the Client / Account field failed in production until Convex production was deployed with the matching schema/functions.
- The field existed in the repo, but production backend drift made the live feature fail.

Rule:
- Any schema-backed UI change is not done until Convex production is deployed and verified.

### 3. Convex usage and capacity
Primary goal: keep the app online and responsive under growing real usage.

Focus:
- inspect Convex bandwidth/storage/function usage in the dashboard
- understand what photos, exports, and queries cost in practice
- decide whether to reduce usage, change behavior, or move off the Free plan immediately

### 4. Highest-friction admin and mobile UX
Primary goal: improve operator speed without changing workflow shape casually.

Focus:
- admin onboarding/status clarity
- admin schedule and property-management ergonomics
- completed review clarity and photo actions
- mobile field efficiency on real phones

## Validation Standard
Before shipping meaningful changes, validate:
- Admin sign-in
- Create staff account
- Invite email arrival
- Password setup completion
- Correct admin status after setup
- Cleaner/inspector schedule access
- Checklist completion with photos
- Admin review of completed work
- Photo export/save flow
- Property create/edit including Client / Account
- Offline queue/replay for at least one worker scenario

## Recommended Next Moves
1. Re-verify onboarding correctness in production.
2. Audit Convex production usage and plan headroom before the next feature batch.
3. Build the next bug list from real usage, not speculation.
4. Keep fixes narrow and verify both frontend and backend deploy needs before calling a rollout complete.
