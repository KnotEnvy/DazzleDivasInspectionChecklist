# Next Iteration Prompt

Continue the Dazzle Divas v3 build in `D:\Javascript Webapps\DazzleDivasInspectionChecklist`.

Start by reading:
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\HANDOFF_TEST_PLAN.md`
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\BENCHMARK_MATRIX.md`

Then inspect the current implementation before changing anything, especially:
- `v3/apps/web/src/routes/AdminPropertiesPage.tsx`
- `v3/apps/web/src/routes/AdminTemplatesPage.tsx`
- `v3/apps/web/src/routes/InspectionPage.tsx`
- `v3/apps/web/src/routes/MySchedulePage.tsx`
- `v3/apps/web/src/routes/AdminSchedulePage.tsx`
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
- Checklist template management is shipped at `/admin/templates`.
- Property-derived checklist generation from bedroom/bathroom counts is shipped.
- Property checklist preview is shipped.
- Room-by-room checklist execution is shipped with tasks, photos, notes, room completion, and checklist completion.
- Open self-signup still exists and should be treated as a production blocker.
- Per-property checklist overrides are not shipped yet.
- Offline replay is not shipped yet.
- `/my-schedule` still needs stronger worker execution flow.

## Priority For This Iteration

1. Strengthen `/my-schedule` as the primary worker operating screen.
2. Add assignee-safe worker job status controls (`IN_PROGRESS`, `BLOCKED`) for the assigned user only.
3. Make start/resume checklist the default action for workers from schedule/job UI.
4. Preserve the existing rule that `COMPLETED` should stay tied to checklist completion.
5. Keep the UX mobile-first and room-first, using `old_pics/` as visual reference for field workflow quality.

Do not jump to Breezeway-style expansion yet unless the worker assignment/execution flow is solid first.

## Implementation Expectations

- Make code changes directly.
- Do not stop at analysis.
- Verify with Convex codegen if needed, backend typecheck, web typecheck, and production web build.
- Keep role/permission checks enforced in backend mutations.
- Do not revert unrelated user changes.

If you find a blocker or ambiguity, resolve it from the codebase and handoff docs rather than asking unless absolutely necessary.

## End Deliverable

End with:
- what changed
- what was verified
- the next highest-value task after this slice
