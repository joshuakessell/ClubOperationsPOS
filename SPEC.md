# Club Operations POS - Technical Specification

## Overview

This system manages club operations including member check-ins, room assignments, locker allocations, cleaning workflows, and staff metrics tracking.

---

## Applications

### Customer Kiosk (`apps/customer-kiosk`)

**Purpose**: Tablet-based self-service kiosk for member check-ins.

**Features**:
- Logo-only idle screen until session is created
- ID scan to display customer name
- Membership card scanning (QR/NFC) to display membership number
- Conditional Gym Locker option for grandfathered memberships only
- Real-time room availability display
- Room type selection (Standard, Deluxe, VIP)
- Locker assignment confirmation

**Flow**:
1. **Idle State**: Displays logo only, waiting for employee register to create session
2. **After ID Scan**: Customer name appears (via SESSION_UPDATED WebSocket event)
3. **After Membership Scan**: Membership number appears (via SESSION_UPDATED WebSocket event)
4. **Rental Options**: Displays available rental options including Gym Locker if eligible

**Technical Requirements**:
- Locked single-app experience (no browser navigation)
- WebSocket connection for live inventory updates and session events
- Listens for SESSION_UPDATED events to update UI state
- Offline-capable with sync on reconnection
- Touch-optimized UI (minimum 44px touch targets)

### Employee Register (`apps/employee-register`)

**Purpose**: Staff-facing tablet application for session management.

**Features**:
- Barcode scanner input capture for ID and membership scans
- Member lookup and check-in processing
- Room assignment with real-time availability
- Locker assignment and key tracking
- Session countdown timers
- Integration with Square POS (external)

**Technical Requirements**:
- Split-screen compatible (runs alongside Square)
- Captures barcode scanner input (keyboard wedge mode)
- Sends ID scans to `/sessions/scan-id` endpoint
- Sends membership scans to `/sessions/scan-membership` endpoint
- Batch operations for efficiency
- Quick-action shortcuts for common tasks
- Real-time inventory synchronization

### Office Dashboard (`apps/office-dashboard`)

**Purpose**: Administrative web application for oversight and management.

**Features**:
- Global view of all rooms and lockers
- Staff activity monitoring
- Waitlist management
- Override capabilities with audit logging
- Metrics and analytics dashboards
- Cleaning workflow management

**Technical Requirements**:
- Desktop-optimized responsive design
- Role-based access control
- Audit trail for all override actions
- Export capabilities for reporting

---

## API Service (`services/api`)

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/rooms` | List all rooms |
| GET | `/rooms/:id` | Get room details |
| PATCH | `/rooms/:id/status` | Update room status |
| POST | `/rooms/batch-status` | Batch status update |
| GET | `/inventory` | Get inventory summary |
| GET | `/lockers` | List all lockers |
| POST | `/sessions` | Create check-in session |
| POST | `/sessions/scan-id` | Scan ID to create/update session with customer name |
| POST | `/sessions/scan-membership` | Scan membership to update session with membership number |
| GET | `/sessions/active` | List active sessions |

### WebSocket Events

**Server → Client**:
- `ROOM_STATUS_CHANGED` - Room status transition
- `INVENTORY_UPDATED` - Inventory counts changed
- `ROOM_ASSIGNED` - Room assigned to member
- `ROOM_RELEASED` - Room released from session
- `SESSION_UPDATED` - Session created or updated (contains customer_name, membership_number, allowed_rentals)

**Client → Server**:
- `subscribe` - Subscribe to specific event types
- `unsubscribe` - Unsubscribe from events

---

## Shared Package (`packages/shared`)

### Enums

```typescript
enum RoomStatus {
  DIRTY = 'DIRTY',
  CLEANING = 'CLEANING',
  CLEAN = 'CLEAN'
}

enum RoomType {
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  VIP = 'VIP',
  LOCKER = 'LOCKER'
}
```

### Transition Rules

Valid transitions without override:
- `DIRTY` → `CLEANING`
- `CLEANING` → `CLEAN`
- `CLEANING` → `DIRTY` (rollback)
- `CLEAN` → `CLEANING`
- `CLEAN` → `DIRTY`

Invalid transitions (require override):
- `DIRTY` → `CLEAN` (skips cleaning step)

All overrides must include:
- Reason for override
- Staff member ID
- Timestamp

---

## Data Models

### Room

```typescript
interface Room {
  id: string;
  number: string;
  type: RoomType;
  status: RoomStatus;
  floor: number;
  lastStatusChange: Date;
  assignedTo?: string;
  overrideFlag: boolean;
}
```

### Session

```typescript
interface Session {
  id: string;
  memberId: string;
  memberName: string;
  membershipNumber?: string;
  roomId?: string;
  lockerId?: string;
  checkInTime: Date;
  expectedDuration: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  allowedRentals: string[]; // e.g., ['STANDARD', 'DELUXE', 'VIP', 'GYM_LOCKER']
}
```

### Session Updated Event

```typescript
interface SessionUpdatedPayload {
  sessionId: string;
  customerName: string;
  membershipNumber?: string;
  allowedRentals: string[];
}
```

### Inventory Summary

```typescript
interface InventorySummary {
  clean: number;
  cleaning: number;
  dirty: number;
  total: number;
}
```

---

## Cleaning Station Logic

### Batch Scanning

Staff can scan multiple room key tags in sequence:

1. Scan room tags (QR or NFC)
2. System determines primary action based on scanned statuses
3. If all same status → single action button
4. If mixed statuses → resolution UI required

### Resolution UI

When mixed statuses are scanned:

- Display per-room status sliders
- Each slider shows: DIRTY / CLEANING / CLEAN
- Only adjacent transitions allowed without override
- Override requires confirmation modal with reason

---

## Metrics & Analytics

### Tracked Metrics

| Metric | Description |
|--------|-------------|
| Response Time | DIRTY → CLEANING transition time |
| Cleaning Duration | CLEANING → CLEAN transition time |
| Rooms Per Shift | Count by staff member |
| Batch Efficiency | Rooms cleaned per batch |

### Exclusions

Records excluded from metrics:
- Rooms with `overrideFlag: true`
- Transitions with anomalous timestamps (<30s or >4h)
- Test/training accounts

---

## Security Considerations

### Authentication

- JWT-based authentication
- Refresh token rotation
- Session timeout: 8 hours (staff), 30 minutes (kiosk idle)

### Authorization

| Role | Capabilities |
|------|--------------|
| Kiosk | Read-only room availability |
| Staff | Check-in/out, room/locker assignment |
| Manager | Override capabilities, staff management |
| Admin | Full system access, audit logs |

### Audit Logging

All state-changing operations logged:
- Timestamp
- User ID and role
- Action type
- Previous and new values
- Override reason (if applicable)

---

## Database Schema (Postgres)

### Tables

- `rooms` - Room inventory
- `lockers` - Locker inventory
- `members` - Member records
- `sessions` - Check-in sessions
- `room_status_history` - Status transition audit
- `overrides` - Override records
- `staff` - Staff accounts

### Concurrency

- Row-level locking for room assignments
- Optimistic locking with version columns
- Transaction isolation: SERIALIZABLE for bookings

---

## Development Roadmap

### Phase 1 (Current)
- [x] Monorepo scaffold
- [x] Shared types and validation
- [x] API skeleton with health check
- [x] WebSocket infrastructure
- [x] App scaffolds with placeholder UIs

### Phase 2
- [ ] Database integration
- [ ] Room CRUD operations
- [ ] Basic check-in flow
- [ ] Real-time inventory updates

### Phase 3
- [ ] Cleaning station workflow
- [ ] Batch operations
- [ ] Override system with audit

### Phase 4
- [ ] Metrics dashboard
- [ ] Staff management
- [ ] Reporting and exports
