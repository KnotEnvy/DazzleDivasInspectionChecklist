# Dazzle Divas v3 Final Team Handoff

Updated: March 21, 2026

## Purpose
This is the active handoff for the next working team. The product is live in production and was used in the field on March 21, 2026. Treat this repo as an operating system for a real business, not a rebuild playground.

The team split for the next pass:
- UI/UX expert: improve clarity, speed, polish, consistency, and mobile ergonomics without breaking the current workflow.
- Backend/frontend expert: fix wiring, state, auth, data integrity, deployment, and production bugs.

## Current Product State
### Live and working
- Production auth is running through Convex Auth.
- Admins can manage properties, templates, staffing, schedules, and disposable jobs.
- Cleaners and inspectors can complete real checklist work in the field.
- Admin completed-checklist review is live.
- Photo review and iPhone-sized download/export are live.
- Offline queue/replay exists and has already been used in practice.

### Operating reality
- There is now real production data.
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Do not treat old pilot/dev reset tools as safe for production use.
- Any schema/auth/env change should be reviewed as a production change.

## Active Architecture
- Frontend host: Cloudflare Pages
- Frontend app: `apps/web`
- Backend host: Convex
- Backend app: `packages/backend/convex`
- Shared code: `packages/shared`
- Auth: Convex Auth + password-based accounts + invite/reset flow
- Storage: Convex DB + Convex file storage
- Runtime/package manager: Bun workspaces

## Source Of Truth
Keep root docs minimal.

Current active docs:
- `README.md`
- `FINAL_TEAM_HANDOFF.md`

Historical setup, rollout, and checkpoint docs have been moved to `archive/` and should be treated as reference only.

## Production Guardrails
- Preserve the current admin, cleaner, and inspector role model.
- Preserve completed-checklist history and evidence integrity.
- Preserve offline queue/replay behavior.
- Preserve photo capture and export behavior.
- Do not break the distinction between disposable scheduled jobs and completed checklist history.
- Do not casually change auth URLs, redirect handling, or onboarding flow without testing the live invite path.
- Prefer additive fixes over broad rewrites.

## Known Workstreams
### 1. Live Ops Bug Fixes
This is the first priority. Start from real usage pain, not speculative cleanup.

Initial known items:
- User onboarding state needs end-to-end cleanup and re-verification.
  - Goal: admin should see accurate user status such as invite pending vs password set.
  - Goal: resend invite should behave cleanly and not leave stale error messaging.
- Auth and invite links must stay on the production custom domain.
  - Goal: setup/password links should use `app.dazzledivascleaning.com` as the canonical app URL.
- Admin roster/status messaging can be clearer.
  - Goal: reduce confusing badge/error combinations after successful setup.

### 2. UI/UX Expert Scope
Primary mission: improve confidence and speed for real operators.

Focus areas:
- Admin dashboard and admin user management readability
- Completed-history scanning for the day’s finished work
- Completed-checklist review layout and photo actions
- Schedule/admin operations clarity
- Set-password/auth screens
- Mobile spacing, touch targets, contrast, and information hierarchy

Working rules:
- Preserve current workflow shape unless there is a strong usability reason to change it.
- Prefer obvious states over clever states.
- Optimize for busy operators on phones first, desktops second.
- When proposing changes, include before/after screenshots or a short visual rationale.
- Avoid cosmetic churn that does not reduce confusion or taps.

Expected deliverables:
- Ranked UX issue list with screenshots
- A compact visual system pass for badges, alerts, buttons, empty states, and forms
- Improvements to admin review and onboarding screens
- A small set of high-confidence production-safe UI changes

### 3. Backend/Frontend Expert Scope
Primary mission: make the app boringly reliable in production.

Focus areas:
- Auth, onboarding, resend invite, password setup state transitions
- Admin user state correctness
- Query/mutation/action consistency
- Deployment/env assumptions across Convex and Cloudflare
- Error handling and user-facing status messaging
- Data integrity around jobs, inspections, and evidence

Working rules:
- Reproduce bugs against the current live workflow before redesigning internals.
- Treat Convex actions/mutations and frontend state changes as one system.
- Do not ship auth or env changes without explicit verification steps.
- Keep production migrations and one-off data fixes narrow and auditable.

Expected deliverables:
- Verified fixes for onboarding/state edge cases
- Clear production env checklist for future maintainers
- Safer error handling and less ambiguous admin feedback
- Tight regression checks for the most business-critical flows

## First Session Checklist For The Next Team
1. Read `README.md`.
2. Read this handoff.
3. Confirm current production URLs and env assumptions before changing auth or deploy wiring.
4. Review the admin onboarding flow end to end in production.
5. Build a real bug list from field feedback before choosing feature work.
6. Separate bugs from enhancements.
7. Ship the smallest safe fixes first.

## Suggested Ownership Split
### UI/UX expert
- Owns visual audit, mobile/admin usability pass, and interaction clarity.
- Does not change backend contracts without coordinating with the wiring owner.

### Backend/frontend expert
- Owns auth/onboarding correctness, backend queries/actions, data states, and deployment integrity.
- Supports UI work by exposing the right state and reducing ambiguity in API responses.

### Shared ownership
- Admin onboarding flow
- Completed-checklist review experience
- Any state that is both user-visible and operationally important

## Validation Standard
Every meaningful production-facing change should be validated against these flows:
- Admin sign-in
- Create staff account
- Invite email arrival
- Password setup completion
- Correct admin status after setup
- Cleaner/inspector schedule access
- Checklist completion with photos
- Admin review of completed work
- Photo export/save flow
- Offline queue/replay for at least one worker scenario

## Backlog Capture Template
Use this format when collecting the next round of fixes:

```text
Title:
Type: bug | ux | enhancement
Priority: P0 | P1 | P2
Owner: UI/UX | Backend/Frontend | Shared
Observed in production?: yes/no
User impact:
Steps to reproduce:
Expected result:
Actual result:
Proposed fix:
Validation needed:
```

## Recommended Next Moves
1. Finish the onboarding correctness pass and verify it on the live app.
2. Consolidate the first real field-usage bug list.
3. Do a focused admin UI/UX polish pass on the highest-friction screens.
4. Only after those are stable, pick the next feature batch.
