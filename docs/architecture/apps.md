## App folder conventions

This repo is a multi-app monorepo. To keep navigation predictable, each app should follow the same high-level structure under `apps/<app>/src/`.

### Standard directories

- **`src/app/`**: App bootstrap and composition.
  - Providers, global error boundaries, routing/wiring, app root shell.
- **`src/features/<feature>/`**: Feature modules grouped by domain.
  - Feature-level UI, state, hooks, and any feature-specific “views”.
  - Prefer co-locating feature components + helpers here rather than spreading across `src/components`.
- **`src/components/`**: Shared presentational components used across multiple features in the same app.
  - Avoid feature/domain naming here (put that in `src/features/*` instead).
- **`src/lib/`**: Non-React utilities and clients.
  - API clients, WebSocket helpers, storage helpers, parsing/formatting helpers.
  - If it’s reusable across apps, prefer a workspace package (e.g. `packages/app-kit`).
- **`src/ui/`**: Thin app wrappers around `@club-ops/ui`.
  - Set app defaults (sizes, padding, className conventions) without re-implementing behavior.

### Placement rules of thumb

- **Domain-first**: If code is clearly part of one domain (register, inventory, upgrades), it belongs in `src/features/<domain>/`.
- **Shared UI**: If it’s reused across multiple features, move it to `src/components/` (but keep it presentational).
- **No big inline style objects**: Prefer Tailwind utilities and small CSS files for truly app-specific styling.

### Example (employee-register)

- `src/features/register/` contains the register flow components and views.
- `src/features/inventory/` contains inventory drawer + selector logic.
- `src/features/upgrades/` contains upgrades drawer content.

