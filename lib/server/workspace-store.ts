import { Pool } from "pg";
import { sortThreads, type WorkspaceThread } from "@/lib/workspace";

declare global {
  // eslint-disable-next-line no-var
  var __schliemannWorkspacePool: Pool | undefined;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!global.__schliemannWorkspacePool) {
    global.__schliemannWorkspacePool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  return global.__schliemannWorkspacePool;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureWorkspaceTable() {
  const pool = getPool();

  if (!pool) {
    return null;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schliemann_threads (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);

  return pool;
}

export async function listStoredThreads() {
  const pool = await ensureWorkspaceTable();

  if (!pool) {
    return [] as WorkspaceThread[];
  }

  const result = await pool.query<{ payload: WorkspaceThread }>(
    `
      SELECT payload
      FROM schliemann_threads
      ORDER BY updated_at DESC
    `
  );

  return sortThreads(result.rows.map((row) => row.payload));
}

export async function saveThread(thread: WorkspaceThread) {
  const pool = await ensureWorkspaceTable();

  if (!pool) {
    return false;
  }

  await pool.query(
    `
      INSERT INTO schliemann_threads (id, payload, updated_at)
      VALUES ($1, $2::jsonb, $3::timestamptz)
      ON CONFLICT (id)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at
    `,
    [thread.id, JSON.stringify(thread), thread.updatedAt]
  );

  return true;
}

export async function removeThread(threadId: string) {
  const pool = await ensureWorkspaceTable();

  if (!pool) {
    return false;
  }

  await pool.query(`DELETE FROM schliemann_threads WHERE id = $1`, [threadId]);
  return true;
}
