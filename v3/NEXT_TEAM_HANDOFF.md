# Dazzle Divas v3 Next Team Handoff

Updated: April 8, 2026

## Purpose
This is the fastest path for the next engineering team to understand the current production app, find the important code, and make safe improvements.
The app is already used in production by admins, cleaners, and inspectors, and finance has now become part of that production workflow.

## What The App Does
- Admins manage staff, properties, templates, schedules, recurring plans, disposable jobs, and finance settings.
- Cleaners and inspectors complete room-by-room checklists in the field.
- Field workers capture proof photos and notes during checklist execution.
- Admins review completed work and save/export photos.
- Admins now review payroll/revenue data and approve job financials inside the app.
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
- Assume any change to jobs, inspections, photos, history, or finance can affect real business operations immediately.

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
- `apps/web/src/routes/HistoryPage.tsx`

### Finance UI
- `apps/web/src/routes/FinancePage.tsx`
- `apps/web/src/components/InspectionFinancePanel.tsx`

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

### Finance backend
- `packages/backend/convex/finance.ts`
- `packages/backend/convex/lib/finance.ts`

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
- `lib/jobLifecycle.ts`

Current production behavior:
- job-linked checklists can only start on the due date or later, never in the future
- start is blocked before 7:00 AM in the property's local timezone
- cleaners can have up to 3 active checklists
- inspectors can have up to 5 active checklists
- room completion moves to the next room in list order without expanding it automatically
- Step 3A `Room Notes` is intentionally collapsed down to the heading by default

### 3. Field photo capture / upload / replay
Frontend flow:
- `InspectionPage.tsx`
- `InspectionRoomPanel.tsx`
- `offlineOutbox.ts`
- `offlineReplay.ts`
- `offlineInspectionState.ts`

Backend photo persistence:
- `photos.generateUploadUrl`
- `photos.save`
- `photos.remove`

Current production behavior:
- iPhone and non-Android devices still follow the existing native chooser path
- Android now uses a camera-targeted file input for the main `Add Photo` action and offers gallery as a separate path
- online capture is happy-path direct upload in the background
- the offline queue is fallback-first, not queue-first
- photos queue when the device is offline, when uploads are backed up, or when a direct upload fails for a network-type reason
- transient photo upload or server failures should remain retryable, not be trapped as false conflicts
- conflicted local photo uploads remain visible in the room UI so workers do not think they vanished
- the top app-shell queue count represents actionable queued work; conflicts are surfaced separately
- room completion waits for in-flight photo work and queued room photos before calling backend completion
- pending local photos can still be backed up manually from the UI

### 4. Admin completed review / photo saving / finance approval
Completed review and photo save:
- `CompletedInspectionReview.tsx`
- `iphonePhotoExport.ts`

Finance review:
- `InspectionFinancePanel.tsx`
- `finance.getInspectionReview`
- `finance.saveJobFinancialDraft`
- `finance.approveJobFinancial`
- `finance.unlockJobFinancial`

Current behavior:
- `Save All for iPhone` prefers the native share sheet when supported
- fallback remains standard browser download behavior
- admins can review job financial data directly from completed checklist review
- approved job financials become locked snapshots for realized reporting
- unlocking requires a reason and returns the job to editable/pending state

### 5. Admin properties / dispatch
Property management:
- `AdminPropertiesPage.tsx`
- `properties.ts`
- `schema.ts`

Dispatch / quick turnover:
- `AdminSchedulePage.tsx`
- `jobs.ts`

Current behavior:
- properties own the optional `clientLabel` / Client / Account field
- properties also own their own cleaning finance config
- property creation now supports saving cleaning finance defaults at create time
- finance config edit state on the property screen is per-property and rehydrates correctly when switching records
- Quick Add Turnover no longer asks for client/account directly
- job hydration falls back to the property client so schedule screens still display client/account
- property lists and pickers are alphabetical by name
- Quick Add defaults to a 10:00 AM start
- Quick Add automatically sets the end time four hours later
- B2B jobs can be marked at creation time and automatically set the same-day arrival deadline to 4:00 PM
- B2B jobs are visually labeled in admin and worker schedule surfaces
- cleaner-role jobs may overlap in dispatch assignment
- checklist execution still enforces active-checklist limits by role
- turnover creation uses a two-step confirmation to reduce accidental incomplete jobs

### 6. Finance reporting and setup
Core finance screens:
- `FinancePage.tsx`
- `AppShell.tsx`
- `App.tsx`

Admin setup surfaces:
- `AdminPropertiesPage.tsx` for per-property finance settings
- `AdminPage.tsx` for cleaner pay profiles

Backend source:
- `finance.ts`
- `lib/finance.ts`
- `schema.ts`

Current finance behavior:
- finance is admin-only
- tabs include `Overview`, `Payroll`, `Revenue`, and `Jobs`
- payroll weeks run Thursday through Wednesday
- weekly payroll rows show the clean/performed date
- finance currently focuses on cleaning jobs
- properties store `cleaningRevenuePerJob`, `roomComboUnits`, and optional notes
- cleaners store pay profiles with room-combo rate and unit bonus
- unapproved work uses live-derived finance values from current property settings and pay profiles
- approved work uses locked job financial snapshots so realized reporting does not drift
- there is not yet a formal export/report download workflow; admins still need to operate from the screen data

## Recent Fixes And Incidents That Matter
### Finance rollout and follow-up fixes
- Finance was added as the first admin accounting/payroll workflow in the app.
- Property finance settings initially behaved like one shared form state and appeared to erase when switching tabs/properties; this was fixed in the property screen by correctly rehydrating from the selected property.
- Property creation now supports finance defaults so admins do not need to create the property and then immediately revisit it just to set revenue/unit values.
- Payroll week grouping was updated to Thursday-through-Wednesday to match the business rule.
- Weekly payroll now shows performed dates.

### Field photo capture and checklist completion
- Photo handling was changed from queue-first to online-first direct upload with offline/backlog/network fallback into the outbox.
- Room completion now waits for in-flight and queued room photos before calling `roomInspections.complete`.
- The older stuck-photo / missing-photo-minimum regression was fixed.
- A later real-device production bug caused photos to appear saved and then disappear while queue and conflict counts climbed together.
- The current repo hardens the frontend photo sync path so retryable photo failures stay retryable, conflicts remain visible in the room UI, and old conflicts do not force all new captures into queue mode.
- Android capture flow was updated so workers can take pictures directly from the app instead of being pushed into gallery selection.

### Dispatch and turnover operations
- The Client / Account field was moved from quick-turnover job creation onto properties as `clientLabel`.
- Production property create/edit later failed when Client / Account was present because the frontend feature reached production before the matching Convex backend/schema deploy.
- The outage was resolved by deploying Convex production.
- The repo hardens property create/edit payloads so blank optional fields are omitted instead of sent as explicit `undefined`.
- Quick Add Turnover supports B2B jobs, default 10:00 AM starts, automatic four-hour windows, cleaner overlap, and two-step confirmation.
- Dispatch reassignment for cleaners was separately patched in production after a bug report showed `jobs.reassign` still blocking overlapping cleaner jobs.

### Users / admin roster
- `users:listActiveStaff` crashed production because the query assumed perfectly shaped staff rows.
- The query was hardened so malformed or legacy user data does not take down admin schedule surfaces.

### History/admin visibility
- History cards for completed work now show the cleaner name so admins can see who did what at a glance.

## Deployment Notes That Matter
- Cloudflare Pages frontend deploys and Convex backend deploys are separate concerns.
- A frontend change reaching production does not guarantee production Convex functions are on the same revision.
- If a feature depends on schema, mutation args, query hydration, or backend calculations, verify that Convex production has also been deployed.
- Finance changes especially need this check because settings forms, approval flows, and reporting all depend on backend shape and calculations.
- If a fix is frontend-only, do not waste time waiting on Convex deploys.
- Backend deploy script lives in `packages/backend/package.json`:
  - `bun run deploy`

## Capacity / Usage Notes
- Convex production has warned that the project is above or near Free plan limits.
- The next team should inspect Convex dashboard usage before taking on bandwidth-heavy, reporting-heavy, or photo-heavy work.
- Assume photos, exports, history views, and finance queries may now have real cost and service implications.
- Capacity work is production-risk reduction, not optional cleanup.

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
- Checklist start blocking on future dates and before 7:00 AM local property time
- Cleaner active-checklist limit of 3 and inspector limit of 5
- Checklist completion with photos
- Rapid successive photo capture on a real phone
- Android camera capture flow and gallery fallback
- Conflict recovery for queued or conflicted photo uploads
- Room completion after photos finish in background and advance to the next collapsed room
- Admin quick-turnover creation
- Admin quick-turnover creation with B2B enabled
- Assign multiple same-time jobs to the same cleaner from dispatch
- Start one checklist while other assigned jobs remain pending within the role limit rules
- Property create/edit including Client / Account
- Property create/edit including finance config
- Admin completed-review photo saving/export
- Finance approval/unlock from completed checklist review
- Finance overview/revenue/payroll/jobs surfaces for expected totals and statuses
- Payroll Thursday-through-Wednesday grouping and performed dates
- History `Finished Today` cleaner attribution
- Offline queue/replay for at least one worker scenario

## Known Areas That Still Deserve Attention
- Real-device mobile QA is still essential for photo capture, network flapping, and native chooser behavior.
- Mobile photo UX is better, but workers would still benefit from stronger confidence during direct background upload, especially before the server record appears.
- Finance is useful now, but admins will likely surface follow-up needs around exports, filters, approvals, and edge cases once they stop using spreadsheets.
- Workflow polish from real cleaner/admin suggestions is the next expected batch, especially small improvements that remove hesitation or repeat taps.
- Offline replay conflict handling is production-important and should stay stable.
- Auth/custom-domain correctness must always be rechecked before onboarding changes ship.
- Frontend-vs-backend deployment drift is a real operational risk because Cloudflare and Convex do not auto-roll together.
- Convex bandwidth, storage, and plan headroom need active monitoring.
- The app has real production data now, so any schema, auth, env, history, or finance change should be treated as a rollout change.

## Next UX Batch The Team Should Be Ready For
These are the highest-signal areas surfaced by real production use, not speculation:
- workflow improvements from cleaner suggestions during live checklist use
- admin speed and clarity improvements in dispatch, completed review, history, and finance
- small improvements that make room progression, photo capture, and completion status more obvious in the field
- finance polish that reduces the need for shadow spreadsheets without destabilizing the approval model
- additional safeguards against accidental admin actions where a mistaken tap creates cleanup work

## Recommended First Work Pattern For The Next Team
1. Reproduce the friction on a real phone or the live admin screen before changing code.
2. Trace the exact frontend route/component and backend mutation/query/action involved.
3. Ship the smallest safe fix.
4. Verify whether the change needs frontend deploy, Convex deploy, or both.
5. Check Convex usage and plan impact before large photo, history, or finance-query changes.
6. Only then move on to broader enhancements or polish.

## Bottom Line
This product is not a prototype anymore.
It now supports both field operations and the first real admin finance workflow.
The safest path for the next team is to preserve the working workflow shape, fix real friction from cleaner/admin usage, keep finance trustworthy, verify the deploy path explicitly, and watch Convex capacity before growth becomes an outage.
