# Dazzle Divas v3

Updated: April 1, 2026

## Status
v3 is the active production app for Dazzle Divas field operations.

The app is now in daily use across active staff accounts. This repository should be treated as a live production codebase with real operational data, not as a rebuild sandbox.

## Production Summary
Currently live and working:
- admin staffing, property, template, schedule, and disposable-job management
- cleaner and inspector checklist execution
- issue notes and proof photo capture
- admin completed-checklist review
- photo save/download flows, including iPhone-sized exports
- offline queueing and replay
- invite-based staff onboarding

Recent production improvements that matter:
- quick-add turnover now supports B2B jobs, default 10:00 AM starts, auto 4-hour windows, cleaner multi-assignment, and a two-step create confirmation
- admin dispatch now allows assigning the same cleaner to multiple overlapping jobs while still enforcing one active checklist at a time
- the `users:listActiveStaff` production crash was fixed by hardening staff hydration against brittle data
- the mobile photo/offline sync path was hardened so retryable upload failures do not get trapped as false conflicts and conflicted local photos stay visible to the worker

Current emphasis:
- fix live production bugs from real field usage
- improve dispatch/admin throughput without changing workflow shape casually
- improve mobile checklist and photo confidence on real phones
- keep production deployment/configuration reliable
- reduce Convex bandwidth and plan pressure before it affects field operations

## Stack
- Web: React 19 + Vite 6 + Tailwind 4 + React Router 7
- Backend: Convex functions + Convex Auth + Convex storage
- Runtime/package manager: Bun workspaces
- Shared package: `@dazzle/shared`

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

Older rollout, setup, and checkpoint docs have been moved to `archive/` for local reference only.

## Guardrails
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Do not break completed-history integrity.
- Do not break offline queue/replay behavior.
- Do not make auth/env changes casually.
- Do not assume a frontend deploy also updated Convex production.
- Treat Convex plan-limit and bandwidth warnings as operational issues, not backlog trivia.

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

