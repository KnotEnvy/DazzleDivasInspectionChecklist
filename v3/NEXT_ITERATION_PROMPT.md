# Dazzle Divas v3 - Next Iteration Prompt

Updated: March 15, 2026

Continue the Dazzle Divas v3 build in `D:\Javascript Webapps\DazzleDivasInspectionChecklist`.

## Read First
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\HANDOFF_TEST_PLAN.md`
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\BENCHMARK_MATRIX.md`
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\FINALIZATION_DEPLOY_HANDOFF.md`

## Current Reality To Assume
- Core property management, templates, staffing, service plans, generated jobs, dispatch, worker schedule, checklist execution, issue capture, photo capture, offline queue/replay, and mobile cleaner UX are already shipped.
- Scheduling is working.
- Photo capture is working.
- The app is now close to production finalization.
- `COMPLETED` must remain tied to checklist completion.
- Root Vitest coverage exists and should be preserved or expanded.

## Main Remaining Product Feature
The last major app feature is admin-side completed checklist review with usable photo download/export.

Business reason:
- Admin uses cleaner photo evidence in Breezeway for client delivery.
- The app must support that daily operations workflow directly.

## Your First Job
1. Inspect the current history/report/completed-checklist code paths.
2. Identify the shortest production-viable slice that gives admins a strong completed-review workflow.
3. Implement the next best slice directly, prioritizing:
   - completed checklist admin review UX
   - photo evidence visibility
   - photo download/export workflow suitable for Breezeway upload
4. Keep deployment finalization in mind while you build.

## Constraints
- Do not stop at analysis.
- Do not revert unrelated user changes.
- Keep backend permission checks enforced.
- Keep offline queue/replay coherent.
- Keep changes focused on finalization, not broad feature expansion.

## Verification
Run as appropriate:
- Convex codegen when needed
- `bun run test`
- `bun run typecheck`
- `bun run typecheck:backend`
- `bun run build:web`
- `bun run smoke:rollout`

## After The Feature Slice
If the admin review/download slice is complete, the next work should shift to:
1. deployment hardening
2. production smoke validation
3. launch readiness documentation
