// THE DATA ACCESS LAYER, now backed by PostgreSQL. On Days 12–15 this was
// lib/data.ts reading typed seed data; the pages called async functions and
// got typed results back. They still do: only the bodies changed, from
// array filters to SQL.
//
// Rules for this file:
// - Every value reaches SQL as a PARAMETER (a ${value} in the sql`` tagged
//   template, or $1 with a values array). No string concatenation, ever.
// - Every row coming back is checked with Zod (lib/schema/note.ts) before
//   the rest of the app sees it.
// - Every function takes ownerId and every query filters on it, so on Day
//   17 one person can never read or change another person's notes.
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'
import { cacheTags } from '@/lib/cache-tags'
import { decodeCursor, encodeCursor } from '@/lib/cursor'
import { sql, sqlQuery, sqlTransaction, withTransaction, type Tx } from '@/lib/db'
import {
  MARK_END,
  MARK_START,
  NoteSchema,
  NoteSummarySchema,
  SearchHitSchema,
  TagCountSchema,
  type Note,
  type NotePage,
  type NoteSummary,
  type SaveNoteInput,
  type SearchHit,
  type TagCount,
} from '@/lib/schema/note'

export const PAGE_SIZE = 20
const SEARCH_LIMIT = 50
const SIDE_LIST_LIMIT = 100

/** Parses rows at the boundary; a mismatch names the query that caused it. */
function parseRows<T>(schema: z.ZodType<T>, rows: unknown[], query: string): T[] {
  const parsed = z.array(schema).safeParse(rows)
  if (!parsed.success) {
    throw new Error(`Rows from ${query} didn't match the expected shape: ${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

/*
  CACHING. Each list read below starts with 'use cache' and cacheTag(...):
  the first request runs the SQL, later ones reuse the result until a
  Server Action calls updateTag() on that tag (app/(app)/actions.ts). The
  arguments (ownerId, tag, cursor, query) are part of the cache key.

  getNote() is deliberately NOT cached. The editor must start from the
  latest version of a note: a stale copy would make the very next autosave
  look like a conflict.

  cacheLife('minutes') also expires entries on a timer, as a safety net for
  hosts where serverless instances keep separate in-memory caches.
*/

// ---------------------------------------------------------------------------
// Shared SQL pieces
// ---------------------------------------------------------------------------

/**
 * The columns of a list row. `ARRAY(SELECT ...)` is a CORRELATED SUBQUERY:
 * for each note it collects that note's tag names into a text[]. It runs
 * once per row on the page (20 rows), after the LIMIT, which is cheaper than
 * joining every tag of every note and grouping before the LIMIT.
 */
const summaryColumns = () => sql`
  n.id,
  n.title,
  left(n.body, 220) AS preview,
  n.pinned,
  n.archived,
  n.updated_at AS "updatedAt",
  n.deleted_at AS "deletedAt",
  ARRAY(
    SELECT t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
    WHERE nt.note_id = n.id ORDER BY t.name
  ) AS tags
`

/** "This note has the tag named X": EXISTS stops at the first match. */
const hasTag = (ownerId: string, tag: string | undefined) =>
  tag
    ? sql`AND EXISTS (
        SELECT 1 FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
        WHERE nt.note_id = n.id AND t.owner_id = ${ownerId} AND t.name = ${tag}
      )`
    : sql``

/** One full note with its tags. $1-style so transactions can share it. */
const NOTE_BY_ID = `
  SELECT
    n.id, n.title, n.body, n.pinned, n.archived,
    n.deleted_at AS "deletedAt", n.version,
    n.created_at AS "createdAt", n.updated_at AS "updatedAt",
    ARRAY(
      SELECT t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
      WHERE nt.note_id = n.id ORDER BY t.name
    ) AS tags
  FROM notes n
  WHERE n.id = $1 AND n.owner_id = $2
`

/**
 * Deletes this owner's tags that no note uses any more (NOT EXISTS is an
 * "anti-join"). Run in the same transaction as whatever removed the links,
 * so removing the last use of a tag cleans the tag up too.
 */
const DELETE_ORPHAN_TAGS = `
  DELETE FROM tags t
  WHERE t.owner_id = $1
    AND NOT EXISTS (SELECT 1 FROM note_tags nt WHERE nt.tag_id = t.id)
`

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The main list: live notes, pinned first, then most recently edited.
 *
 * KEYSET PAGINATION. Instead of OFFSET 40 ("skip 40 rows"), the cursor holds
 * the sort key of the last note shown, and the next page is the notes that
 * sort after it: (pinned, updated_at, id) < (cursor values). This is a ROW
 * COMPARISON: PostgreSQL compares the tuples left to right, like words in a
 * dictionary. The list index has exactly these columns in this order, so
 * the database jumps straight to the cursor's position and reads 21 rows.
 * We ask for one more than a page to learn whether a next page exists.
 */
export async function listNotes(ownerId: string, options: { tag?: string; cursor?: string }): Promise<NotePage> {
  'use cache'
  cacheLife('minutes')
  cacheTag(cacheTags.list(ownerId))

  const cursor = options.cursor ? decodeCursor(options.cursor) : null
  const rows = await sql`
    SELECT ${summaryColumns()}
    FROM notes n
    WHERE n.owner_id = ${ownerId}
      AND n.deleted_at IS NULL
      AND NOT n.archived
      ${hasTag(ownerId, options.tag)}
      ${
        cursor
          ? sql`AND (n.pinned, n.updated_at, n.id) < (${cursor.pinned}::boolean, ${cursor.updatedAt}::timestamptz, ${cursor.id}::uuid)`
          : sql``
      }
    ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
    LIMIT ${PAGE_SIZE + 1}
  `
  const notes = parseRows(NoteSummarySchema, rows, 'listNotes')
  const page = notes.slice(0, PAGE_SIZE)
  const last = page.at(-1)
  return {
    notes: page,
    nextCursor:
      notes.length > PAGE_SIZE && last
        ? encodeCursor({ pinned: last.pinned, updatedAt: last.updatedAt.toISOString(), id: last.id })
        : null,
  }
}

/**
 * FULL-TEXT SEARCH. websearch_to_tsquery understands what people type into
 * search boxes: `jollof rice` (both words), `"egusi soup"` (the phrase),
 * `beans -moi` (without "moi"), `rice or yam`. It never throws on odd input.
 *
 * `n.search @@ q` asks "does this note's tsvector match the query?", which
 * the GIN index answers. ts_rank orders by how well each note matches (title
 * words count more, from setweight in 004), and ts_headline returns the text
 * with matched words wrapped in our two marker characters.
 */
export async function searchNotes(ownerId: string, query: string, tag?: string): Promise<SearchHit[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(cacheTags.list(ownerId))

  const titleOptions = `StartSel="${MARK_START}", StopSel="${MARK_END}", HighlightAll=true`
  const bodyOptions = `StartSel="${MARK_START}", StopSel="${MARK_END}", MaxFragments=2, MinWords=6, MaxWords=18, FragmentDelimiter=" … "`

  const rows = await sql`
    SELECT
      ${summaryColumns()},
      ts_headline('english', n.title, q, ${titleOptions}) AS "titleHighlight",
      ts_headline('english', n.body, q, ${bodyOptions}) AS snippet
    FROM notes n, websearch_to_tsquery('english', ${query}) AS q
    WHERE n.owner_id = ${ownerId}
      AND n.deleted_at IS NULL
      AND NOT n.archived
      AND n.search @@ q
      ${hasTag(ownerId, tag)}
    ORDER BY ts_rank(n.search, q) DESC, n.updated_at DESC, n.id DESC
    LIMIT ${SEARCH_LIMIT}
  `
  return parseRows(SearchHitSchema, rows, 'searchNotes')
}

export async function listArchivedNotes(ownerId: string): Promise<NoteSummary[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(cacheTags.archive(ownerId))

  const rows = await sql`
    SELECT ${summaryColumns()}
    FROM notes n
    WHERE n.owner_id = ${ownerId} AND n.deleted_at IS NULL AND n.archived
    ORDER BY n.updated_at DESC, n.id DESC
    LIMIT ${SIDE_LIST_LIMIT}
  `
  return parseRows(NoteSummarySchema, rows, 'listArchivedNotes')
}

export async function listTrashedNotes(ownerId: string): Promise<NoteSummary[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(cacheTags.trash(ownerId))

  const rows = await sql`
    SELECT ${summaryColumns()}
    FROM notes n
    WHERE n.owner_id = ${ownerId} AND n.deleted_at IS NOT NULL
    ORDER BY n.deleted_at DESC, n.id DESC
    LIMIT ${SIDE_LIST_LIMIT}
  `
  return parseRows(NoteSummarySchema, rows, 'listTrashedNotes')
}

/**
 * Every tag with the number of notes using it (trashed notes don't count).
 *
 * GROUP BY collapses the joined rows into one row per tag, and count(n.id)
 * counts the non-NULL note IDs in each group. LEFT JOIN keeps tags whose
 * notes are all in the trash (count 0). Grouping by the primary key t.id
 * lets us select t.name too: PostgreSQL knows the name depends on the id.
 */
export async function listTagsWithCounts(ownerId: string): Promise<TagCount[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(cacheTags.tags(ownerId))

  const rows = await sql`
    SELECT t.name, count(n.id)::int AS "noteCount"
    FROM tags t
    LEFT JOIN note_tags nt ON nt.tag_id = t.id
    LEFT JOIN notes n ON n.id = nt.note_id AND n.deleted_at IS NULL
    WHERE t.owner_id = ${ownerId}
    GROUP BY t.id
    ORDER BY "noteCount" DESC, t.name
  `
  return parseRows(TagCountSchema, rows, 'listTagsWithCounts')
}

/** One note for the editor (live, archived or trashed), or null. Not cached: see above. */
export async function getNote(ownerId: string, id: string): Promise<Note | null> {
  const rows = await sqlQuery(NOTE_BY_ID, [id, ownerId])
  return parseRows(NoteSchema, rows, 'getNote')[0] ?? null
}

async function getNoteInTransaction(tx: Tx, ownerId: string, id: string): Promise<Note | null> {
  const { rows } = await tx.query(NOTE_BY_ID, [id, ownerId])
  return parseRows(NoteSchema, rows, 'getNote (in transaction)')[0] ?? null
}

// ---------------------------------------------------------------------------
// Writes (never cached; the Server Actions expire the affected cache tags)
// ---------------------------------------------------------------------------

const IdRowSchema = z.object({ id: z.uuid() })

/** A new empty note. The database fills in id, defaults and timestamps. */
export async function createNote(ownerId: string): Promise<string> {
  const rows = await sql`INSERT INTO notes (owner_id) VALUES (${ownerId}) RETURNING id`
  const [row] = parseRows(IdRowSchema, rows, 'createNote')
  if (!row) throw new Error('INSERT returned no row')
  return row.id
}

export type SaveOutcome =
  | { status: 'saved'; version: number; updatedAt: Date; archived: boolean; tagsChanged: boolean }
  /** Someone else saved first. `server` is their version, for "Reload". */
  | { status: 'conflict'; server: Note }
  /** The note was deleted or moved to the trash meanwhile. */
  | { status: 'gone' }

const SavedRowSchema = z.object({ version: z.number().int(), updatedAt: z.date(), archived: z.boolean() })

/**
 * Saves a note's title, body and tags in ONE TRANSACTION.
 *
 * Without a transaction, each statement below would be committed on its
 * own. If the connection dropped (or a constraint failed) halfway, the note
 * could be saved with only some of its tags, or keep a tag link that was
 * meant to go, and nothing would put it right. Inside BEGIN ... COMMIT,
 * other requests see either the old note with its old tags or the new note
 * with its new tags, never a mix, and any error rolls everything back.
 *
 * OPTIMISTIC CONCURRENCY. The UPDATE only matches if the row still has the
 * version the editor started from. If another tab or device saved first,
 * no row matches and we roll back, returning their version so the editor
 * can ask: reload theirs, or keep mine? The UPDATE also LOCKS the row until
 * COMMIT, so two saves at the same moment are handled one after the other:
 * the second re-checks the version after the first commits, and fails.
 */
export async function saveNote(ownerId: string, input: SaveNoteInput): Promise<SaveOutcome> {
  return withTransaction<SaveOutcome>(async (tx, rollback) => {
    const updated = await tx.query(
      `UPDATE notes
          SET title = $1, body = $2, version = version + 1
        WHERE id = $3 AND owner_id = $4 AND version = $5 AND deleted_at IS NULL
        RETURNING version, updated_at AS "updatedAt", archived`,
      [input.title, input.body, input.id, ownerId, input.expectedVersion],
    )
    const [saved] = parseRows(SavedRowSchema, updated.rows, 'saveNote UPDATE')

    if (!saved) {
      // No row matched: find out why, then undo the (empty) transaction.
      const current = await getNoteInTransaction(tx, ownerId, input.id)
      return rollback(current && current.deletedAt === null ? { status: 'conflict', server: current } : { status: 'gone' })
    }

    // 1. Make sure every tag exists. ON CONFLICT DO NOTHING is an "upsert"
    //    that relies on UNIQUE (owner_id, name): existing tags are skipped.
    //    unnest() turns the text[] parameter into one row per name.
    await tx.query(
      `INSERT INTO tags (owner_id, name)
       SELECT $1, unnest($2::text[])
       ON CONFLICT (owner_id, name) DO NOTHING`,
      [ownerId, input.tags],
    )

    // 2. Unlink tags that are no longer on the note.
    const removed = await tx.query(
      `DELETE FROM note_tags nt
        USING tags t
        WHERE nt.note_id = $1 AND t.id = nt.tag_id AND NOT (t.name = ANY($2::text[]))`,
      [input.id, input.tags],
    )

    // 3. Link the ones that are new (existing links are skipped).
    const added = await tx.query(
      `INSERT INTO note_tags (note_id, tag_id)
       SELECT $1, t.id FROM tags t WHERE t.owner_id = $2 AND t.name = ANY($3::text[])
       ON CONFLICT DO NOTHING`,
      [input.id, ownerId, input.tags],
    )

    // 4. A tag whose last link was just removed is deleted too.
    if (removed.rowCount) await tx.query(DELETE_ORPHAN_TAGS, [ownerId])

    return { status: 'saved', ...saved, tagsChanged: Boolean(removed.rowCount) || Boolean(added.rowCount) }
  })
}

const FlagRowSchema = z.object({ id: z.uuid(), archived: z.boolean() })
type FlagRow = z.infer<typeof FlagRowSchema>

/**
 * Pin and archive are single-column switches where the last click wins, so
 * they don't check or bump `version`: pinning a note in the list must not
 * make the open editor's next save look like a conflict. Each returns the
 * row it changed, or null if nothing matched (wrong owner, already trashed).
 */
export async function setPinned(ownerId: string, id: string, pinned: boolean): Promise<FlagRow | null> {
  // `NOT archived` in the WHERE: an archived note can't be pinned (the CHECK
  // constraint would reject it anyway; this avoids the error).
  const rows = await sql`
    UPDATE notes SET pinned = ${pinned}
    WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL AND NOT archived
    RETURNING id, archived
  `
  return parseRows(FlagRowSchema, rows, 'setPinned')[0] ?? null
}

export async function setArchived(ownerId: string, id: string, archived: boolean): Promise<FlagRow | null> {
  // Archiving also unpins, in the same statement, to satisfy the CHECK
  // constraint notes_pinned_not_archived.
  const rows = await sql`
    UPDATE notes
       SET archived = ${archived}, pinned = pinned AND NOT ${archived}::boolean
     WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL
     RETURNING id, archived
  `
  return parseRows(FlagRowSchema, rows, 'setArchived')[0] ?? null
}

/** SOFT DELETE: the row stays; deleted_at moves it to the trash. */
export async function moveToTrash(ownerId: string, id: string): Promise<FlagRow | null> {
  const rows = await sql`
    UPDATE notes SET deleted_at = now()
    WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL
    RETURNING id, archived
  `
  return parseRows(FlagRowSchema, rows, 'moveToTrash')[0] ?? null
}

export async function restoreFromTrash(ownerId: string, id: string): Promise<FlagRow | null> {
  const rows = await sql`
    UPDATE notes SET deleted_at = NULL
    WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NOT NULL
    RETURNING id, archived
  `
  return parseRows(FlagRowSchema, rows, 'restoreFromTrash')[0] ?? null
}

/**
 * Deletes one trashed note for good, then any tags left unused. Two
 * statements in one NON-INTERACTIVE transaction (a single HTTPS request):
 * neither needs to read the other's result, so we don't need a WebSocket
 * session. ON DELETE CASCADE removes the note's note_tags rows, which is
 * what can leave tags orphaned.
 *
 * Only notes already in the trash can be deleted forever.
 */
export async function deleteForever(ownerId: string, id: string): Promise<boolean> {
  const [deleted] = await sqlTransaction((tx) => [
    tx`DELETE FROM notes WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NOT NULL RETURNING id`,
    tx.query(DELETE_ORPHAN_TAGS, [ownerId]),
  ])
  return (deleted?.length ?? 0) > 0
}

/** Deletes every trashed note for good. Returns how many. */
export async function emptyTrash(ownerId: string): Promise<number> {
  const [deleted] = await sqlTransaction((tx) => [
    tx`DELETE FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL RETURNING id`,
    tx.query(DELETE_ORPHAN_TAGS, [ownerId]),
  ])
  return deleted?.length ?? 0
}
