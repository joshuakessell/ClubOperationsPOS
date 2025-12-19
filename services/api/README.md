# Club Operations API

Fastify-based REST API server with WebSocket support and PostgreSQL database.

## Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker** and **Docker Compose** (for local database)

## Quick Start

### 1. Start the Database

```bash
# Start PostgreSQL in Docker
pnpm db:start

# Verify it's running
docker ps
```

This starts a PostgreSQL 16 container with:
- **Host**: localhost
- **Port**: 5432
- **Database**: club_operations
- **User**: clubops
- **Password**: clubops_dev

### 2. Run Migrations

```bash
# Apply all pending migrations
pnpm db:migrate

# Check migration status
pnpm db:migrate:status
```

### 3. Start the API Server

```bash
# Development mode (with hot reload)
pnpm dev

# Production mode
pnpm build
pnpm start
```

The API server will be available at:
- **REST API**: http://localhost:3001
- **WebSocket**: ws://localhost:3001/ws
- **Health Check**: http://localhost:3001/health

## Database Commands

| Command | Description |
|---------|-------------|
| `pnpm db:start` | Start PostgreSQL container |
| `pnpm db:stop` | Stop PostgreSQL container |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:migrate:status` | Show migration status |
| `pnpm db:migrate:rollback` | Rollback last migration record |
| `pnpm db:reset` | Reset database (destroys all data) |

## Environment Variables

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | API server port |
| `HOST` | 0.0.0.0 | API server host |
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | club_operations | Database name |
| `DB_USER` | clubops | Database user |
| `DB_PASSWORD` | clubops_dev | Database password |
| `DB_SSL` | false | Enable SSL for database |
| `DB_POOL_MAX` | 20 | Max connections in pool |
| `DB_LOG_QUERIES` | false | Log all database queries |

## Database Schema

The following tables are created by migrations:

### Core Tables

- **members** - Club member records
- **rooms** - Room inventory with status tracking
- **lockers** - Locker inventory
- **sessions** - Check-in sessions linking members to rooms/lockers

### Supporting Tables

- **key_tags** - QR/NFC tags linked to rooms
- **cleaning_batches** - Batch cleaning operations
- **cleaning_batch_rooms** - Rooms in each cleaning batch
- **audit_log** - Comprehensive audit trail

### Enums

- `room_status`: DIRTY, CLEANING, CLEAN
- `room_type`: STANDARD, DELUXE, VIP, LOCKER
- `session_status`: ACTIVE, COMPLETED, CANCELLED
- `key_tag_type`: QR, NFC
- `audit_action`: CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSIGN, RELEASE, OVERRIDE, CHECK_IN, CHECK_OUT

## Creating New Migrations

Add new SQL files to the `migrations/` directory following the naming convention:

```
NNN_description.sql
```

Where `NNN` is a zero-padded sequence number (e.g., `009_add_staff_table.sql`).

Migrations are executed in alphabetical order and tracked in the `schema_migrations` table.

## Development

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Connecting from Other Services

Use the database connection module:

```typescript
import { initializeDatabase, query, transaction } from './db/index.js';

// Initialize on startup
await initializeDatabase();

// Simple query
const result = await query('SELECT * FROM rooms WHERE status = $1', ['CLEAN']);

// Transaction
await transaction(async (client) => {
  await client.query('UPDATE rooms SET status = $1 WHERE id = $2', ['CLEANING', roomId]);
  await client.query('INSERT INTO audit_log ...', [...]);
});
```

## Troubleshooting

### Cannot connect to database

1. Ensure Docker is running: `docker ps`
2. Check if the container is up: `docker compose ps`
3. View container logs: `docker compose logs postgres`
4. Restart the database: `pnpm db:stop && pnpm db:start`

### Migration failed

1. Check the error message for SQL syntax issues
2. View current status: `pnpm db:migrate:status`
3. If needed, reset the database: `pnpm db:reset` (⚠️ destroys all data)
4. Re-run migrations: `pnpm db:migrate`

### Port 5432 already in use

Another PostgreSQL instance may be running. Either:
- Stop the other instance, or
- Change the port in `docker-compose.yml` and `DB_PORT` environment variable



