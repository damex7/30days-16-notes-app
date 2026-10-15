-- 003 · Indexes for the three list queries the app actually runs.
--
-- An INDEX is a sorted copy of some columns that points back at the rows,
-- like the index at the back of a book. Each one speeds up reads that match
-- its order and slows every write a little (it must be kept up to date), so
-- we add one per real query, not one per column.
--
-- These are PARTIAL indexes (the WHERE clause): each holds only the rows its
-- page can show. The main list never shows trashed or archived notes, so
-- they aren't in its index at all, which keeps it small.

-- The main list (/): an owner's live notes, pinned first, then most recently
-- edited. The column order matches `ORDER BY pinned DESC, updated_at DESC,
-- id DESC` exactly, so PostgreSQL reads the index in order and stops after
-- one page: no sorting. `id` is the tie-breaker that makes every position
-- unique, which keyset pagination ("Load more") needs.
CREATE INDEX notes_live_list_idx
  ON notes (owner_id, pinned DESC, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL AND NOT archived;

-- /archive: archived notes that aren't in the trash, most recent first.
CREATE INDEX notes_archive_idx
  ON notes (owner_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL AND archived;

-- /trash: trashed notes, most recently deleted first.
CREATE INDEX notes_trash_idx
  ON notes (owner_id, deleted_at DESC, id DESC)
  WHERE deleted_at IS NOT NULL;
