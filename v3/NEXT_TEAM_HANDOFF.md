# Dazzle Divas v3 Next Team Handoff

Updated: April 1, 2026

## Purpose
This is the fastest path for the next engineering team to understand the app, find the important code, and make safe changes.
The app is already used in production by admins, cleaners, and inspectors.

## What The App Does
- Admins manage staff, properties, templates, schedules, recurring plans, and disposable jobs.
- Cleaners and inspectors complete room-by-room checklists in the field.
- Field workers capture proof photos and notes during checklist execution.
- Admins review completed work and save/export photos.
- Offline queue/replay exists so field work can continue with weak or missing connectivity.

## Tech Stack
- Frontend: React 19 + Vite 6 + Tailwind 4 + React Router 7
- Backend: Convex functions + Convex Auth + Convex storage
- Shared package: `packages/shared`
- Package manager/runtime: Bun workspaces
- Frontend host: Cloudflare Pages
- Backend host: Convex

## Read These First
1. `README.md`
2. `FINAL_TEAM_HANDOFF.md`
3. This file

## Repo Layout
```text
v3/
  apps/web/                  Frontend app
  packages/backend/convex/   Convex backend functions
  packages/shared/           Shared domain types/constants
  scripts/                   Local utility scripts
```

## Production Guardrails
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Do not casually change auth, redirects, or env wiring.
- Do not break completed-history integrity.
- Do not break offline queue/replay behavior.
- Prefer narrow, additive fixes over rewrites.
- Do not assume a Cloudflare deploy means the matching Convex schema/functions are live.
- Treat Convex plan-limit and bandwidth warnings as operational issues.

## Key Frontend Files
### App shell and routing
- `apps/web/src/App.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/routes/AuthGuard.tsx`
- `apps/web/src/routes/RoleGuard.tsx`

### Auth and onboarding UI
- `apps/web/src/routes/LoginPage.tsx`
- `apps/web/src/routes/SetPasswordPage.tsx`
- `apps/web/src/hooks/useCurrentUser.ts`
- `apps/web/src/lib/passwordSetupCode.ts`
- `apps/web/src/lib/runtimeConfig.ts`
- `apps/web/src/main.tsx`

### Admin and property operations
- `apps/web/src/routes/AdminPage.tsx`
- `apps/web/src/routes/AdminPropertiesPage.tsx`
- `apps/web/src/routes/AdminSchedulePage.tsx`
- `apps/web/src/routes/NewChecklistPage.tsx`
- `apps/web/src/routes/MySchedulePage.tsx`

### Field checklist execution
- `apps/web/src/routes/InspectionPage.tsx`
- `apps/web/src/components/InspectionRoomPanel.tsx`
- `apps/web/src/components/OfflineQueuePanel.tsx`

### Completed review / photo export
- `apps/web/src/components/CompletedInspectionReview.tsx`
- `apps/web/src/lib/iphonePhotoExport.ts`

### Offline queue / sync
- `apps/web/src/app/OfflineSyncProvider.tsx`
- `apps/web/src/lib/offlineOutbox.ts`
- `apps/web/src/lib/offlineReplay.ts`
- `apps/web/src/lib/offlineInspectionState.ts`
- `apps/web/src/hooks/useOutboxItems.ts`
- `apps/web/src/hooks/useOutboxCount.ts`
- `apps/web/src/hooks/useNetworkStatus.ts`

## Key Backend Files
### Auth / onboarding / users
- `packages/backend/convex/auth.ts`
- `packages/backend/convex/auth.config.ts`
- `packages/backend/convex/users.ts`
- `packages/backend/convex/http.ts`
- `packages/backend/convex/lib/onboardingEmail.ts`

### Core checklist / photo flow
- `packages/backend/convex/inspections.ts`
- `packages/backend/convex/roomInspections.ts`
- `packages/backend/convex/taskResults.ts`
- `packages/backend/convex/photos.ts`

### Scheduling / jobs / properties / templates
- `packages/backend/convex/jobs.ts`
- `packages/backend/convex/scheduling.ts`
- `packages/backend/convex/properties.ts`
- `packages/backend/convex/templates.ts`
- `packages/backend/convex/servicePlans.ts`
- `packages/backend/convex/propertyAssignments.ts`

### Schema and helpers
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/lib/inspectionMetrics.ts`
- `packages/backend/convex/lib/inspectionReporting.ts`
- `packages/backend/convex/lib/jobLifecycle.ts`
- `packages/backend/convex/lib/permissions.ts`
- `packages/backend/convex/lib/validators.ts`

## Critical Flows And Where They Live
### 1. Staff onboarding / auth
Backend:
- `users.createStaffAccount`
- `users.resendStaffInvite`
- `users.completePasswordSetup`
- `users.bootstrapFirstAdmin`
- `auth.buildPasswordSetupRedirectPath`

Frontend:
- `AdminPage.tsx`
- `SetPasswordPage.tsx`
- `LoginPage.tsx`

Important note:
- Custom-domain invite/setup links depend on backend auth env, especially `CONVEX_SITE_URL`.

### 2. Field checklist execution
Primary screen:
- `InspectionPage.tsx`

Room interaction UI:
- `InspectionRoomPanel.tsx`

Checklist state mutations:
- `taskResults.ts`
- `roomInspections.ts`
- `inspections.ts`

### 3. Field photo capture / upload / replay
Frontend flow:
- `InspectionPage.tsx`
- `offlineOutbox.ts`
- `offlineReplay.ts`
- `offlineInspectionState.ts`

Backend photo persistence:
- `photos.generateUploadUrl`
- `photos.save`
- `photos.remove`

Current production behavior:
- Mobile capture uses one path through the native chooser from a single `Add Photo` action.
- Online capture is happy-path direct upload in the background.
- The offline queue is fallback-first, not queue-first.
- Photos queue when the device is offline, when uploads are backed up, or when a direct upload fails for a network-type reason.
- Transient photo upload or server failures should remain retryable, not be trapped as false conflicts.
- Conflicted local photo uploads now remain visible in the room UI so workers do not think they vanished.
- The top app-shell queue count now represents actionable queued work; conflicts are surfaced separately.
- Room completion waits for in-flight photo work and queued room photos before calling backend completion.
- Pending local photos can still be backed up manually from the UI.

### 4. Admin completed review / photo saving
- `CompletedInspectionReview.tsx`
- `iphonePhotoExport.ts`

Current behavior:
- `Save All for iPhone` prefers the native share sheet when supported.
- Fallback remains standard browser download behavior.

### 5. Admin properties / dispatch
Property management:
- `AdminPropertiesPage.tsx`
- `properties.ts`
- `schema.ts`

Dispatch / quick turnover:
- `AdminSchedulePage.tsx`
- `jobs.ts`

Current behavior:
- Properties own the optional `clientLabel` / Client / Account field.
- Quick Add Turnover no longer asks for client/account directly.
- Job hydration falls back to the property client so schedule screens still display client/account.
- Property lists and property pickers are alphabetical by name.
- Quick Add defaults to a 10:00 AM start.
- Quick Add automatically sets the end time four hours later.
- B2B jobs can be marked at creation time and automatically set the same-day arrival deadline to 4:00 PM.
- B2B jobs are visually labeled in admin and worker schedule surfaces.
- Cleaner-role jobs may overlap in dispatch assignment.
- Checklist execution still blocks a worker from having more than one active checklist at a time.
- Turnover creation uses a two-step confirmation to reduce accidental incomplete jobs.

## Recent Fixes And Incidents That Matter
### Field photo capture and checklist completion
- Photo handling was changed from queue-first to online-first direct upload with offline/backlog/network fallback into the outbox.
- Room completion now waits for in-flight and queued room photos before calling `roomInspections.complete`.
- The older stuck-photo / missing-photo-minimum regression was fixed.
- A later real-device production bug caused photos to appear saved and then disappear while queue and conflict counts climbed together.
- The current repo hardens the frontend photo sync path so retryable photo failures stay retryable, conflicts remain visible in the room UI, and old conflicts no longer force all new captures into queue mode.

### Dispatch and turnover operations
- The Client / Account field was moved from quick-turnover job creation onto properties as `clientLabel`.
- Production property create/edit later failed when Client / Account was present because the frontend feature reached production before the matching Convex backend/schema deploy.
- The outage was resolved by deploying Convex production.
- The repo now hardens property create/edit payloads so blank optional fields are omitted instead of sent as explicit `undefined`.
- Quick Add Turnover now supports B2B jobs, default 10:00 AM starts, automatic four-hour windows, cleaner overlap, and two-step confirmation.
- Dispatch reassignment for cleaners was separately patched in production after a bug report showed `jobs.reassign` still blocking overlapping cleaner jobs.

### Users / admin roster
- `users:listActiveStaff` crashed production because the query assumed perfectly shaped staff rows.
- The query was hardened so malformed or legacy user data does not take down admin schedule surfaces.

### Admin properties screen
- The properties list was made slightly taller and denser so admins can see more properties at once.

## Deployment Notes That Matter
- Cloudflare Pages frontend deploys and Convex backend deploys are separate concerns.
- A frontend change reaching production does not guarantee production Convex functions are on the same revision.
- If a feature depends on schema, mutation args, or backend hydration logic, verify that Convex production has also been deployed.
- If a fix is frontend-only, do not waste time waiting on Convex deploys.
- This mattered repeatedly during the property client-label rollout, the staff query fix, the cleaner reassignment fix, and the photo sync fix.
- Backend deploy script lives in `packages/backend/package.json`:
  - `bun run deploy`

## Capacity / Usage Notes
- Convex production has warned that the project is above or near Free plan limits.
- The next team should inspect Convex dashboard usage before taking on bandwidth-heavy or photo-heavy work.
- Assume photos, exports, and query volume may now have real cost and service implications.
- Capacity work is no longer optional cleanup; it is production-risk reduction.

## Dev Environment Notes
### Current dev deployment
- The last known dev backend target used in this pass was a `dev:` Convex deployment, not production.

### Dev-only helper functions
Look in `packages/backend/convex/devTools.ts` for:
- `listSetupUsers`
- `createDevUser`
- `setUserRoleByEmail`
- `assignUserToAllProperties`
- `seedStarterData`
- `seedPilotTestProperties`
- `removePilotTestProperties`
- `resetProjectData`

These are guarded for dev usage and should not be treated as production tooling.

### Secrets / credentials
- Do not store production or dev credentials in repo docs.
- If the next team needs current dev test-user credentials, share them outside the repo.

## Validation Commands
Run from `v3/`:

```bash
bun run typecheck
bun run typecheck:backend
bun run build:web
bun run test
```

Useful rollout smoke coverage:

```bash
bun run smoke:rollout
```

Useful schema sync step after backend schema changes:

```bash
cd packages/backend
npx convex dev --once
```

## Validation Flows That Matter Most
Before shipping meaningful changes, validate:
- Admin sign-in
- Create staff account
- Invite email arrival
- Password setup completion
- Correct admin roster/status after setup
- Cleaner schedule access
- Inspector schedule/checklist access
- Checklist completion with photos
- Rapid successive photo capture on a real phone
- Conflict recovery for queued or conflicted photo uploads
- Room completion after photos finish in background
- Admin quick-turnover creation
- Admin quick-turnover creation with B2B enabled
- Assign multiple same-time jobs to the same cleaner from dispatch
- Start one checklist while another assigned job remains pending
- Property create/edit including Client / Account
- Admin completed-review photo saving/export
- Offline queue/replay for at least one worker scenario

## Known Areas That Still Deserve Attention
- Real-device mobile QA is still essential for photo capture, network flapping, and native chooser behavior.
- Mobile photo UX is better, but workers would still benefit from stronger confidence during direct background upload, especially before the server record appears.
- Offline replay conflict handling is production-important and should stay stable.
- Auth/custom-domain correctness must always be rechecked before onboarding changes ship.
- Frontend-vs-backend deployment drift is a real operational risk because Cloudflare and Convex do not auto-roll together.
- Convex bandwidth, storage, and plan headroom need active monitoring.
- The app has real production data now, so any schema, auth, or env change should be treated as a rollout change.

## Next UX Batch The Team Should Be Ready For
These are the highest-signal areas surfaced by real production use, not speculation:
- Dispatch speed and clarity for admins managing many same-day turnovers.
- Stronger B2B deadline visibility in schedule cards and assignment views.
- Better field confidence around photo capture, upload progress, and recovery when connectivity is weak.
- Cleaner explanation of queue versus conflicts so non-technical users know what action is needed.
- Additional small safeguards against accidental admin actions where a mistaken tap creates cleanup work.


## Recommended First Work Pattern For The Next Team
1. Reproduce field feedback on a real phone or the live admin screen before changing code.
2. Trace the exact frontend route/component and backend mutation/query/action involved.
3. Ship the smallest safe fix.
4. Verify whether the change needs frontend deploy, Convex deploy, or both.
5. Check Convex usage and plan impact before large photo or query changes.
6. Only then move on to enhancements or polish.

## Bottom Line
This product is not a prototype anymore.
Treat it like business infrastructure for a real cleaning operation.
The safest path is to preserve workflow shape, fix real friction from field use, verify the deploy path explicitly, and keep an eye on Convex capacity before usage growth becomes an outage.

