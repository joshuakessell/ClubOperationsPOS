# Codex Agent Instructions

This repository contains a multi-application system for managing club check-ins,
room inventory, cleaning workflows, and operational metrics.

Codex must follow the rules below strictly.

---

## Project Architecture

### Applications
- apps/customer-kiosk
  - Tablet-based kiosk UI
  - Locked single-app experience
  - Displays customer name, membership number, room options
  - Receives realtime inventory updates
  - Handles agreement signing and rental selection

- apps/employee-register
  - Employee-facing tablet app
  - Runs alongside Square POS
  - Creates sessions and assigns rooms/lockers
  - Displays live inventory and countdowns
  - Handles check-in processing, renewals, and checkout verification

- apps/cleaning-station-kiosk
  - Staff-facing tablet for cleaning workflow
  - Batch scanning of QR or NFC room key tags
  - Updates room status (DIRTY → CLEANING → CLEAN)
  - Handles mixed-status scans with resolution UI
  - Supports override transitions with audit logging

- apps/checkout-kiosk
  - Customer-facing tablet for self-service checkout
  - QR code scanning of room keys
  - Checklist for items returned (TV remote, etc.)
  - Displays late fees and checkout completion status
  - WebSocket integration for real-time updates

- apps/office-dashboard
  - Web app for office PC
  - Global view of rooms, lockers, waitlists, and staff activity
  - Used for overrides and administration
  - Metrics and analytics dashboards

### Backend
- services/api
  - Server-authoritative REST API
  - WebSocket realtime updates
  - Postgres database
  - All state transitions are validated server-side

### Shared Code
- packages/shared
  - Enums, schemas, validators
  - Room status state machine
  - Transition guards

---

## Core Rules (Must Not Be Violated)

1. **The server is the single source of truth**
   - Clients never assume inventory or state
   - All decisions are confirmed by the API

2. **Room status transitions are enforced**
   - Normal flow: DIRTY → CLEANING → CLEAN
   - Skipping steps requires explicit override
   - Overrides must be logged and audited

3. **Overrides exclude metrics**
   - Any room updated via override must be flagged
   - Excluded rooms must not affect performance metrics or competitions

4. **Concurrency must be safe**
   - Room reservations and cleaning updates must be transactional
   - No double booking
   - Use row locking or equivalent mechanisms

5. **Realtime is push-based**
   - Inventory changes are broadcast via WebSockets
   - No polling-based UI refreshes

---

## Cleaning Station Logic

- Batch scanning of QR or NFC key tags is supported
- The primary action button is auto-determined by scanned room statuses
- Mixed-status scans require resolution UI
- Resolution UI:
  - Shows per-room sliders: DIRTY / CLEANING / CLEAN
  - Only adjacent transitions allowed without override
  - Override requires confirmation and reason

---

## Metrics & Analytics

Track, but do not manipulate:
- Dirty → cleaning response time
- Cleaning duration
- Rooms cleaned per shift
- Batch cleaning allocation

Do not include overridden or anomalous records in metrics.

---

## Coding Standards

- TypeScript everywhere
- Strict typing enabled
- Zod or equivalent for request validation
- OpenAPI documentation for REST endpoints
- Deterministic, testable logic for state transitions

---

## Commands

Use these commands when working in the repo:

- Install dependencies:
  pnpm install

- Start development:
  pnpm dev

- Run tests:
  pnpm test

- Lint:
  pnpm lint

- Typecheck:
  pnpm typecheck

---

## What Codex Should Ask Before Major Changes

- Does this affect room state transitions?
- Does this introduce a new override path?
- Does this change metrics calculations?

If yes, Codex must explain the impact before implementing.

---

End of instructions.
