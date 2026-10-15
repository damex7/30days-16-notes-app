// THE DATABASE CONNECTION. The only file that knows how to reach PostgreSQL.
// lib/notes.ts imports from here; pages and Server Actions never do.
//
// `server-only` makes importing this from a Client Component a BUILD ERROR,
// so DATABASE_URL (which contains the database password) can never be
// bundled into JavaScript sent to the browser.
import 'server-only'

import { neon, neonConfig, Pool, type NeonQueryFunction, type NeonQueryFunctionInTransaction, type NeonQueryInTransaction, type PoolClient } from '@neondatabase/serverless'

/*
  WHY THE POOLED CONNECTION STRING (the host with "-pooler" in it)?

  PostgreSQL gives every connection its own server process, so it can only
  hold a few hundred at once. On Vercel every request may run in a fresh,
  short-lived function instance, and a traffic spike can start hundreds of
  them, each wanting its own connection. Pointed at the database directly,
  they would exhaust its connection limit and new visitors would get errors.

  The pooled endpoint puts PgBouncer in front: it accepts thousands of
  client connections and lends each one a real PostgreSQL connection only
  for the length of one transaction. Many short-lived functions share a
  handful of real connections.
*/
function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local (or add it in Vercel) and paste your Neon pooled connection string.')
  }
  return url
}

// ---------------------------------------------------------------------------
// One-shot queries over HTTP
// ---------------------------------------------------------------------------

let http: NeonQueryFunction<false, false> | null = null

/**
 * Runs ONE query as an HTTPS request: no connection to open or close, which
 * makes it the fastest choice for a serverless function's single read.
 *
 * It is a TAGGED TEMPLATE. In sql`SELECT * FROM notes WHERE id = ${id}`, the
 * driver never pastes `id` into the SQL text. It sends the text with a
 * placeholder ($1) and the value separately, and PostgreSQL treats the value
 * only as data, never as SQL. That is what makes SQL injection impossible
 * (see the README).
 *
 * Fragments compose: sql`... ${tag ? sql`AND t.name = ${tag}` : sql``}` is
 * still fully parameterised.
 *
 * The client is created on first use rather than when the module loads, so
 * a missing DATABASE_URL fails the request that needed it (caught by an
 * error boundary), not the whole build.
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  http ??= neon(connectionString())
  return http(strings, ...values)
}

/**
 * The same HTTPS query, written with $1-style placeholders and a separate
 * values array. lib/notes.ts uses it for SQL text that is shared with the
 * interactive transactions below (which only accept this style).
 */
export function sqlQuery(text: string, values: unknown[]) {
  http ??= neon(connectionString())
  return http.query(text, values)
}

/**
 * Several statements in ONE non-interactive transaction, sent as a single
 * HTTPS request: all of them commit, or none do. Use it when no statement
 * needs to look at an earlier statement's result (deleting notes and then
 * their orphaned tags, for example).
 */
export function sqlTransaction(build: (tx: NeonQueryFunctionInTransaction<false, false>) => NeonQueryInTransaction[]) {
  http ??= neon(connectionString())
  return http.transaction(build)
}

// ---------------------------------------------------------------------------
// Interactive transactions over a WebSocket
// ---------------------------------------------------------------------------

// Node 22+ has a WebSocket built in, which Pool uses to hold a real session.
neonConfig.webSocketConstructor = WebSocket

export type Tx = PoolClient

/**
 * An INTERACTIVE TRANSACTION: BEGIN, then queries whose results decide what
 * happens next, then COMMIT, or ROLLBACK if anything throws. Saving a note
 * needs this: if the version check finds no row, we must stop before
 * touching its tags.
 *
 * Inside `work`, queries use $1-style placeholders with a separate values
 * array, e.g. tx.query('... WHERE id = $1', [id]). Same safety as the tagged
 * template: values travel apart from the SQL.
 *
 * `rollback(value)` undoes everything and makes withTransaction return
 * `value`: for outcomes like a version conflict, which are not errors.
 *
 * Neon's advice for serverless: create the Pool, use it and close it inside
 * the same request. A Pool kept in a module variable would outlive the
 * request that opened its WebSocket.
 */
export async function withTransaction<T>(work: (tx: Tx, rollback: (value: T) => never) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: connectionString() })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    try {
      const value = await work(client, (v) => {
        throw new Rollback(v)
      })
      await client.query('COMMIT')
      return value
    } catch (error) {
      await client.query('ROLLBACK')
      if (error instanceof Rollback) return error.value as T
      throw error
    }
  } finally {
    client.release()
    await pool.end()
  }
}

class Rollback {
  constructor(readonly value: unknown) {}
}
