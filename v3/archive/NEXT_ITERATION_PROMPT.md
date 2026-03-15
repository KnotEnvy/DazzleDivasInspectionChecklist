# Next Iteration Prompt

Continue the Dazzle Divas v3 build in `D:\Javascript Webapps\DazzleDivasInspectionChecklist`.

Start by reading:
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\HANDOFF_TEST_PLAN.md`
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\BENCHMARK_MATRIX.md`

These are some of the more important modules we are working with:
- `v3/apps/web/src/routes/AdminPropertiesPage.tsx`
- `v3/apps/web/src/components/PropertyChecklistOverridesSection.tsx`
- `v3/apps/web/src/routes/AdminTemplatesPage.tsx`
- `v3/apps/web/src/routes/InspectionPage.tsx`
- `v3/apps/web/src/routes/MySchedulePage.tsx`
- `v3/apps/web/src/routes/AdminSchedulePage.tsx`
- `v3/apps/web/src/lib/offlineOutbox.ts`
- `v3/apps/web/src/lib/offlineReplay.ts`
- `v3/apps/web/src/lib/offlineInspectionState.ts`
- `v3/packages/backend/convex/lib/checklistTemplates.ts`
- `v3/packages/backend/convex/lib/jobLifecycle.ts`
- `v3/packages/backend/convex/inspections.ts`
- `v3/packages/backend/convex/templates.ts`
- `v3/packages/backend/convex/servicePlans.ts`
- `v3/packages/backend/convex/scheduling.ts`
- `v3/packages/backend/convex/jobs.ts`
- `v3/packages/backend/convex/taskResults.ts`
- `v3/packages/backend/convex/schema.ts`

## Current State To Assume

- Admin user creation is shipped.
- Property management is shipped.
- Service plans and generated jobs are shipped.
- Default assignee per service plan is shipped.
- Manual turnover job creation is shipped on `/schedule`.
- Turnover-intake metadata is shipped on manual jobs and schedule UI.
- Unassigned-job dispatch flow is shipped.
- Dispatch can assign any active cleaner/inspector with the required role.
- `/schedule` month, week, and day views are shipped.
- `/schedule` now supports faster admin staffing flow:
  - quick assignment from the unassigned queue
  - save-all dispatch changes from the drawer
- Checklist template management is shipped at `/admin/templates`.
- Property-derived checklist generation from bedroom/bathroom counts is shipped.
- Property checklist preview is shipped.
- Per-property checklist overrides are shipped.
- Room-by-room checklist execution is shipped with tasks, photos, notes, room completion, and checklist completion.
- Task-level issue capture is shipped:
  - flag issue on a task
  - save issue notes
  - issue counts appear in checklist/history surfaces
- `/my-schedule` is shipped as the primary worker operating screen with start/resume checklist as the default action.
- Assignee-safe worker job status controls (`IN_PROGRESS`, `BLOCKED`) are shipped.
- Open self-signup is disabled and `/login` is now staff-only.
- Offline outbox + replay is partially shipped for field execution:
  - checklist starts
  - task completion toggles
  - task issue flags/notes
  - room notes
  - photo uploads/removals
  - room completion
  - checklist completion
  - worker job status changes
- Replay diagnostics UI is shipped on dashboard/checklist/schedule surfaces.
- Inspection creation now uses the effective property checklist library (override or base).
- Root Vitest harness is shipped with initial coverage for:
  - checklist derivation
  - scheduling recurrence rules
  - job/checklist lifecycle guards
  - offline replay classification
  - offline inspection overlay state

## Priority For This Iteration

1. Finish deployment readiness and field rollout hardening.
2. Tighten replay conflict policy and recovery flow.
   - be explicit about server-owned schedule fields vs client-owned field evidence
   - improve operator handling of `CONFLICT` items beyond simple surfacing
3. Add final operational smoke coverage around:
   - issue capture persistence in history/report output
   - job/checklist lifecycle regressions
   - replay conflict and recovery behavior
4. Polish mobile execution only where it reduces tap count or confusion for real cleaners.
5. Preserve the existing rule that `COMPLETED` stays tied to checklist completion.

Do not jump to broader Breezeway-style expansion yet unless deployment readiness and real field feedback are covered first.

## Implementation Expectations

- Make code changes directly.
- Do not stop at analysis.
- Verify with Convex codegen when schema/function surfaces change, plus backend typecheck, web typecheck, tests, and production web build.
- Keep role/permission checks enforced in backend mutations.
- Keep offline behavior explicit; do not silently weaken conflict handling to make errors disappear.
- Do not revert unrelated user changes.

- If you find a blocker or ambiguity, resolve it from the codebase and handoff docs rather than asking unless absolutely necessary.
