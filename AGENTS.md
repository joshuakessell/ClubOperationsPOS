# Club Operations POS — Agent Instructions

This repository is a pnpm + TypeScript monorepo containing multiple Vite+React applications and a Fastify API. The system manages club check-ins, renewals/upgrades, room/locker inventory, cleaning workflows, checkout verification, staff management, and metrics.

This file defines **non-negotiable engineering and UI system rules** for all agent work in this repo.

---

## Source of Truth (Must Be Followed)

All agent work MUST adhere to:

- `SPEC.md` — canonical product behavior and business rules
- `openapi.yaml` — API contract target
- `docs/database/DATABASE_SOURCE_OF_TRUTH.md` and `docs/database/DATABASE_ENTITY_DETAILS.md` — canonical DB meaning/contract
- `db/schema.sql` — schema snapshot (must match migrations and canonical DB contract)

If implementation conflicts with these files, the agent MUST either:
1) fix the implementation to match the specs, OR
2) propose a spec change with clear justification and explicit diffs and wait for approval before changing behavior.

---

## Command Execution Requirements

**CRITICAL: Do NOT use `sudo` for `pnpm`/Node commands.**

- Use a bash shell for commands whenever possible.
- Never run `pnpm`, `node`, or dev scripts as root.
- If you hit permission issues, fix ownership/permissions and reinstall dependencies as a normal user.

---

## Monorepo Architecture (Current)

### Applications (`apps/*`)

- `apps/customer-kiosk` — portrait iPad kiosk UI (touch-first)
- `apps/employee-register` — landscape iPad UI (touch-first)
- `apps/cleaning-station-kiosk` — staff kiosk UI (touch-first)
- `apps/checkout-kiosk` — customer checkout kiosk UI (touch-first)
- `apps/office-dashboard` — desktop web app (mouse/keyboard-first)

### Backend (`services/api`)
- Fastify REST + WebSocket server
- Postgres DB (migrations in `services/api/migrations`)
- Server-authoritative state, locking/transactions for assignments and transitions

### Shared Packages (`packages/*`)
- `packages/shared` — canonical types/enums/zod schemas/shared rules
- `packages/ui` — **single shared UI system** (components + Tailwind preset + app telemetry)

---

## Core Behavioral Rules (Must Not Be Violated)

1) **Server is the single source of truth**
   - Clients never assume inventory validity, eligibility, pricing, or transitions.
   - All critical operations must be confirmed by API.

2) **Concurrency must be safe**
   - Assignments and transitions must use transactional locking to prevent double-booking.

3) **Room status transitions are enforced**
   - Normal flow: DIRTY → CLEANING → CLEAN → OCCUPIED → DIRTY (at checkout)
   - Overrides must be logged, staff-attributed, and excluded from metrics.

4) **Realtime is push-based**
   - WebSockets broadcast events; do not rely on polling for correctness.

5) **Authentication is mandatory**
   - Employee apps require staff auth (WebAuthn preferred, PIN fallback).
   - Reauth rules must match SPEC.

6) **Square is external**
   - Payment collection is in Square; this system records intents/quotes and manual “mark paid”.

---

## UI System — Non-Negotiable Rules

### Single UI Framework
The entire monorepo must use one unified UI system:

- **Tailwind CSS + Tailwind UI “Application UI” styling approach** as the canonical look & feel.
- Shared UI components must live in: **`packages/ui`**
- App-specific wrappers may live in: `apps/<app>/src/ui/*` (thin wrappers only).

**Forbidden (for new code)**
- Legacy Liquid Glass styling (legacy UI CSS deep imports, dark/frosted theme classes, SVG distortion filters)
- MUI/Emotion (`@mui/*`, `@emotion/*`)
- New bespoke CSS component frameworks
- Large per-component CSS files / CSS module sprawl
- Inline styles for layout/visual design (allowed only for truly dynamic numeric positioning when unavoidable)

### Theme & Design Consistency
A single “Application UI” theme must be consistently used across all eligible components:
- neutral page backgrounds
- clean “panel/card” surfaces
- consistent border radius, shadows, and focus rings
- consistent typography scale
- consistent form field styling

The theme must be implemented as:
- a shared Tailwind preset (exported from `packages/ui`), and
- shared primitives in `packages/ui` (Button, Card, Modal, Input, etc.)

### Device Context Rules (Sizing Defaults)
- **customer-kiosk (portrait iPad):** largest touch targets; simplified UI; mostly Cards + Buttons
- **employee-register / cleaning / checkout (landscape iPad):** touch-first sizing, spacing, and button heights
- **office-dashboard (desktop):** standard sizing; supports dense layouts and tables

All sizing differences must be handled via:
- component variants (e.g., Button size `kiosk|touch|md`)
- app-local wrappers that set defaults (e.g., `apps/customer-kiosk/src/ui/Button.tsx`)

### Shared vs App-Specific Components
**If a component is used in 2+ apps OR is a generic UI pattern, it MUST go in `packages/ui`.**
Examples:
- Button, Card, Modal (0–3 actions), Input, Select, Badge, Table shell
- PIN input / keypad primitives (touch use)
- standard EmptyState, LoadingState, ErrorState

**If a component is truly unique to one app**, it lives under:
- `apps/<app>/src/components/*` or `apps/<app>/src/views/*`
…but it must still be built from shared primitives and follow the unified theme.

### “No Components in AppRoot” Rule
AppRoot files are orchestrators only.
- No inline component definitions inside `AppRoot.tsx` (extract them).
- No giant JSX blocks: extract to `src/views/*` and `src/components/*`.
- Target: keep `AppRoot.tsx` small and readable.

---

## File Size & Code Organization Rules (Keep It Small)

Goal: keep files easy to review and reduce regressions.

- Prefer many small files over a few enormous ones.
- Avoid “god components” and “god route files”.
- Extract:
  - UI blocks → components
  - state machines / orchestration → hooks
  - duplicated logic → shared helpers

**Targets (guidelines, not hard limits):**
- UI component files: ~200–300 lines max
- View/page files: ~300–500 lines max
- AppRoot: ideally <300 lines
- Route files: split by domain/handlers once they become unwieldy

---

## Imports & Efficiency Rules

- Prefer **named exports** and **tree-shakeable** modules.
- Do NOT deep-import internals like:
  - `@club-ops/ui/src/...`
  - `@club-ops/shared/src/...`
- Only import from public entrypoints:
  - `@club-ops/ui`
  - `@club-ops/shared`
  - any explicitly exported subpaths (e.g., `@club-ops/ui/tailwind-preset` if added)

If an export is missing, add it to `packages/ui/src/index.ts` rather than deep importing.

App-local wrappers (`apps/<app>/src/ui/*`) must be thin:
- set default variants/sizes
- re-export primitives
- avoid complex logic

---

## Telemetry (Expected Behavior)

`packages/ui` provides telemetry utilities. Each app should install telemetry early in `main.tsx` and wrap the app in `TelemetryErrorBoundary`.

Telemetry must be verifiable in dev:
- if telemetry ingestion is best-effort, there must be at least one dev/admin pathway to confirm events are received (viewer endpoint or dashboard page).

---

## Quality Standards

- TypeScript everywhere, strict typing
- Zod validation for request bodies where applicable
- Maintain alignment with `openapi.yaml`
- Add tests for bug fixes and core business rules

---

## Commands (Repo Root)

- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Tests: `pnpm test`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`

---

## Pre-Change Checklist (High Risk Areas)

Before major changes, check whether it impacts:
- pricing rules / membership rules / time windows
- tier mapping (Standard/Double/Special) or numbering
- checkout late fee / ban logic
- concurrency/locking
- WebAuthn/PIN authentication/reauth rules

If yes: explain impact and add/adjust tests.

---
