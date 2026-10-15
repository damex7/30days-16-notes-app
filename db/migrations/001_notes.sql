-- 001 · The notes table, and the trigger that keeps updated_at current.
--
-- A MIGRATION is one numbered, append-only step in the database's history.
-- scripts/migrate.ts runs each file once, in order, inside a transaction,
-- and records its name in schema_migrations. Once a file has been applied
-- anywhere, it is never edited: a later change is a NEW file (see 004).

CREATE TABLE notes (
  -- PRIMARY KEY = NOT NULL + UNIQUE + an index. A uuid (not 1, 2, 3...) can
  -- be shown in URLs without revealing how many notes exist, and it can't be
  -- guessed by counting. gen_random_uuid() is built into PostgreSQL 13+.
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Whose note this is. There is no users table yet (Day 17), so there is no
  -- FOREIGN KEY yet either; every query still filters on it, so adding
  -- accounts only changes where the ID comes from (lib/owner.ts).
  owner_id    uuid        NOT NULL,

  -- NOT NULL DEFAULT '' instead of nullable: "no title" has ONE spelling
  -- (the empty string), so no query ever has to handle both '' and NULL.
  -- CHECK constraints are rules the database refuses to break, whichever
  -- code (or person in a SQL console) writes the row. Zod checks the same
  -- limits first, to give a friendly message; this is the last line.
  title       text        NOT NULL DEFAULT ''
              CONSTRAINT notes_title_length CHECK (char_length(title) <= 120),
  body        text        NOT NULL DEFAULT ''
              CONSTRAINT notes_body_length CHECK (char_length(body) <= 20000),

  pinned      boolean     NOT NULL DEFAULT false,
  archived    boolean     NOT NULL DEFAULT false,

  -- SOFT DELETE: "delete" sets this timestamp instead of removing the row,
  -- so Trash can restore it. NULL means "live". It is deliberately the only
  -- nullable column: NULL here carries a meaning ("not deleted").
  deleted_at  timestamptz(3),

  -- OPTIMISTIC CONCURRENCY: every content save says "I started from version
  -- N" and runs UPDATE ... WHERE version = N, then sets version = N + 1. If
  -- another tab saved first, the version moved on, no row matches, and the
  -- app shows "This note changed elsewhere" instead of overwriting it.
  version     integer     NOT NULL DEFAULT 1
              CONSTRAINT notes_version_positive CHECK (version > 0),

  -- timestamptz, never plain timestamp: it stores an exact instant (UTC
  -- inside), and PostgreSQL converts it for whoever reads it. Plain
  -- `timestamp` stores wall-clock digits with no zone and silently means
  -- different instants on servers in different time zones.
  --
  -- (3) = millisecond precision. PostgreSQL keeps microseconds by default,
  -- but a JavaScript Date only holds milliseconds. The "Load more" cursor
  -- carries updated_at through the browser and back, so the two must agree
  -- exactly, or a note could be skipped or shown twice between pages.
  created_at  timestamptz(3) NOT NULL DEFAULT now(),
  updated_at  timestamptz(3) NOT NULL DEFAULT now(),

  -- A TABLE-LEVEL CHECK can relate two columns: an archived note is never
  -- pinned (archiving unpins it), so the list query never has to decide
  -- what a "pinned but archived" note would mean.
  CONSTRAINT notes_pinned_not_archived CHECK (NOT (pinned AND archived))
);

-- TRIGGER: a function the DATABASE runs automatically on every UPDATE of a
-- row, before the row is written. Doing this here instead of in app code
-- means updated_at is right no matter who writes: a Server Action, the seed
-- script, a future mobile API or someone fixing data in the Neon console.
-- App code can forget; a trigger can't.
--
-- It only moves updated_at when the CONTENT changed (title, body, or the
-- version, which content saves bump, including tag-only edits). Pinning,
-- archiving or trashing a note doesn't make it "recently edited", so it
-- doesn't jump to the top of the list.
CREATE FUNCTION notes_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.title, NEW.body, NEW.version) IS DISTINCT FROM (OLD.title, OLD.body, OLD.version) THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION notes_set_updated_at();
