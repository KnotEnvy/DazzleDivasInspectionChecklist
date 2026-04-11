# Dazzle Divas v3

Updated: April 8, 2026

## Status
`v3` is the active production app for Dazzle Divas field operations and back-office management.

This codebase now supports live daily operations across scheduling, checklist execution, completed-work review, and the first production finance workflow. Treat it like business infrastructure with real production data, not as a sandbox for broad rewrites.

## Production Summary
Currently live and actively used:
- admin staffing, property, template, schedule, and disposable-job management
- cleaner and inspector checklist execution
- proof photo capture and room-level notes
- admin completed-checklist review and photo saving/export
- offline queueing and replay for field work
- invite-based staff onboarding
- admin finance tracking for payroll, revenue, and job-level finance review

Recent production improvements that matter:
- quick-add turnover supports B2B jobs, default 10:00 AM starts, automatic 4-hour windows, cleaner multi-assignment, and a two-step create confirmation
- checklist start rules now block future jobs until the due date and only allow starts beginning at 7:00 AM local property time
- cleaners can have up to 3 active checklists and inspectors up to 5
- Android workers now get a camera-targeted capture flow instead of being pushed into gallery-only behavior
- room completion now advances to the next room in list order without auto-expanding it
- history cards show the cleaner name for finished work
- finance now includes property-level revenue settings, cleaner pay profiles, job financial review/approval, revenue views, payroll views, and Thursday-through-Wednesday weekly payroll grouping

Current emphasis:
- keep production stable while improving workflows from real cleaner/admin feedback
- tighten admin throughput and reduce small sources of friction
- improve field confidence on mobile capture, progress, and completion flows
- keep finance accurate, understandable, and easy for admins to operate
- maintain rollout discipline across separate Cloudflare and Convex deploys
- reduce Convex bandwidth and plan pressure before it affects operations

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

Older rollout, setup, and checkpoint docs live in `archive/` for reference only.

## Guardrails
- Do not wipe production data.
- Do not delete templates unless explicitly requested.
- Do not break completed-history integrity.
- Do not break offline queue/replay behavior.
- Do not casually change auth, env wiring, or redirect behavior.
- Do not assume a frontend deploy also updated Convex production.
- Treat Convex plan-limit and bandwidth warnings as operational issues.
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
