-- 002 · Tags, and the join table that links them to notes.
--
-- A note can have many tags and a tag can be on many notes: a MANY-TO-MANY
-- relationship. Neither table can hold it alone (a "tags" text[] column on
-- notes couldn't be counted, renamed or indexed per tag cleanly), so a third
-- table, note_tags, stores one row per (note, tag) pair.

CREATE TABLE tags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL,

  -- Tags are stored NORMALISED (trimmed, lower case), so "JAMB", " jamb"
  -- and "jamb" are one tag. lib/schema/note.ts normalises before saving;
  -- this CHECK makes it impossible to store an un-normalised name anyway.
  name        text        NOT NULL
              CONSTRAINT tags_name_normalised CHECK (name = lower(btrim(name)))
              CONSTRAINT tags_name_length CHECK (char_length(name) BETWEEN 1 AND 32),

  created_at  timestamptz NOT NULL DEFAULT now(),

  -- UNIQUE per owner, not globally: two people may both have a "work" tag.
  -- A UNIQUE constraint is backed by an index, so this also makes "find my
  -- tag called X" fast, and it is what INSERT ... ON CONFLICT (owner_id,
  -- name) relies on to upsert tags safely.
  CONSTRAINT tags_owner_name_key UNIQUE (owner_id, name)
);

CREATE TABLE note_tags (
  -- FOREIGN KEYS: a row here must point at a real note and a real tag.
  -- ON DELETE CASCADE: when a note (or tag) is deleted for good, its links
  -- are deleted with it in the same statement, so there are never links
  -- pointing at nothing. Soft delete (Trash) doesn't delete the note row, so
  -- a trashed note keeps its tags and gets them back on restore.
  note_id  uuid NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  tag_id   uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,

  -- COMPOSITE PRIMARY KEY: the pair is the identity. The same tag can't be
  -- on the same note twice, and the index it creates (note_id first) makes
  -- "the tags of this note" fast.
  PRIMARY KEY (note_id, tag_id)
);

-- The primary key's index starts with note_id, so it can't help queries that
-- start from a tag: "notes with tag X" (the tag filter), the per-tag counts
-- on /tags, and the cascade when a tag is deleted. This index covers those.
CREATE INDEX note_tags_tag_id_idx ON note_tags (tag_id);
