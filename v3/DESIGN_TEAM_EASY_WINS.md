# Design Team Easy Wins

Updated: April 5, 2026

## Purpose
This document is for the design team working on UI and UX improvements for the live production app.

The goal is not to redesign the workflow from scratch.
The goal is to improve clarity, speed, confidence, and polish for the screens the team is already using every day.

## Design Principles For This App
- Prioritize operational clarity over decorative UI.
- Make urgent jobs and next actions obvious at a glance.
- Use the Dazzle Divas brand consistently across auth, shell, dashboard, schedule, and checklist screens.
- Reduce hesitation after important actions like assigning work, taking photos, and completing rooms.
- Keep admin speed high while reducing accidental taps.
- Keep field-worker messaging plain and non-technical.

## What Was Completed In The April 5, 2026 Pass

### 1. B2B urgency styling (DONE)
B2B jobs are now visually unmistakable across all screens:
- `.b2b-card-accent` CSS class adds a rose left border + subtle gradient tint to B2B job cards.
- `.b2b-badge` CSS class provides a consistent rose pill badge reading "B2B".
- Guest arrival deadline shown with live countdown ("Guest arrival in 2h 15m") on B2B cards.
- Applied to: Dashboard (worker Up Next, worker Today, admin Needs Attention, admin Today's Operations), My Schedule (selected job, Up Next preview, expanded list, desktop detail aside, weekly grid dot indicator), Admin Dispatch (unassigned queue cards, calendar cells).
- Shared utility: `apps/web/src/lib/urgency.ts` provides `formatDeadlineCountdown()`.
- `arrivalDeadline` added to frontend `ScheduleJob` types in DashboardPage and MySchedulePage so the field is available without backend changes.

### 2. Worker schedule urgency indicators (DONE)
Workers now see the same urgency awareness admins already had on dispatch:
- Urgency left borders on job cards (rose = overdue, amber = within 24h, sky = within 48h).
- Urgency label badges ("Overdue", "Due soon", "Within 24h", "Within 48h") next to status badges.
- Colored dot indicators on the weekly grid for urgent and B2B jobs.
- Dynamic selected-job border: B2B accent takes priority, then urgency color, then default brand.
- Shared utility: `apps/web/src/lib/urgency.ts` provides `urgencyBorderClass()`, `urgencyLabelText()`, `urgencyLabelTone()`, `getUrgencyLevel()`.
- AdminSchedulePage refactored to use the same shared utility (removed local duplicate functions).

### 3. Dashboard Up Next hierarchy (DONE)
The worker dashboard Up Next section is now the strongest visual focal point:
- First job card has a larger property name (`text-lg font-bold`), urgency/B2B styling, and a "Starts in X hours" countdown.
- Primary CTA on the first card uses the `.go` (emerald green) variant with larger min-height for emphasis.
- B2B badge, arrival deadline, and urgency badge shown on the first card when applicable.
- Admin dashboard: Today's Operations rows show urgency borders and B2B badges; Needs Attention cards show B2B accent styling.

### 4. Auth screen brand polish (DONE)
Login and Set Password pages now feel like the same branded product:
- Dazzle Divas logo (same `pink-dazzleLogo.WEBP` asset used in the app shell) centered above the form at `h-20 w-20` with matching container styling.
- Text elements (eyebrow, heading, subtitle) centered.
- Login heading simplified from "Dazzle Divas Cleaning Hub" to "Cleaning Hub" since the logo already communicates the brand.
- Panel padding increased from `p-6` to `p-6 sm:p-8` for more breathing room.

### 5. Photo upload confidence polish (DONE)
Photo states are now visually distinct and confidence is stronger:
- Pending upload count displayed as a styled badge pill with pulsing dot indicator instead of plain text.
- "Uploading in background" placeholder cards now use brand-tinted background with animated pulse dot and "Uploading..." label, instead of plain gray.
- Photo card placeholder backgrounds are color-coded: rose for conflicts ("Sync needs review"), amber for queued ("Queued — waiting to upload"), slate for unavailable previews.
- Photo subtitle labels are color-coded and bold: rose for "needs review", amber for "queued locally".

### 6. Action copy standardization (PARTIAL)
- Room completion confirmation button standardized from "Complete Room" to "Mark Room Complete" (matches the default button label).
- Notes button standardized from "Save Room Notes" to "Save Notes".
- Remaining: AdminSchedulePage generic "Assign" button should become role-aware ("Assign Cleaner" / "Assign Inspector") in a future pass.

## What Still Deserves Attention

### Highest remaining opportunities

#### App shell status pill clarity
- `Queue` and `Conflicts` labels are still technical.
- Consider renaming to `Saved On Phone`, `Waiting To Sync`, or `Sync Queue` for Queue.
- Consider `Needs Review` for Conflicts.
- Nav active states could be slightly bolder on mobile.
- Reduce visual competition between status pills and nav controls.

#### Dispatch assignment copy
- The "Assign" button in AdminSchedulePage dispatch should become role-aware: "Assign Cleaner" or "Assign Inspector" based on the job type's required role.
- AdminPropertiesPage already follows this pattern correctly.

#### History and completed review polish
- Make the completed-review page feel more premium and review-oriented.
- Improve photo review grouping and section hierarchy.
- Make the save/export action feel more important and more obvious.
- Strengthen empty-state language when there is nothing completed yet.

#### Dispatch form and drawer
- Make the Add Turnover area feel more guided and less form-heavy.
- Visually separate standard turnover creation from B2B creation more clearly.
- Reduce visual density in the dispatch drawer so the key editable fields are easier to scan.
- Make successful assignment feedback more visible.

#### Empty state copy
- `Queue is clear` → consider `All jobs are assigned`
- `No jobs in this window` → consider `No assigned jobs in this time range`
- `No photos captured yet` → consider `No proof photos added yet`

## Screen-By-Screen Status

### 1. App Shell
Status: NOT TOUCHED in this pass.
Remaining work: status pill relabeling, nav active state polish, visual competition reduction.

### 2. Dashboard
Status: DONE — Up Next hierarchy, B2B urgency, admin Today's Operations and Needs Attention all enhanced.
Remaining work: summary card label refinement for more operational tone.

### 3. My Schedule
Status: DONE — urgency borders, urgency labels, B2B badge/accent, arrival deadline countdown, dynamic selected-job border.
Remaining work: none significant.

### 4. Dispatch Schedule
Status: PARTIALLY DONE — B2B badge updated to shared CSS class, urgency functions refactored to shared utility, B2B card accent on unassigned queue.
Remaining work: "Assign" button role-awareness, Add Turnover form polish, dispatch drawer density reduction, assignment success feedback.

### 5. Inspection Page And Room Panel
Status: DONE — photo upload confidence polish (color-coded states, animated upload placeholders, styled pending count badge), copy fixes (Mark Room Complete, Save Notes).
Remaining work: none significant. Real-device mobile QA still recommended for photo capture behavior.

### 6. Login And Set Password
Status: DONE — logo added, text centered, heading simplified, padding increased.
Remaining work: success/error/help state polish if desired.

### 7. History And Completed Review
Status: NOT TOUCHED in this pass.
Remaining work: premium review feel, photo grouping, save/export prominence, empty-state language.

## New Shared Utilities Created

### `apps/web/src/lib/urgency.ts`
Provides urgency calculation and display utilities used across Dashboard, My Schedule, and Admin Dispatch:
- `getUrgencyLevel(scheduledStart)` → `"OVERDUE" | "DUE_SOON" | "WITHIN_24H" | "WITHIN_48H" | null`
- `urgencyBorderClass(scheduledStart)` → Tailwind border-l-4 classes
- `urgencyLabelText(scheduledStart)` → human-readable label string
- `urgencyLabelTone(level)` → Tailwind bg + text classes for badge pills
- `formatDeadlineCountdown(timestamp)` → relative time string like "in 2h 15m"

### `index.css` additions
- `.b2b-card-accent` — rose left border + subtle rose gradient background tint for B2B job cards
- `.b2b-badge` — consistent rose pill badge for B2B labels

## Copy And Label Reference

### Standardized action patterns (current state)
- `Start Checklist` / `Resume Checklist` — consistent across Dashboard, My Schedule, Admin Dispatch
- `Add Turnover` / `Confirm Add Turnover` — consistent in Admin Dispatch two-step flow
- `Mark Room Complete` — standardized in room completion (both default and confirmation states)
- `Complete Checklist` — consistent in inspection completion
- `Save Notes` — standardized in room notes
- `Assign` — still generic in Admin Dispatch (needs role-awareness in future pass)
- `Resume Inspection` — intentional role-specific variant for inspector dashboard

### Visual Priority Model
- Level 1: next action (largest CTA, `.go` green on first card)
- Level 2: urgent state (urgency badges, B2B badges, arrival deadline countdowns)
- Level 3: supporting context (schedule window, address, notes)
- Level 4: management controls (secondary buttons, metadata)

## What Not To Change Casually
Because the app is live and used in production, avoid redesigning these without workflow validation:
- photo capture flow shape
- offline queue and replay behavior
- dispatch assignment workflow shape
- checklist completion rules
- onboarding/auth flow structure
- urgency threshold logic (now shared in `urgency.ts` — changes affect all screens simultaneously)

## Suggested Next Design Pass
If the next team wants the highest-value remaining batch:
1. App shell status pill relabeling and nav polish
2. Dispatch "Assign" button role-awareness
3. History / completed review page premium polish
4. Dispatch form and drawer density reduction
5. Empty state copy improvements

## Files Modified In This Pass

| File | Changes |
|------|---------|
| `apps/web/src/lib/urgency.ts` | **NEW** — shared urgency utilities |
| `apps/web/src/index.css` | Added `.b2b-card-accent` and `.b2b-badge` classes |
| `apps/web/src/routes/AdminSchedulePage.tsx` | Refactored to shared urgency; updated B2B badge to CSS class |
| `apps/web/src/routes/MySchedulePage.tsx` | B2B + urgency styling on all job surfaces |
| `apps/web/src/routes/DashboardPage.tsx` | Up Next hierarchy; B2B + urgency on worker and admin dashboards |
| `apps/web/src/routes/LoginPage.tsx` | Logo, centered text, simplified heading, increased padding |
| `apps/web/src/routes/SetPasswordPage.tsx` | Logo, centered text, increased padding |
| `apps/web/src/components/InspectionRoomPanel.tsx` | Photo confidence polish; copy fixes |

## Deployment Notes
- All changes in this pass are frontend-only.
- Deploy via Cloudflare Pages — no Convex backend deploy required.
- No schema, mutation, or query changes were made.
- The `urgency.ts` shared utility is code-split automatically by Vite (0.89 kB gzipped).

## Definition Of Success
The design pass is working if:
- cleaners know what to do next faster
- admins spot urgent same-day jobs faster
- B2B jobs are impossible to miss across every screen
- users hesitate less after taking photos or assigning jobs
- photo upload states are clear at a glance without reading text
- the app feels more like a branded operations product and less like an internal tool
- auth screens feel like the same product as the post-login experience
