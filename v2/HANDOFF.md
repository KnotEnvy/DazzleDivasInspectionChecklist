# Dazzle Divas v2 — Handoff

## What This Is

Rebuild of a Next.js 15 / Prisma / SQLite cleaning inspection app into a Convex + React/Vite + Rust microservices monorepo. The v1 source lives at `../dazzle-divas-inspection/`.

## Stack

- **Backend**: Convex (serverless DB + functions + file storage + auth)
- **Frontend**: React 19 + Vite 6 + Tailwind CSS v4 + React Router 7
- **Auth**: `@convex-dev/auth` with Password provider
- **Monorepo**: Bun workspaces + Turborepo
- **Rust services**: Axum (image-compressor, pdf-generator) — scaffolded, not yet integrated

## Running It

```bash
# Terminal 1 — backend
cd v2/packages/backend
npx convex dev

# Terminal 2 — frontend
cd v2/packages/web
bun dev
```

Convex URL is in `packages/web/.env.local` (`VITE_CONVEX_URL`).
Convex deployment is in `packages/backend/.env.local` (`CONVEX_DEPLOYMENT`).

## Seed Data

After first deploy, run in the backend dir:

```bash
npx convex run seed:seedRoomsAndTasks
npx convex run seed:seedProperties
```

Then sign up via the UI. To make yourself admin, go to the Convex dashboard → `users` table → change `role` to `"ADMIN"`.

Default seed creates 8 rooms (Backyard, Bathroom 1, Bedroom 1, Entrance, General, Kitchen, Living Room, Washer/Dryer) with 23 tasks, and 4 demo properties.

## Architecture

```
v2/
  packages/
    shared/         # @dazzle/shared — TS types, constants (PREDEFINED_ROOMS, enums), utils
    backend/        # Convex functions + schema
      convex/
        schema.ts           # 9 tables + authTables
        auth.ts             # Password provider with custom profile (role, isActive)
        auth.config.ts
        http.ts
        users.ts            # getMe, list, listInspectors, update
        properties.ts       # CRUD
        propertyAssignments.ts  # assign/unassign inspector↔property
        rooms.ts            # Room+task template CRUD
        inspections.ts      # create (spawns roomInspections+taskResults from templates), listActive/Completed, complete
        roomInspections.ts  # getById (with tasks+photos), updateNotes, complete (enforces 2-photo min)
        taskResults.ts      # toggle, setCompleted
        photos.ts           # generateUploadUrl, save, listByRoomInspection (enriches URLs), remove, markCompressed
        admin.ts            # stats query
        seed.ts             # seedRoomsAndTasks, seedProperties (internal mutations)
        lib/
          permissions.ts    # requireAuth (checks isActive), requireAdmin
          validators.ts     # Reusable v.union validators
    web/            # React SPA
      src/
        main.tsx            # ConvexAuthProvider + BrowserRouter + Toaster
        App.tsx             # All routes wired up
        hooks/useCurrentUser.ts
        router/AuthGuard.tsx, AdminGuard.tsx
        components/
          ui/       # Button, Input, Select, Card, Badge, Spinner, Modal, EmptyState
          layout/   # RootLayout, TopBar, Sidebar (desktop), MobileNav (bottom tabs)
          auth/     # LoginForm (signIn/signUp flow toggle)
          dashboard/# AdminDashboard (stat cards + recent inspections), InspectorDashboard (active + assigned)
          users/    # UserList, UserEditModal
          properties/ # PropertyList, PropertyForm, PropertyAssignments
          rooms/    # TaskChecklist (toggle with real-time mutation)
          common/   # ProgressBar, StatusBadge, PhotoUploadArea, PhotoGrid, PhotoViewer
        pages/      # 10 pages, all functional — no placeholders
    rust-services/  # Cargo workspace — scaffolded, not integrated
      image-compressor/   # POST /compress — resizes to 1920x1080, JPEG q80
      pdf-generator/      # POST /generate — placeholder response
      shared/             # API key validation
```

## Schema (key relationships)

```
users ←──── propertyAssignments ────→ properties
users ←──── inspections ────→ properties
               │
               └── roomInspections (1 per room template) ──→ rooms
                      │
                      ├── taskResults (1 per task template) ──→ tasks
                      └── photos (stored in Convex _storage)
```

Denormalized fields: `inspections.propertyName/inspectorName`, `roomInspections.roomName`, `taskResults.taskDescription`. These are set at creation time from templates.

## Convex aliases in the web app

The web package can't directly import from `packages/backend/convex/_generated/` without help. This is solved via a Vite alias in `packages/web/vite.config.ts`:

```ts
"convex/_generated": path.resolve(__dirname, "../backend/convex/_generated")
```

All web code imports as `import { api } from "convex/_generated/api"`.

## What's Done (Phases 1–4 + partial 6)

| Area | Status |
|------|--------|
| Monorepo + tooling | Done |
| Shared types/constants | Done |
| Convex schema + auth + all functions | Done |
| Login (signIn/signUp with Password) | Done |
| Admin dashboard (stat cards, recent inspections) | Done |
| Inspector dashboard (active inspections, assigned properties) | Done |
| User management (list, edit role/active) | Done |
| Property CRUD + activate/deactivate | Done |
| Property ↔ inspector assignment | Done |
| Room/task template management | Done |
| New inspection (select property → creates rooms+tasks from templates) | Done |
| Inspection detail (room list with per-room progress bars) | Done |
| Room inspection (task checklist, notes, photo upload/grid/viewer, complete) | Done |
| Photo upload to Convex storage (camera capture + file picker) | Done |
| Photo viewer (fullscreen lightbox, keyboard nav) | Done |
| History page (completed inspections list) | Done |
| Route guards (AuthGuard, AdminGuard) | Done |
| Responsive layout (sidebar desktop, bottom nav mobile) | Done |

## Role Evolution: Three User Types

The system currently has two roles (`ADMIN`, `INSPECTOR`) but the business actually has **three distinct user types**:

| Role | Who | What they do |
|------|-----|-------------|
| **CLEANER** | Field staff | Cleans properties, fills out the **cleaning checklist**, takes before/after photos proving work was done |
| **INSPECTOR** | QA staff | Visits after cleaning, fills out the **inspection checklist** (different tasks, different photo requirements), flags issues |
| **ADMIN** | Office staff | Manages users, properties, assignments, reviews reports, dashboard |

**Current state:** The checklist and photo requirements built today are the **cleaner's** workflow. The inspector checklist and its specific tasks/photo expectations have not been designed or built yet.

**What needs to happen:**
- Add `CLEANER` to the `role` union in `schema.ts` and the auth profile
- Room/task templates need a `checklistType` field (or separate template sets) so cleaners and inspectors see different task lists for the same room
- Photo requirements may differ per role (e.g., cleaners need before/after pairs, inspectors need issue documentation)
- The `inspections` table may need a `type` field (`"CLEANING" | "INSPECTION"`) to distinguish the two workflows
- Route guards and dashboards need a third role path (`CleanerGuard`, cleaner-specific dashboard)
- Consider whether cleaners and inspectors are assigned to the same properties independently, or whether an inspection is always triggered after a cleaning

This is a significant schema and workflow expansion — plan it before coding.

## Reference: Original Architecture Vision

The file `../implementation_plan.md` (at the repo root) contains the original migration plan written before this rebuild started. Key points from it that are still relevant for future phases:

- **Flutter mobile app** — the long-term plan includes a native mobile app for field staff (cleaners/inspectors) using Flutter + Convex Dart client + local DB (Isar/SQLite) for true offline-first capability. The current web app is the stepping stone.
- **Push notifications** — Firebase Cloud Messaging for alerting cleaners of new assignments or schedule changes.
- **Load testing target** — simulate 50 concurrent field users uploading photos to validate the Rust image pipeline.
- **Offline verification** — the gold standard test is: open app → airplane mode → complete full inspection with photos → reconnect → verify admin dashboard updates correctly.

The original plan assumed a web admin + Flutter mobile split. We chose web-first for both roles to ship faster, with Flutter as a future phase.

## What's Remaining

### Phase 5: Rust Service Integration
- Wire up image compression: after photo upload, Convex action fetches original → POSTs to Rust `/compress` → uploads compressed → calls `photos.markCompressed`
- Wire up PDF generation: Convex action collects inspection data → POSTs to Rust `/generate` → returns PDF
- Add CSV/Excel export via Convex actions
- Build ExportControls and ReportViewer components
- Deploy Rust services (Fly.io) with API key auth

### Phase 6: Offline + Polish
- Service worker + IndexedDB queue for offline task/photo operations
- Sync-on-reconnect logic (reference: `../dazzle-divas-inspection/src/lib/offline-storage.ts`)
- Loading skeletons on all query-dependent views
- Transition animations
- Empty state illustrations
- Brand color polish / dark mode consideration
- Mobile touch target sizing audit

### Phase 7: Testing + Launch
- `convex-test` unit tests for all mutations (especially permission checks)
- Data migration script: SQLite (v1 Prisma) → Convex
- Security audit: ensure every mutation calls requireAuth/requireAdmin
- Deploy: Convex production, web to Vercel/Cloudflare, Rust to Fly.io
- Environment variable management for production

## Gotchas

1. **Convex types are generated** — they only exist after `npx convex dev` runs at least once. If you see import errors for `convex/_generated/*`, run the backend first.
2. **Photo minimum** — `roomInspections.complete` throws if < 2 photos. The UI disables the button, but the backend enforces it too.
3. **Auth profile** — the `role` field in `auth.ts` profile must be `"ADMIN" as const` or `"INSPECTOR" as const` (not bare `string`) to match the schema union type.
4. **Seed users** — there's no seed mutation for users because Convex Auth manages user creation. Sign up via the UI, then flip `role` in the dashboard.
5. **Tailwind v4** — uses `@import "tailwindcss"` and `@theme {}` syntax, not the v3 config file approach. Custom colors are defined in `src/index.css`.
6. **Two roles today, three tomorrow** — the schema currently has `ADMIN | INSPECTOR`. Adding `CLEANER` touches: `schema.ts` (role union), `auth.ts` (profile), `validators.ts`, `permissions.ts` (new `requireCleaner`?), route guards, sidebar nav, and dashboard components. Read the "Role Evolution" section above before making this change.
