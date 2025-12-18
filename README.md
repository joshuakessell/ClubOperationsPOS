# Club Operations POS

A multi-application system for managing club check-ins, room inventory, cleaning workflows, and operational metrics.

## 🏗️ Architecture

```
club-operations-pos/
├── apps/
│   ├── customer-kiosk/      # Tablet-based kiosk UI for check-ins
│   ├── employee-register/   # Employee-facing tablet app (with Square POS)
│   └── office-dashboard/    # Web app for administration
├── services/
│   └── api/                 # Fastify REST API + WebSocket server
├── packages/
│   └── shared/              # Shared types, enums, validators
└── infra/                   # Infrastructure configs (placeholder)
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0

### Installation

```bash
# Install all dependencies
pnpm install
```

### Development

```bash
# Run API + all apps concurrently
pnpm dev
```

This starts:
- **API Server**: http://localhost:3001
- **Customer Kiosk**: http://localhost:5173
- **Employee Register**: http://localhost:5174
- **Office Dashboard**: http://localhost:5175

WebSocket endpoint: `ws://localhost:3001/ws`

### Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm format` | Format code with Prettier |

### Database Setup

The API uses PostgreSQL. For local development:

```bash
# Navigate to the API service
cd services/api

# Start PostgreSQL in Docker
pnpm db:start

# Run database migrations
pnpm db:migrate

# Check migration status
pnpm db:migrate:status
```

See [services/api/README.md](./services/api/README.md) for detailed database documentation.

## 📦 Packages

### `@club-ops/shared`

Shared code used across all apps and services:

- **Enums**: `RoomStatus`, `RoomType`
- **Transition validation**: `isAdjacentTransition()`, `validateTransition()`
- **Zod schemas**: Request/response validation
- **Types**: `Room`, `Locker`, `InventorySummary`, WebSocket events

### `@club-ops/api`

Fastify-based REST API server with WebSocket support:

- `GET /health` - Health check endpoint
- `ws://host:port/ws` - WebSocket for real-time updates

## 🔑 Core Rules

1. **Server is the single source of truth** - Clients never assume state
2. **Room status transitions are enforced** - DIRTY → CLEANING → CLEAN
3. **Overrides exclude metrics** - Flagged rooms don't affect analytics
4. **Concurrency is safe** - Transactional updates with row locking
5. **Realtime is push-based** - WebSocket broadcasts, no polling

See [AGENTS.md](./AGENTS.md) for complete coding guidelines.

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode (specific package)
pnpm --filter @club-ops/shared test:watch
```

## 📝 License

Private - Internal use only.

