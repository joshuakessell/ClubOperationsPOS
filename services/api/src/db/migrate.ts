import fs from 'node:fs';
import path from 'node:path';
import { getPool } from './index';

/**
 * Lightweight migration runner.
 *
 * On startup, it:
 * 1. Creates a `schema_migrations` tracking table (if not exists).
 * 2. Reads `.sql` files from the migrations directory (excluding `_archive/`).
 * 3. Extracts the "up" portion (everything before `-- down migration`).
 * 4. Applies any migrations not yet recorded, in filename order.
 *
 * Migrations are idempotent by convention (using IF NOT EXISTS / IF EXISTS).
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Ensure the tracking table exists.
 */
async function ensureTrackingTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename  TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Extract the "up" portion of a migration file.
 * Everything between `-- up migration` (or start of file) and `-- down migration`.
 */
function extractUpSql(content: string): string {
  // Find the up/down markers
  const downIdx = content.search(/^-- down migration/im);

  let upSql: string;
  if (downIdx !== -1) {
    upSql = content.substring(0, downIdx);
  } else {
    // No down marker — the entire file is the up migration
    upSql = content;
  }

  // Strip the leading `-- up migration` marker if present
  upSql = upSql.replace(/^-- up migration\s*/im, '');

  return upSql.trim();
}

/**
 * Run all pending migrations in order.
 * Returns the number of migrations applied.
 */
export async function runPendingMigrations(): Promise<number> {
  await ensureTrackingTable();

  const pool = getPool();

  // Get already-applied migrations
  const applied = await pool.query<{ filename: string }>(
    `SELECT filename FROM schema_migrations ORDER BY filename`
  );
  const appliedSet = new Set(applied.rows.map((r) => r.filename));

  // Read migration files (exclude _archive directory)
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[migrate] No migrations directory found, skipping.');
    return 0;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
    .sort(); // lexicographic sort = chronological for YYYYMMDD prefixes

  const pending = files.filter((f) => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log('[migrate] Schema is up to date.');
    return 0;
  }

  console.log(`[migrate] ${pending.length} pending migration(s) to apply...`);

  let count = 0;
  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const upSql = extractUpSql(content);

    if (!upSql) {
      console.log(`[migrate] Skipping empty migration: ${filename}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(upSql);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [filename]
      );
      await client.query('COMMIT');
      console.log(`[migrate] ✅ Applied: ${filename}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] ❌ Failed: ${filename}`, err);
      throw err; // fail fast — don't apply subsequent migrations
    } finally {
      client.release();
    }
  }

  console.log(`[migrate] Done. Applied ${count} migration(s).`);
  return count;
}
