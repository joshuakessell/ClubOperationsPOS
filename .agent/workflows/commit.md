---
description: Commit and push changes (runs lint + typecheck first, seeds local DB)
---
// turbo-all
1. Run lint:
   ```bash
   cd /Users/joshuakessell/Projects/ClubOperationsPOS && pnpm -r run lint
   ```

2. Run typecheck:
   ```bash
   cd /Users/joshuakessell/Projects/ClubOperationsPOS && pnpm -r run typecheck
   ```

3. If lint or typecheck fail, fix the issues before proceeding. Do NOT commit with errors.

4. Run database migrations and seed the local demo database:
   ```bash
   cd /Users/joshuakessell/Projects/ClubOperationsPOS && DB_HOST=localhost DB_PORT=5433 DB_PASSWORD=club-ops-dev pnpm --filter @club-ops/api run db:migrate
   ```
   Then seed:
   ```bash
   cd /Users/joshuakessell/Projects/ClubOperationsPOS && DB_HOST=localhost DB_PORT=5433 DB_PASSWORD=club-ops-dev pnpm --filter @club-ops/api run seed:all
   ```
   Note: This requires the local Postgres container (`club-ops-demo-db`) to be running on port 5433.
   If migrate fails due to a snapshot-restored DB, the `ensureBaselineRecorded` fix should handle it automatically.
   If the database is not running, skip this step and warn the user.

5. Stage, commit, and push the changes. Use a conventional commit message.
