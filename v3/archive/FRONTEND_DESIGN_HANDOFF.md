# Dazzle Divas v3 Frontend Design Handoff

Updated: March 11, 2026

## Purpose
This brief is for the frontend design team taking over the visual and UX modernization pass for Dazzle Divas v3.

The product is already working end-to-end. This is not a concept redesign from zero. The design goal is to raise the visual quality, clarity, and mobile usability to modern standards without breaking the field workflow that is already shipped.

## Product Summary
Dazzle Divas v3 is a field operations app for cleaners, inspectors, and admins.

The main shipped workflows are:
- admin property management
- service plans and generated jobs
- dispatch and staffing
- worker schedule
- checklist execution
- issue capture
- offline queue and replay
- completed history and report review

The product should feel like an operational field tool, not a marketing site.

## User Roles
- `ADMIN`
  - manages properties, staffing, templates, dispatch, and jobs
- `CLEANER`
  - works from `My Schedule`
  - starts or resumes cleaning checklists
- `INSPECTOR`
  - works from `My Schedule`
  - starts or resumes inspection checklists

## Non-Negotiable Product Rules
These are functional constraints that design must preserve:

- `COMPLETED` is tied to checklist completion.
- Worker job status controls are limited to `IN_PROGRESS` and `BLOCKED`.
- Offline queue and replay must stay visible and understandable.
- `CONFLICT` states must not be hidden or softened into invisible failures.
- Schedule state and checklist evidence are different:
  - schedule state is server-owned
  - checklist evidence is client-owned
- Mobile execution speed matters more than decorative complexity.
- The room-first checklist flow is intentional and should remain the core execution model.

## Current Information Architecture
Main routes:
- `/`
  - dashboard
- `/my-schedule`
  - primary worker operating screen
- `/checklists/:inspectionId`
  - primary field execution surface
- `/history`
  - completed checklist history
- `/schedule`
  - admin dispatch board
- `/admin`
  - admin staff management
- `/admin/properties`
  - property management and override configuration
- `/admin/templates`
  - checklist template management

## Highest-Value Screens For Redesign
Prioritize these in order:

1. `My Schedule`
   - this is the primary worker surface
   - speed, hierarchy, and tap efficiency matter most here

2. `Inspection Page`
   - this is the most important field workflow
   - room progress, issue visibility, photo flow, and completion clarity are critical

3. `Admin Schedule`
   - dispatch needs faster scanning, clearer assignment state, and better drawer hierarchy

4. `App Shell`
   - should feel more intentional and modern
   - nav, top status pills, and shell framing can be elevated significantly

5. `Admin Properties`
   - useful place for information density, structure, and cleaner visual grouping

## Current Visual Direction
The current UI is intentionally functional but conservative:
- teal brand palette
- glass-panel shell treatment
- `Sora` + `Manrope`
- soft rounded cards and pills
- light background with subtle radial gradients

This is a safe baseline, not the target end state.

The next pass can be bolder as long as readability and field speed improve.

## Design Opportunities
Good places to push harder:

- stronger hierarchy between primary action and secondary controls
- better information grouping in worker/job cards
- more deliberate typography scale
- cleaner spacing rhythm and card composition
- more expressive but still professional color use
- stronger state design for:
  - queued
  - syncing
  - conflict
  - blocked
  - completed
- clearer scan patterns for dispatch calendars and worker cards
- better empty states and loading states
- improved mobile-safe sticky actions where appropriate

## Areas Where Designers Should Be Careful
Do not unintentionally damage these:

- checklist room progression clarity
- visibility of required photo minimums
- issue flag visibility
- queue/conflict visibility
- large tap targets for gloves/one-handed use
- admin dispatch density in week/day/month views
- distinctions between:
  - job status
  - checklist status
  - sync state

If a visual concept makes queue state or completion logic less explicit, it is a regression even if it looks nicer.

## Worker Experience Goals
For `My Schedule` and `Inspection Page`, optimize for:

- one primary action per section
- fast scanning from standing position
- high contrast
- thumb-friendly controls
- obvious progress
- minimal ambiguity about “what do I do next?”

The worker should always be able to answer:
- What job should I work on now?
- What is still missing?
- Am I online or offline?
- Did my work sync?

## Admin Experience Goals
For `Admin Schedule` and `Admin Properties`, optimize for:

- information density without clutter
- better grouping of property/job metadata
- more visual distinction between unassigned, assigned, blocked, cancelled, and completed jobs
- faster scan of day/week/month workload
- cleaner form layouts for high-volume editing

Admins need stronger operational confidence more than fancy motion.

## Offline And Sync UX
This is a major part of the product and must be handled intentionally.

Important sync states that need strong visual language:
- `Online`
- `Offline`
- `Syncing`
- queued actions
- `CONFLICT`
- synced/resolved items

Design should help users understand:
- when work is saved locally
- when it is replaying
- when it needs review
- where to go when there is a conflict

Avoid any design pattern that hides the queue panel or makes conflict messaging feel secondary.

## Mobile Guidance
The app must stay usable on phones during real field work.

Preferred design behaviors:
- strong vertical flow
- compact but readable cards
- sticky or persistent primary actions only where they reduce friction
- avoid dense horizontal toolbars on small screens
- preserve large hit areas
- reduce repeated explanatory text when possible if the layout becomes more intuitive

## Components And Surfaces Designers Should Inspect
Important files:
- `v3/apps/web/src/components/AppShell.tsx`
- `v3/apps/web/src/components/OfflineQueuePanel.tsx`
- `v3/apps/web/src/routes/MySchedulePage.tsx`
- `v3/apps/web/src/routes/InspectionPage.tsx`
- `v3/apps/web/src/routes/AdminSchedulePage.tsx`
- `v3/apps/web/src/routes/AdminPropertiesPage.tsx`
- `v3/apps/web/src/routes/AdminTemplatesPage.tsx`
- `v3/apps/web/src/index.css`

## Technical Notes For Designers
- React + Vite + Tailwind v4
- route-level lazy loading is already in place
- main web chunk is under bundle budget
- app has PWA/offline support
- browser routing is SPA-based

Designers can propose:
- updated tokens
- spacing system refinements
- revised shell/navigation
- stronger card systems
- reworked hierarchy
- improved motion
- layout changes

Designers should avoid depending on:
- new backend features
- changed permission rules
- changed completion logic
- hidden offline/replay states

## Seeded Internal Test Data
There are now seeded `[TEST PILOT]` properties available in the dev environment for walkthroughs and mockups.

These are useful for:
- various property sizes
- dispatch states
- schedule testing
- checklist walkthroughs

## Suggested Deliverables From Design Team
- app-wide visual direction proposal
- updated type/color/spacing tokens
- revised shell and navigation
- redesigned `My Schedule`
- redesigned `Inspection Page`
- redesigned `Admin Schedule`
- component guidance for cards, pills, badges, buttons, inputs, drawers, and status treatments
- mobile-specific behavior notes

## Success Criteria
The redesign is successful if:
- the app feels materially more modern and intentional
- workers can move faster with less confusion
- admins can scan and manage operations more confidently
- sync and conflict states are clearer, not softer
- the shipped workflow still behaves exactly the same
