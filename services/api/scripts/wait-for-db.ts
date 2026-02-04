import { Client, type ClientConfig } from 'pg';
import { loadDatabaseConfig } from '../src/db/index';
import { loadEnvFromDotEnvIfPresent } from '../src/env/loadEnv';

loadEnvFromDotEnvIfPresent();

const DEFAULT_CONFIG: ClientConfig = {
  host: 'localhost',
  port: 5432,
  // Keep defaults aligned with docker-compose.yml + local dev expectations.
  user: 'clubops',
  password: 'club-ops-dev',
  database: 'club_operations',
  connectionTimeoutMillis: parseConnectionTimeoutMillis(),
};

function resolveConfig(): ClientConfig {
  const hasDatabaseUrl = Boolean((process.env.DATABASE_URL ?? '').trim());
  const hasDbHost = Boolean((process.env.DB_HOST ?? '').trim());

  if (!hasDatabaseUrl && !hasDbHost) {
    return DEFAULT_CONFIG;
  }

  return loadDatabaseConfig();
}

function parseConnectionTimeoutMillis(): number {
  const raw = (process.env.DB_CONNECTION_TIMEOUT_MS ?? '').trim();
  if (!raw) return 5000;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 5000;
  return Math.floor(value);
}

const baseConfig = resolveConfig();

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDb() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = new Client({ ...baseConfig });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();

      console.log('Database is ready');
      process.exit(0);
    } catch (err) {
      await client.end().catch(() => {});
      console.log(`Waiting for database (${attempt}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.error('Database did not become ready in time');
  process.exit(1);
}

waitForDb();
