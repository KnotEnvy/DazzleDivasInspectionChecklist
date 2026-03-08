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
- `v3/packages/backend/convex/lib/checklistTemplates.ts`
- `v3/packages/backend/convex/inspections.ts`
- `v3/packages/backend/convex/templates.ts`
- `v3/packages/backend/convex/servicePlans.ts`
- `v3/packages/backend/convex/scheduling.ts`
- `v3/packages/backend/convex/jobs.ts`
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
- Checklist template management is shipped at `/admin/templates`.
- Property-derived checklist generation from bedroom/bathroom counts is shipped.
- Property checklist preview is shipped.
- Per-property checklist overrides are shipped.
- Room-by-room checklist execution is shipped with tasks, photos, notes, room completion, and checklist completion.
- `/my-schedule` is shipped as the primary worker operating screen with start/resume checklist as the default action.
- Assignee-safe worker job status controls (`IN_PROGRESS`, `BLOCKED`) are shipped.
- Open self-signup is disabled and `/login` is now staff-only.
- Offline replay is not shipped yet.
- Inspection creation now uses the effective property checklist library (override or base).

## Priority For This Iteration

1. Expand offline outbox + replay for field execution.
2. Add replay conflict policy + diagnostics UI.
3. Add dispatch polish on `/schedule` (month view, faster staffing/reassignment flow).
4. Add tests around schedule generation, property overrides, and job/checklist lifecycle.
5. Preserve the existing rule that `COMPLETED` should stay tied to checklist completion.

Do not jump to broader Breezeway-style expansion yet unless offline reliability and replay are solid first.

## Implementation Expectations

- Make code changes directly.
- Do not stop at analysis.
- Verify with Convex codegen if needed, backend typecheck, web typecheck, and production web build.
- Keep role/permission checks enforced in backend mutations.
- Do not revert unrelated user changes.

- If you find a blocker or ambiguity, resolve it from the codebase and handoff docs rather than asking unless absolutely necessary.

