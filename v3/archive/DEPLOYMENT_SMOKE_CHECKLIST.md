# Dazzle Divas v3 Deployment Smoke Checklist

Updated: March 9, 2026

## Goal
Run this after staging or production deploys to validate the rollout-critical field path before broader cleaner feedback.

## Automated Gate
Run this before the manual deploy smoke so the rollout-critical regressions fail fast:

```bash
bun run smoke:rollout
```

This covers the current automated rollout gates for:
- job/checklist lifecycle guards
- issue count and report persistence
- offline replay conflict classification
- offline checklist overlay behavior
- draft hydration for queued room/checklist notes after reload

## Preconditions
- Admin test account is active.
- Cleaner test account is active.
- At least one active property exists with:
  - checklist template coverage
  - bedroom/bathroom counts
  - service notes or access instructions
- At least one job is assigned to the cleaner for today.

## Admin Dispatch Smoke
1. Log in as admin.
2. Open `/schedule`.
3. Create a manual turnover job without an assignee.
4. Assign it from the unassigned queue.
5. Reschedule the job time in the drawer.
6. Confirm the job still appears in the correct month/week/day surfaces.
7. Confirm checklist launch is available from the drawer for checklist-supported job types.

Expected:
- No permission errors.
- Dispatch edits persist after refresh.
- Unassigned queue count updates correctly.

## Worker Schedule Smoke
1. Log in as the assigned cleaner.
2. Open `/my-schedule`.
3. Confirm the assigned job appears with property notes and access details.
4. Mark the job `IN_PROGRESS`.
5. Start the checklist from the schedule card.

Expected:
- Worker can only edit their own job status.
- Checklist opens or resumes from the linked job.
- Job does not move to `COMPLETED` yet.

## Checklist Evidence Smoke
1. Complete at least one task.
2. Flag an issue on one task and save an issue note.
3. Save room notes.
4. Upload at least the required room photos.
5. Complete the room.
6. Complete the checklist.
7. Open `/history`.
8. Open the completed checklist report.

Expected:
- Completed history row shows the issue count.
- Report output includes the flagged task and issue note.
- Linked job transitions to `COMPLETED` only after checklist completion.

## Offline Replay Smoke
1. Open a new in-progress checklist on a mobile device or in browser devtools offline mode.
2. Go offline.
3. Queue these actions:
   - task completion
   - task issue note
   - room notes
   - photo upload
4. Reconnect.
5. Confirm the outbox replays automatically.

Expected:
- Replay diagnostics show queued work draining.
- Synced items can be cleared from the queue panel.
- Evidence is present after refresh.

## Conflict Recovery Smoke
1. Queue a worker job status change or checklist action while offline.
2. Change the same underlying server state from another session before reconnecting.
3. Reconnect the original device.
4. Open the queue panel for the surface where the conflict appears.

Expected:
- The item lands in `CONFLICT`, not silent failure.
- The panel explains whether the item is server-owned schedule state or client-owned checklist evidence.
- `Review Live State` routes to `/my-schedule` for schedule conflicts or the checklist for evidence conflicts.
- Server-owned conflicts require manual refresh/reapply.
- Client-owned evidence conflicts can be retried or discarded intentionally.
