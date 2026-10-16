// npm run db:explain
//
// Shows HOW PostgreSQL runs the app's main queries, with EXPLAIN ANALYZE:
// the plan it chose, how many rows each step touched and how long it took.
//
// 1. On the real data (a dozen notes). At this size any plan takes a
//    fraction of a millisecond; the planner may read the whole table (Seq
//    Scan) or the index, whichever its statistics say is cheaper.
// 2. After adding 25,000 notes INSIDE A TRANSACTION that is rolled back at
//    the end, so nothing is kept. With that many rows the indexes from
//    db/migrations/003 and 004 get used, and "Load more" stays as fast on
//    page 100 as on page 1.
//
// The SQL below is the same as listNotes() and searchNotes() in
// lib/notes.ts, with the values filled in as parameters.

import { neonConfig, Pool } from '@neondatabase/serverless'

neonConfig.webSocketConstructor = WebSocket

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string.')
  process.exit(1)
}

const SAMPLE_OWNER_ID = '00000000-0000-4000-8000-000000000016'
const OTHER_OWNER_ID = '00000000-0000-4000-8000-0000000000aa'

const LIST_QUERY = `
  SELECT n.id, n.title, left(n.body, 220) AS preview, n.pinned, n.archived,
         n.updated_at AS "updatedAt", n.deleted_at AS "deletedAt",
         ARRAY(SELECT t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
               WHERE nt.note_id = n.id ORDER BY t.name) AS tags
  FROM notes n
  WHERE n.owner_id = $1 AND n.deleted_at IS NULL AND NOT n.archived
  ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
  LIMIT 21`

const NEXT_PAGE_QUERY = `
  SELECT n.id, n.title
  FROM notes n
  WHERE n.owner_id = $1 AND n.deleted_at IS NULL AND NOT n.archived
    AND (n.pinned, n.updated_at, n.id) < ($2::boolean, $3::timestamptz, $4::uuid)
  ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
  LIMIT 21`

const SEARCH_QUERY = `
  SELECT n.id, n.title
  FROM notes n, websearch_to_tsquery('english', $2) AS q
  WHERE n.owner_id = $1 AND n.deleted_at IS NULL AND NOT n.archived AND n.search @@ q
  ORDER BY ts_rank(n.search, q) DESC, n.updated_at DESC, n.id DESC
  LIMIT 50`

const pool = new Pool({ connectionString })
const client = await pool.connect()

async function explain(label: string, sql: string, params: unknown[]) {
  const { rows } = await client.query<{ 'QUERY PLAN': string }>(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) ${sql}`, params)
  console.log(`\n-- ${label}\n${rows.map((r) => r['QUERY PLAN']).join('\n')}`)
}

try {
  await client.query('BEGIN')

  const { rows: count } = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM notes')
  console.log(`== 1. Real data: ${count[0]?.n ?? 0} notes in the table ==`)
  await explain('Main list, first page', LIST_QUERY, [SAMPLE_OWNER_ID])

  // generate_series(1, N) makes N rows in one statement: a quick way to
  // fill a table for testing. Another owner gets most of them, so the
  // owner_id part of the index has something to skip over.
  await client.query(
    `INSERT INTO notes (owner_id, title, body, updated_at)
     -- One note in 500 mentions jollof, so a search has few matches to find.
     SELECT $1, 'Generated note ' || g,
            CASE WHEN g % 500 = 0 THEN 'Cooked jollof for the street party, day ' || g
                 ELSE 'Lecture notes on physics and chemistry, week ' || g END,
            now() - make_interval(mins => g)
     FROM generate_series(1, 5000) g`,
    [SAMPLE_OWNER_ID],
  )
  await client.query(
    `INSERT INTO notes (owner_id, title, body, updated_at)
     SELECT $1, 'Someone else''s note ' || g, 'Lecture notes on chemistry, week ' || g,
            now() - make_interval(mins => g)
     FROM generate_series(1, 20000) g`,
    [OTHER_OWNER_ID],
  )
  // ANALYZE refreshes the planner's statistics (row counts, value spread),
  // which is how it decides between a table scan and an index.
  await client.query('ANALYZE notes')
  // A GIN index makes inserts cheaper by parking new entries in a "pending
  // list" and merging them into the index later (autovacuum does it). Rows
  // still in that list are found by checking every one of them. In normal
  // use the list stays small; right after a 25,000-row insert it isn't, so
  // we merge it now for a fair picture.
  await client.query("SELECT gin_clean_pending_list('notes_search_idx')")

  console.log('\n== 2. With 25,000 more notes (inside a transaction, rolled back below) ==')
  await explain('Main list, first page', LIST_QUERY, [SAMPLE_OWNER_ID])

  // A cursor from deep in the list: the 4,000th note.
  const { rows: deep } = await client.query<{ pinned: boolean; updated_at: Date; id: string }>(
    `SELECT pinned, updated_at, id FROM notes
     WHERE owner_id = $1 AND deleted_at IS NULL AND NOT archived
     ORDER BY pinned DESC, updated_at DESC, id DESC OFFSET 4000 LIMIT 1`,
    [SAMPLE_OWNER_ID],
  )
  const cursor = deep[0]
  if (cursor) {
    await explain('"Load more" from the 4,000th note (keyset cursor)', NEXT_PAGE_QUERY, [SAMPLE_OWNER_ID, cursor.pinned, cursor.updated_at, cursor.id])
    await explain(
      'The same page with OFFSET, for comparison',
      LIST_QUERY.replace('LIMIT 21', 'OFFSET 4000 LIMIT 21'),
      [SAMPLE_OWNER_ID],
    )
  }
  await explain('Full-text search for "jollof" (11 matching notes out of 5,000+)', SEARCH_QUERY, [SAMPLE_OWNER_ID, 'jollof'])
  await explain('The same search with LIKE, for comparison', SEARCH_QUERY.replace("n.search @@ q", "(n.title ILIKE '%' || $2 || '%' OR n.body ILIKE '%' || $2 || '%')").replace("ts_rank(n.search, q) DESC, ", ''), [SAMPLE_OWNER_ID, 'jollof'])
} finally {
  // Undo the 25,000 rows: the real data is exactly as it was.
  await client.query('ROLLBACK')
  client.release()
  await pool.end()
}
