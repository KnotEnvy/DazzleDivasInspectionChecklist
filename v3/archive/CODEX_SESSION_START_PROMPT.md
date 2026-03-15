Continue the Dazzle Divas v3 build in `D:\Javascript Webapps\DazzleDivasInspectionChecklist`.

Start by reading:
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\NEXT_ITERATION_PROMPT.md`
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\HANDOFF_TEST_PLAN.md`
- `D:\Javascript Webapps\DazzleDivasInspectionChecklist\v3\BENCHMARK_MATRIX.md`

Current reality to assume:
- Core property management, staffing, service plans, generated jobs, worker schedule, dispatch, checklist execution, offline queue/replay, dispatch month view, and task-level issue capture are already shipped.
- Root Vitest coverage exists and should be preserved/expanded.
- `COMPLETED` must remain tied to checklist completion.
- The next priority is deployment readiness and field rollout hardening, not broad new feature expansion.

Your first job:
1. Read the handoff docs and inspect the current codebase state.
2. Identify the highest-value remaining rollout blockers.
3. Implement the next best slice directly, prioritizing:
   - replay conflict policy + recovery flow
   - deployment/field smoke validation
   - any missing hardening around issue capture/history/report persistence
4. Verify with:
   - Convex codegen when needed
   - `bun run test`
   - `bun run typecheck`
   - `bun run typecheck:backend`
   - `bun run build:web`

Important constraints:
- Do not stop at analysis.
- Do not revert unrelated user changes.
- Keep backend permission checks enforced.
- Keep the existing offline queue/replay model coherent.
- Keep changes focused on shipping for real cleaner use and gathering feedback fast.
