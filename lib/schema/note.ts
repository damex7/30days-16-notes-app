// THE SHAPES OF NOTE DATA, as Zod schemas (the Day 14/15 pattern). Each type
// is derived with z.infer, so the schema is the one source of truth.
//
// Two kinds of schema live here:
// 1. INPUT schemas check what arrives from the browser (forms, URL params,
//    Server Action arguments). Anything a user can send is untrusted.
// 2. ROW schemas check what comes BACK from PostgreSQL in lib/notes.ts. The
//    driver types every row as `Record<string, any>`, so without a check a
//    renamed column would flow through the app as `undefined` and break far
//    from the cause. Parsing at the boundary turns `any` into real types and
//    makes a schema/code mismatch fail loudly, right at the query.
//
// The limits here repeat the CHECK constraints in db/migrations on purpose:
// Zod answers first with a friendly message; the database is the last line.

import { z } from 'zod'

export const TITLE_MAX = 120
export const BODY_MAX = 20_000
export const TAG_MAX = 32
export const TAGS_PER_NOTE_MAX = 10
export const SEARCH_MAX = 200

/**
 * ts_headline (lib/notes.ts) marks matched words with these two private-use
 * characters instead of HTML tags, and lib/highlight.ts turns them into
 * <mark> elements. No HTML string is ever injected into the page.
 */
export const MARK_START = ''
export const MARK_END = ''

/** Removes control characters (except tab and newline) and our highlight markers. */
function clean(text: string): string {
  return text.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const NoteIdSchema = z.uuid()

export const TitleSchema = z
  .string()
  .transform(clean)
  .pipe(z.string().max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters`))

export const BodySchema = z
  .string()
  .transform((s) => clean(s).replace(/\r\n/g, '\n'))
  .pipe(z.string().max(BODY_MAX, `Notes can be up to ${BODY_MAX.toLocaleString('en')} characters`))

/**
 * A tag name, NORMALISED: trimmed, lower case, spaces become hyphens. So
 * "JAMB Prep" and " jamb-prep " are the same tag. Letters from any language
 * are allowed (ẹ, ọ, ṣ), plus digits and hyphens.
 */
export const TagNameSchema = z
  .string()
  .transform((s) => clean(s).trim().toLowerCase().replace(/\s+/g, '-'))
  .pipe(
    z
      .string()
      .min(1, 'Type a tag name')
      .max(TAG_MAX, `Tags can be up to ${TAG_MAX} characters`)
      .regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N}-]*$/u, 'Use letters, numbers and hyphens'),
  )

export const TagListSchema = z
  .array(TagNameSchema)
  .max(TAGS_PER_NOTE_MAX, `A note can have up to ${TAGS_PER_NOTE_MAX} tags`)
  .transform((names) => [...new Set(names)].sort())

/** Everything the editor sends when it autosaves. */
export const SaveNoteInputSchema = z.object({
  id: NoteIdSchema,
  /** The version the editor STARTED from: the heart of optimistic concurrency. */
  expectedVersion: z.number().int().positive(),
  title: TitleSchema,
  body: BodySchema,
  tags: TagListSchema,
})
export type SaveNoteInput = z.infer<typeof SaveNoteInputSchema>

// ---------------------------------------------------------------------------
// The list's URL: /?q=...&tag=...
// ---------------------------------------------------------------------------

/** Search params can arrive as string, string[] or missing: take the first. */
const firstString = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().optional())

export const ListQuerySchema = z.object({
  q: firstString.transform((s) => {
    const q = s ? clean(s).trim().slice(0, SEARCH_MAX) : ''
    return q === '' ? undefined : q
  }),
  // A bad tag in the URL is ignored rather than turned into an error page.
  tag: firstString.transform((s) => {
    const parsed = TagNameSchema.safeParse(s ?? '')
    return parsed.success ? parsed.data : undefined
  }),
})
export type ListQuery = z.infer<typeof ListQuerySchema>

// ---------------------------------------------------------------------------
// The "Load more" cursor
// ---------------------------------------------------------------------------

/**
 * KEYSET PAGINATION: the cursor is the sort key of the LAST note on the page
 * (pinned, updated_at, id). The next page is "notes that sort after this
 * one", which the list index answers directly. It's sent to the browser as
 * an opaque base64url string and checked again when it comes back.
 */
export const CursorSchema = z.object({
  pinned: z.boolean(),
  updatedAt: z.iso.datetime(),
  id: z.uuid(),
})
export type Cursor = z.infer<typeof CursorSchema>

/** The opaque cursor string as it travels through the browser (see lib/cursor.ts). */
export const CursorStringSchema = z.string().max(200).regex(/^[\w-]+$/)

// ---------------------------------------------------------------------------
// Rows coming back from PostgreSQL
// ---------------------------------------------------------------------------

// The driver turns timestamptz into a JavaScript Date and text[] into an
// array, so these are the shapes we expect. The queries alias snake_case
// columns to camelCase (`updated_at AS "updatedAt"`), so the rows already
// have the app's names.

/** One note, in full: what the editor needs. */
export const NoteSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  pinned: z.boolean(),
  archived: z.boolean(),
  deletedAt: z.date().nullable(),
  version: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string()),
})
export type Note = z.infer<typeof NoteSchema>

/** One row of a list: a preview, not the whole body. */
export const NoteSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  preview: z.string(),
  pinned: z.boolean(),
  archived: z.boolean(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  tags: z.array(z.string()),
})
export type NoteSummary = z.infer<typeof NoteSummarySchema>

/** A search hit: the summary plus highlighted title and snippet. */
export const SearchHitSchema = NoteSummarySchema.extend({
  titleHighlight: z.string(),
  snippet: z.string(),
})
export type SearchHit = z.infer<typeof SearchHitSchema>

export const TagCountSchema = z.object({
  name: z.string(),
  // count() returns bigint, which the driver gives back as a string to avoid
  // losing precision. The query casts it to int, so a number is expected.
  noteCount: z.number().int().nonnegative(),
})
export type TagCount = z.infer<typeof TagCountSchema>

/** What lib/notes.ts returns for the main list. */
export type NotePage = { notes: NoteSummary[]; nextCursor: string | null }
