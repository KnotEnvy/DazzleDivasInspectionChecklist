# Current Open Items

Updated: April 1, 2026

## Purpose
This file is the active, short-horizon backlog for the next team.
Use it together with `README.md`, `FINAL_TEAM_HANDOFF.md`, and `NEXT_TEAM_HANDOFF.md`.

This is not a speculative product wishlist.
These items come from real production usage, recent incidents, and current operator friction.

## How To Use This File
- Treat this as the current execution queue, not a long-term roadmap.
- Reproduce the issue on a real device or in the live workflow before changing code.
- Prefer narrow fixes over redesigns.
- Confirm whether each item needs frontend deploy, Convex deploy, or both.
- Re-check Convex usage before shipping anything that increases photo traffic or query volume.

## Priority 1: Mobile Photo Confidence
These are the highest-risk field items because they directly affect checklist completion confidence.

### 1. Stronger direct-upload confidence UI
Problem:
Workers can still feel uncertain during background upload before the server-backed photo card appears.

Desired outcome:
- Make recently captured photos feel obviously retained
- Reduce the chance that a worker thinks a photo vanished
- Keep the UI understandable even when connectivity is unstable

Likely files:
- `apps/web/src/routes/InspectionPage.tsx`
- `apps/web/src/components/InspectionRoomPanel.tsx`
- `apps/web/src/lib/offlineInspectionState.ts`

Validation:
- Capture several photos quickly on a real phone
- Test with stable connectivity and with weak/flapping connectivity
- Confirm the worker can always tell whether the photo is uploaded, queued, or needs attention

### 2. Clearer queue vs conflict explanations for cleaners
Problem:
The difference between queued work and conflicted work is still not obvious to non-technical users.

Desired outcome:
- Cleaner wording in the app shell and checklist sync surfaces
- Obvious next step when a photo or checklist action needs manual review
- Less confusion when counts appear at the top of the app

Likely files:
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/OfflineQueuePanel.tsx`
- `apps/web/src/lib/offlineReplay.ts`

Validation:
- Trigger a queued photo case and a conflict case intentionally
- Confirm a non-technical user can explain what action they should take next

## Priority 2: Dispatch And Same-Day Operations
These are high-leverage admin improvements surfaced by real scheduling use.

### 3. Stronger B2B visibility across schedule surfaces
Problem:
B2B jobs are now supported, but the visual emphasis may still be lighter than ideal in some admin views.

Desired outcome:
- B2B jobs stand out immediately in dispatch and worker schedule views
- The 4:00 PM deadline is obvious without opening details
- Same-day urgency is harder to miss during assignment

Likely files:
- `apps/web/src/routes/AdminSchedulePage.tsx`
- `apps/web/src/routes/MySchedulePage.tsx`
- `apps/web/src/routes/DashboardPage.tsx`

Validation:
- Create multiple same-day jobs, including at least one B2B
- Confirm admins and workers can identify the B2B job instantly on mobile and desktop

### 4. Faster dispatch assignment ergonomics
Problem:
The overlap rules are fixed for cleaners, but dispatch speed is still a UX opportunity when admins are assigning many jobs quickly.

Desired outcome:
- Fewer taps to assign repeat cleaners
- Better visual confirmation after assignment
- Lower risk of admin hesitation around same-time cleaner jobs

Likely files:
- `apps/web/src/routes/AdminSchedulePage.tsx`
- `packages/backend/convex/jobs.ts`

Validation:
- Assign several 10:00 AM jobs to the same cleaner from the unassigned queue
- Confirm no overlap error occurs for cleaner jobs
- Confirm inspectors still keep overlap protection where intended

## Priority 3: Admin Safety And Throughput
These are smaller but useful production-facing enhancements.

### 5. More safeguards against accidental admin actions
Problem:
The quick-add turnover flow now has a two-step confirmation, but similar accidental-tap risks may still exist elsewhere.

Desired outcome:
- Add confirmation only where mistakes are expensive
- Avoid adding unnecessary friction to routine actions
- Preserve operator speed while reducing cleanup work

Likely files:
- `apps/web/src/routes/AdminSchedulePage.tsx`
- any other admin mutation entry point surfaced by user feedback

Validation:
- Confirm common actions stay fast
- Confirm high-cost mistakes are harder to trigger accidentally

### 6. Admin roster and staff-state clarity
Problem:
The `users:listActiveStaff` crash is fixed, but roster/state clarity should remain a watch area because all accounts are now active in production.

Desired outcome:
- Make admin staff state easy to trust
- Keep roster views resilient to bad or partial user data
- Avoid future production crashes from brittle assumptions

Likely files:
- `packages/backend/convex/users.ts`
- `apps/web/src/routes/AdminPage.tsx`
- `apps/web/src/routes/AdminSchedulePage.tsx`

Validation:
- Confirm admin staff lists load cleanly in production-like data conditions
- Confirm inactive, active, and invite-related states remain understandable

## Priority 4: Operational Follow-Through
These are not optional if usage keeps growing.

### 7. Convex usage review and plan decision
Problem:
Production has already warned about Free plan limits.

Desired outcome:
- Understand real bandwidth, storage, and function pressure
- Decide whether optimization or plan change is the right next move
- Prevent capacity from becoming the next outage source

Validation:
- Review the Convex dashboard before any photo-heavy or query-heavy release
- Record the current operational recommendation for the next team

### 8. Real-device mobile regression pass
Problem:
Several major bugs only showed up on phones during real field use.

Desired outcome:
- Create a repeatable short mobile smoke pass
- Catch photo, queue, and schedule regressions before production users do

Minimum smoke pass:
- sign in on a real phone
- open assigned job
- capture multiple photos rapidly
- simulate weak connectivity if possible
- complete a room after uploads settle
- confirm queue/conflict messaging remains understandable

## Notable Things Already Fixed
Do not spend time rediscovering these before checking the current code:
- B2B quick-add turnover support
- default 10:00 AM starts and auto 4-hour turnover windows
- overlapping cleaner dispatch assignment
- one-active-checklist-at-a-time enforcement
- two-step turnover creation confirmation
- `users:listActiveStaff` production crash
- mobile photo sync regression where retryable failures turned into false conflicts and photos appeared to vanish

## Recommended Execution Order
1. Mobile photo confidence polish
2. Queue vs conflict messaging clarity
3. Stronger B2B visibility
4. Faster dispatch assignment ergonomics
5. Admin safety polish
6. Capacity review and mobile regression checklist formalization
