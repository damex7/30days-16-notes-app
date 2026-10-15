-- 004 · Full-text search, added to the existing table.
--
-- This is a separate migration ON PURPOSE: it shows how a schema grows. The
-- notes table already exists (001), so we ALTER it instead of editing 001.
--
-- A tsvector is the note "prepared for searching": the words are split out,
-- lower-cased, stemmed ("cooking", "cooked" -> "cook") and stop words ("the",
-- "and") are dropped, with each word's position kept.
--
-- GENERATED ALWAYS AS (...) STORED: PostgreSQL computes the column itself on
-- every INSERT and UPDATE. App code can't forget to update it and can't
-- write it at all. setweight() marks title words 'A' and body words 'B', so
-- a match in the title ranks higher (ts_rank in lib/notes.ts).
--
-- 'english' is the text-search configuration (stemming rules, stop words).
-- Yoruba words aren't stemmed, but they are still indexed and found as
-- whole words.
ALTER TABLE notes
  ADD COLUMN search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', body), 'B')
  ) STORED;

-- GIN ("generalised inverted index") maps each word to the notes that
-- contain it, like a book's index. `search @@ query` looks the words up here
-- instead of reading every note. A normal B-tree index can't do this, and
-- `LIKE '%word%'` can't use any index at all (see the README).
CREATE INDEX notes_search_idx ON notes USING gin (search);
