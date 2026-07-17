# Dazzle Divas v3

Updated: July 17, 2026

## Status
`v3` is the active production app for Dazzle Divas field operations and back-office management.

This codebase now supports live daily operations across scheduling, checklist execution, completed-work review, and the first production finance workflow. Treat it like business infrastructure with real production data, not as a sandbox for broad rewrites.

## Production Summary
Currently live and actively used:
- admin staffing, property, template, schedule, and disposable-job management
- cleaner and inspector checklist execution
- proof photo capture and room-level notes
- admin completed-checklist review and photo saving/export
- 90-day backend photo retention with monthly storage cleanup
- offline queueing and replay for field work
- invite-based staff onboarding
- admin finance tracking for payroll, revenue, and job-level finance review

July 16 feedback batch (deployed to Convex production and Cloudflare Pages):
- untouched started checklists can be stopped safely and restarted later; stopping is blocked after any task, note, issue, room, or photo is marked
- dispatch controls support a primary assignee plus additional team members that admins can add or remove
- admin notifications now surface job starts and completions from a header notification center
- inactive, unused staff accounts can be permanently deleted through indexed reference checks; accounts with operational/history references remain protected without scanning entire production tables
- jobs do not become overdue until after 4:00 PM on their scheduled day
- payroll payee details can collapse and payroll can be reviewed across previous Thursday-to-Wednesday weeks or calendar months
- the admin Week Ahead chart filters the operations panel by day, and the worker seven-day schedule no longer stretches short days to match busier days
- Daily Spark is visible to admins and field staff and uses a completely new 100-message rotation

Earlier production improvements that matter:
- quick-add turnover supports B2B jobs, default 10:00 AM starts, automatic 4-hour windows, cleaner multi-assignment, and a two-step create confirmation
- checklist start rules now block future jobs until the due date and only allow starts beginning at 7:00 AM local property time
- cleaners can have up to 3 active checklists and inspectors up to 5
- Android workers now get a camera-targeted capture flow instead of being pushed into gallery-only behavior
- room completion now advances to the next room in list order without auto-expanding it
- history cards show the cleaner name for finished work
- finance now includes property-level revenue settings, cleaner pay profiles, job financial review/approval, revenue views, payroll views, and Thursday-through-Wednesday weekly payroll grouping
- photo retention now removes photos older than 90 days; a July 16, 2026 cleanup removed all remaining pre-May photos (1,840 photos / about 542 MB) with no failures

Current emphasis:
- keep production stable while improving workflows from real cleaner/admin feedback
- tighten admin throughput and reduce small sources of friction
- improve field confidence on mobile capture, progress, and completion flows
- keep finance accurate, understandable, and easy for admins to operate
- maintain rollout discipline across separate Cloudflare and Convex deploys
- keep Convex photo storage, bandwidth, and plan pressure under active review

## Stack
- Web: React 19 + Vite 6 + Tailwind 4 + React Router 7
- Backend: Convex functions + Convex Auth + Convex storage
- Runtime/package manager: Bun workspaces
- Shared package: `@dazzle/shared`

## Photo Retention And Capacity
- Proof photos are retained for 90 days.
- Convex runs the monthly purge on the 1st at `06:00 UTC` from `packages/backend/convex/crons.ts`.
- Retention code lives in `packages/backend/convex/photoRetention.ts`, `packages/backend/convex/photoRetentionBatches.ts`, `packages/backend/convex/photoRetentionAdmin.ts`, and `packages/backend/convex/lib/photoRetention.ts`.
- The purge deletes Convex storage objects and matching `photos` rows, then recomputes room photo counts without reopening completed rooms.
- The manual purge action is guarded by `PHOTO_RETENTION_PURGE_TOKEN`; only set that env var temporarily for an intentional production cleanup and remove it immediately after the run.
- Last manual production cleanup: July 16, 2026, cutoff `2026-05-01T04:00:00.000Z` (midnight Eastern), deleted 1,840 photos / 542,414,995 bytes across 751 room inspections, `0` failures, `incomplete: false`.

## Repo Layout
```text
v3/
  apps/
    web/
  packages/
    backend/
    shared/
  scripts/
```

## Active Docs
- [FINAL_TEAM_HANDOFF.md](./FINAL_TEAM_HANDOFF.md)
- [NEXT_TEAM_HANDOFF.md](./NEXT_TEAM_HANDOFF.md)
- [README.md](./README.md)

Older rollout, setup, and checkpoint docs live in `archive/` for reference only.

## Guardrails
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Do not break completed-history integrity.
- Do not break offline queue/replay behavior.
- Do not casually change auth, env wiring, or redirect behavior.
- Do not assume a frontend deploy also updated Convex production.
- The July 16 feedback batch required a coordinated Convex and Cloudflare rollout; both sides were deployed on July 16, 2026.
- Treat Convex plan-limit and bandwidth warnings as operational issues.
- Do not leave `PHOTO_RETENTION_PURGE_TOKEN` set after a manual purge.
- Prefer narrow, additive changes over rewrites.

## Local Setup
```bash
cd v3
bun install
bun run dev
```

If you need to run pieces separately:

```bash
bun run dev:backend
bun run dev:web
```

## Verification
Use these before shipping meaningful changes:

```bash
bun run test
bun run typecheck
bun run typecheck:backend
bun run build:web
```

For rollout smoke coverage:

```bash
bun run smoke:rollout
```
