# UI Migration Plan

This document provides a comprehensive inventory of current UI technology usage across all apps and outlines the migration strategy to a unified Tailwind-based UI system.

## Current UI Tech Inventory

### customer-kiosk (Portrait iPad)

**Legacy UI CSS Imports (removed):**
- Previously imported legacy UI CSS in `main.tsx` during migration (now removed)

**Legacy liquid-* classes:**
- 30+ occurrences across 9 source files
- Main files: `SelectionScreen.tsx` (12), `AgreementScreen.tsx` (7), `styles.css` (10)

**Local styles.css:**
- Present: `apps/customer-kiosk/src/styles.css`
- Contains Liquid Glass component styles

**Inline Styles:**
- ~55 files with inline `style=` attributes (estimated)

**HTML Theme:**
- `theme-dark` and `effect-frosted` classes in `index.html`
- `liquid-distortion` SVG filter in `index.html`

**MUI Usage:**
- None

---

### employee-register (Landscape iPad)

**Legacy UI CSS Imports (removed):**
- Previously imported legacy UI CSS in `main.tsx` during migration (now removed)

**Legacy liquid-* classes:**
- 300+ occurrences across 40+ source files
- Largest concentration: `AppRoot.tsx` (49 occurrences, 4177 lines - needs splitting)
- Heavy usage in modals, drawers, and register components

**Local styles.css:**
- Present: `apps/employee-register/src/styles.css`
- Contains extensive Liquid Glass component styles

**Inline Styles:**
- ~55 files with inline `style=` attributes (estimated)

**HTML Theme:**
- `theme-dark` and `effect-frosted` classes in `index.html`
- `liquid-distortion` SVG filter in `index.html`

**MUI Usage:**
- None

**Special Notes:**
- `AppRoot.tsx` is 4177 lines - violates "No Components in AppRoot" rule
- Needs to be split into views/components

---

### office-dashboard (Desktop Web)

**Legacy UI CSS Imports (removed):**
- Previously imported legacy UI CSS in `main.tsx` during migration (now removed)

**Legacy liquid-* classes:**
- 80+ occurrences across 11 source files
- Main files: `StaffManagement.tsx` (26), `AdminView.tsx` (17), `WaitlistManagementView.tsx` (16)

**Local styles.css:**
- Present: `apps/office-dashboard/src/styles.css`
- Contains Liquid Glass component styles

**Inline Styles:**
- ~55 files with inline `style=` attributes (estimated)

**HTML Theme:**
- `theme-dark` and `effect-frosted` classes in `index.html`
- `liquid-distortion` SVG filter in `index.html`

**MUI Usage:**
- **4 occurrences in 2 files:**
  - `App.tsx` (2 imports)
  - `LockScreen.tsx` (2 imports)
- Must be removed as part of migration

---

### cleaning-station-kiosk (Staff Kiosk)

**Legacy UI CSS Imports (removed):**
- Previously imported legacy UI CSS in `main.tsx` during migration (now removed)

**Legacy liquid-* classes:**
- Minimal usage (not in top offenders list)

**Local styles.css:**
- Present: `apps/cleaning-station-kiosk/src/styles.css`

**Inline Styles:**
- ~55 files with inline `style=` attributes (estimated)

**HTML Theme:**
- `theme-dark` and `effect-frosted` classes in `index.html`
- `liquid-distortion` SVG filter in `index.html`

**MUI Usage:**
- None

---

### checkout-kiosk (Customer Checkout)

**Legacy UI CSS Imports (removed):**
- Previously imported legacy UI CSS in `main.tsx` during migration (now removed)

**Legacy liquid-* classes:**
- 5+ occurrences in `App.tsx` and `styles.css`

**Local styles.css:**
- Present: `apps/checkout-kiosk/src/styles.css`

**Inline Styles:**
- ~55 files with inline `style=` attributes (estimated)

**HTML Theme:**
- `theme-dark` and `effect-frosted` classes in `index.html`
- `liquid-distortion` SVG filter in `index.html`

**MUI Usage:**
- None

---

### packages/ui (Shared Package)

**Current State:**
- Exports legacy keypad / PIN components (removed)
- Contains legacy liquid CSS (removed)
- Deep import paths exposed for legacy styles (removed)

**Target State:**
- Replace Liquid Glass components with Tailwind-based primitives
- Remove `liquid-glass.css`
- Remove deep import paths from exports
- Add Tailwind preset for "Application UI" theme
- Add shared primitives: Button, Card, Modal, Input, Select, Badge, Table shell

---

## Target UI System Summary

### Tailwind UI "Application UI" Theme

**Design Principles:**
- Neutral page backgrounds
- Clean "panel/card" surfaces
- Consistent border radius, shadows, and focus rings
- Consistent typography scale
- Consistent form field styling

**Implementation:**
- Shared Tailwind preset exported from `packages/ui`
- Tailwind config extends the preset in each app
- CSS variables for theming (if needed) via Tailwind theme configuration

### packages/ui Primitives

**Core Components to Build:**
1. **Button** - Variants: `primary`, `secondary`, `accent`, `text`; Sizes: `kiosk`, `touch`, `md`
2. **Card** - Container for content with consistent padding/shadow
3. **Modal** - 0-3 actions, backdrop, focus trap
4. **Input** - Text input with consistent styling
5. **Select** - Dropdown with consistent styling
6. **Badge** - Status indicators
7. **Table** - Table shell with consistent styling
8. **PIN Input / Keypad** - Touch-optimized number input primitives

**Component Structure:**
- All components in `packages/ui/src/components/`
- Exported from `packages/ui/src/index.ts`
- Built with Tailwind classes
- Support size variants for device contexts

### App-Local Wrappers

**Purpose:**
- Set default sizes/variants per app context
- Thin wrappers that re-export primitives with defaults

**Location:**
- `apps/<app>/src/ui/*` (e.g., `apps/customer-kiosk/src/ui/Button.tsx`)

**Example:**
```tsx
// apps/customer-kiosk/src/ui/Button.tsx
import { Button as BaseButton } from '@club-ops/ui';
export const Button = (props) => <BaseButton size="kiosk" {...props} />;
```

**Device Context Defaults:**
- **customer-kiosk**: `size="kiosk"` (largest touch targets)
- **employee-register / cleaning / checkout**: `size="touch"` (touch-first)
- **office-dashboard**: `size="md"` (standard desktop)

---

## Migration Order (Recommended)

### Phase 1: packages/ui Primitives + Tailwind Preset

**Goal:** Build the foundation before migrating apps.

**Tasks:**
1. Create Tailwind preset in `packages/ui` (tailwind-preset.js)
2. Build core primitives:
   - Button (with size variants)
   - Card
   - Modal (0-3 actions)
   - Input
   - Select
   - Badge
3. Build touch primitives:
   - PIN Input (replace legacy PIN input)
   - Keypad/Numpad (replace legacy keypad)
4. Export preset: `@club-ops/ui/tailwind-preset`
5. Update `packages/ui/src/index.ts` to export new components
6. Remove Liquid Glass components (or mark as deprecated)
7. Remove `liquid-glass.css` from exports

**Acceptance:**
- All apps can import new primitives from `@club-ops/ui`
- Tailwind preset can be extended in app configs
- No breaking changes to existing apps yet

---

### Phase 2: office-dashboard (Remove MUI)

**Goal:** Remove MUI dependency and migrate to Tailwind primitives.

**Why First:**
- Smallest app (fewer files)
- Only app with MUI (must remove external dependency)
- Desktop context is simplest (no touch targets)

**Tasks:**
1. Remove MUI imports from `App.tsx` and `LockScreen.tsx`
2. Replace MUI components with `@club-ops/ui` primitives
3. Remove legacy liquid classes (80+ occurrences)
4. Replace with Tailwind classes using preset
5. Update `index.html` to remove `theme-dark`, `effect-frosted`, `liquid-distortion`
6. Remove deep style imports from `main.tsx`
7. Migrate `styles.css` to Tailwind or remove if unused
8. Test all views: AdminView, CustomerAdminToolsView, DemoOverview, etc.

**Acceptance:**
- No MUI imports remain
- No legacy liquid classes
- All styling via Tailwind + preset
- Visual parity maintained

---

### Phase 3: employee-register (Modals + PIN Input + Split AppRoot)

**Goal:** Migrate the most complex app, including splitting the massive AppRoot.

**Why Third:**
- Largest app with most Liquid Glass usage (300+ occurrences)
- AppRoot.tsx is 4177 lines (violates "No Components in AppRoot" rule)
- Many modals need migration
- PIN input needs replacement

**Tasks:**
1. **Split AppRoot.tsx:**
   - Extract views to `src/views/*`
   - Extract components to `src/components/*`
   - Keep AppRoot as orchestrator only (<300 lines target)
2. **Replace PIN Input:**
   - Remove legacy PIN input usage
   - Use new `@club-ops/ui` PIN Input primitive
3. **Migrate Modals:**
   - Replace legacy liquid classes with Tailwind
   - Use `@club-ops/ui` Modal primitive where applicable
   - Migrate: OfferUpgradeModal, CheckoutVerificationModal, all register modals
4. **Migrate Other Components:**
   - RegisterHeader, RegisterTopActionsBar
   - Drawers, Toasts, Popovers
5. **Update HTML:**
   - Remove `theme-dark`, `effect-frosted`, `liquid-distortion` from `index.html`
6. **Remove Deep Imports:**
   - Remove from `main.tsx`
7. **Migrate styles.css:**
   - Convert to Tailwind or remove

**Acceptance:**
- AppRoot.tsx < 300 lines
- No legacy liquid classes
- All modals use Tailwind
- PIN input uses new primitive
- Visual parity maintained

---

### Phase 4: cleaning-station-kiosk + checkout-kiosk

**Goal:** Migrate smaller kiosk apps.

**Why Fourth:**
- Smaller scope than employee-register
- Similar patterns (touch-first)
- Can be done in parallel

**Tasks (per app):**
1. Remove legacy liquid classes
2. Replace with Tailwind classes
3. Update `index.html` (remove theme classes and SVG filter)
4. Remove deep style imports from `main.tsx`
5. Migrate or remove `styles.css`
6. Use `@club-ops/ui` primitives where applicable

**Acceptance:**
- No legacy liquid classes
- All styling via Tailwind
- Visual parity maintained

---

### Phase 5: customer-kiosk (Cards/Buttons Only; Keep It Simple)

**Goal:** Migrate the customer-facing kiosk with simplified UI.

**Why Last:**
- Customer-facing (needs extra testing)
- Should be simple (mostly Cards + Buttons per AGENTS.md)
- Can leverage learnings from other apps

**Tasks:**
1. Replace legacy liquid classes with Tailwind
2. Use `@club-ops/ui` Card and Button primitives
3. Simplify screens (SelectionScreen, AgreementScreen, etc.)
4. Update `index.html` (remove theme classes and SVG filter)
5. Remove deep style imports from `main.tsx`
6. Migrate or remove `styles.css`

**Acceptance:**
- No legacy liquid classes
- Simple UI using Cards + Buttons
- All styling via Tailwind
- Visual parity maintained

---

## Migration Metrics

**Current State (from ui:guardrails):**
- Total violations: 507 across 70 files
- Liquid Glass classes: 486 occurrences
- Deep style imports: 17 occurrences
- HTML theme classes: 10 occurrences (5 files)
- HTML SVG filters: 5 occurrences (5 files)
- MUI imports: 4 occurrences (2 files)

**Target State:**
- 0 violations
- All styling via Tailwind + preset
- All components from `@club-ops/ui`
- No deep imports
- No Liquid Glass
- No MUI

---

## Post-Migration

1. **Update ui:guardrails.mjs:**
   - Switch from WARN mode to ERROR mode
   - Script should fail CI if violations found

2. **Documentation:**
   - Update AGENTS.md if needed
   - Document component usage patterns
   - Document Tailwind preset customization

3. **Cleanup:**
   - Remove `liquid-glass.css` from packages/ui
   - Remove Liquid Glass components (or keep as deprecated)
   - Remove deep import paths from package.json exports

---

## Notes

- Migration should be done incrementally (one app at a time)
- Maintain visual parity during migration
- Test thoroughly on target devices (iPad for kiosks, desktop for dashboard)
- Keep migration PRs focused and reviewable
- Update this document as migration progresses
