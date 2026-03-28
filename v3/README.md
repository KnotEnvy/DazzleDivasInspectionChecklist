# Dazzle Divas v3

Updated: March 28, 2026

## Status
v3 is the active production app for Dazzle Divas field operations.

The app is already being used for real field work. This repository should be treated as a live production codebase with real operational data, not as a rebuild sandbox.

## Production Summary
Currently live and working:
- admin staffing, property, template, schedule, and disposable-job management
- cleaner and inspector checklist execution
- issue notes and proof photo capture
- admin completed-checklist review
- photo save/download flows, including iPhone-sized exports
- offline queueing and replay
- invite-based staff onboarding

Current emphasis:
- fix live production bugs from field usage
- improve admin and mobile UX
- harden onboarding and status accuracy
- keep production deployment/configuration reliable
- reduce Convex bandwidth/plan pressure before it affects field operations

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
