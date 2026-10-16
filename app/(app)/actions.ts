// SERVER ACTIONS: every write in the app goes through this file.
//
// 'use server' turns each exported async function into an endpoint the
// browser can call. Treat every argument as untrusted input, the same as a
// form post from a stranger: each one is checked with Zod first. The owner
// is NEVER taken from the browser; it comes from getOwnerId() on the server,
// and every query in lib/notes.ts filters on it.
//
// REVALIDATION. Reads in lib/notes.ts are cached and tagged. After a write,
// each action calls updateTag() on ONLY the tags that write affected
// (pinning touches the list; trashing touches the list, the trash and the
// tag counts). updateTag, not revalidateTag(tag, 'max'):
//   - updateTag expires the entry NOW, so the re-render that comes back with
//     this action's response reads fresh data: you see your own change.
//   - revalidateTag(tag, 'max') is stale-while-revalidate: the next visit is
//     served the OLD list while a fresh one is fetched in the background.
//     Fine for a CMS webhook, wrong right after you pinned a note.
//   - revalidatePath('/') would throw away every cached result on the page,
//     including the ones this write didn't touch.
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { cacheTags } from '@/lib/cache-tags'
import {
  copySampleNotes,
  createNote,
  deleteForever,
  emptyTrash,
  listNotes,
  moveToTrash,
  restoreFromTrash,
  saveNote,
  setArchived,
  setPinned,
} from '@/lib/notes'
import { getOwnerId } from '@/lib/owner'
import { CursorStringSchema, NoteIdSchema, SaveNoteInputSchema, TagNameSchema, type Note, type NotePage } from '@/lib/schema/note'

/** Expires the list a note appears in: the main list, or the archive. */
function expireListOf(ownerId: string, archived: boolean) {
  updateTag(archived ? cacheTags.archive(ownerId) : cacheTags.list(ownerId))
}

// ---------------------------------------------------------------------------
// Creating and saving
// ---------------------------------------------------------------------------

/** "New note" (and the n shortcut): an empty note, then straight to the editor. */
export async function createNoteAction(): Promise<void> {
  const ownerId = await getOwnerId()
  const id = await createNote(ownerId)
  updateTag(cacheTags.list(ownerId))
  redirect(`/notes/${id}`)
}

/**
 * "Add the sample notes": copies the sample notebook into this browser's
 * empty notebook. It can add archived and trashed notes too, so every list
 * is expired.
 */
export async function addSampleNotesAction(): Promise<void> {
  const ownerId = await getOwnerId()
  const copied = await copySampleNotes(ownerId)
  if (copied > 0) {
    updateTag(cacheTags.list(ownerId))
    updateTag(cacheTags.archive(ownerId))
    updateTag(cacheTags.trash(ownerId))
    updateTag(cacheTags.tags(ownerId))
  }
}

export type SaveResult =
  | { ok: true; version: number; updatedAt: Date }
  | { ok: false; error: 'conflict'; server: Note }
  | { ok: false; error: 'gone' }
  | { ok: false; error: 'invalid'; message: string }
  /** The database couldn't be reached. The editor retries these. */
  | { ok: false; error: 'unavailable' }

/**
 * The editor's autosave. Returns a result instead of throwing, so the
 * editor can tell "try again later" (unavailable) from "stop and ask"
 * (conflict) from "you sent something impossible" (invalid).
 */
export async function saveNoteAction(input: unknown): Promise<SaveResult> {
  const parsed = SaveNoteInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'invalid', message: parsed.error.issues[0]?.message ?? 'That note could not be saved' }
  }

  const ownerId = await getOwnerId()
  let outcome
  try {
    outcome = await saveNote(ownerId, parsed.data)
  } catch (error) {
    console.error('saveNote failed', error)
    return { ok: false, error: 'unavailable' }
  }

  switch (outcome.status) {
    case 'saved':
      // The title and preview changed, and the note moves to the top.
      expireListOf(ownerId, outcome.archived)
      // Only when tags were added or removed do the counts change.
      if (outcome.tagsChanged) updateTag(cacheTags.tags(ownerId))
      return { ok: true, version: outcome.version, updatedAt: outcome.updatedAt }
    case 'conflict':
      return { ok: false, error: 'conflict', server: outcome.server }
    case 'gone':
      return { ok: false, error: 'gone' }
  }
}

// ---------------------------------------------------------------------------
// Pin, archive, trash
// ---------------------------------------------------------------------------

const FlagInput = z.tuple([NoteIdSchema, z.boolean()])

/** Pinning changes the order of the main list, and nothing else. */
export async function setPinnedAction(id: string, pinned: boolean): Promise<boolean> {
  const [noteId, value] = FlagInput.parse([id, pinned])
  const ownerId = await getOwnerId()
  const row = await setPinned(ownerId, noteId, value)
  if (row) updateTag(cacheTags.list(ownerId))
  return row !== null
}

/** Archiving moves a note between the main list and the archive. */
export async function setArchivedAction(id: string, archived: boolean): Promise<boolean> {
  const [noteId, value] = FlagInput.parse([id, archived])
  const ownerId = await getOwnerId()
  const row = await setArchived(ownerId, noteId, value)
  if (row) {
    updateTag(cacheTags.list(ownerId))
    updateTag(cacheTags.archive(ownerId))
  }
  return row !== null
}

/**
 * Moves a note to the trash (soft delete). From the editor, pass
 * `leaveEditor` to go back to the list afterwards.
 */
export async function moveToTrashAction(id: string, leaveEditor = false): Promise<boolean> {
  const noteId = NoteIdSchema.parse(id)
  const ownerId = await getOwnerId()
  const row = await moveToTrash(ownerId, noteId)
  if (row) {
    expireListOf(ownerId, row.archived)
    updateTag(cacheTags.trash(ownerId))
    // Tag counts only count notes outside the trash.
    updateTag(cacheTags.tags(ownerId))
  }
  if (leaveEditor) redirect('/')
  return row !== null
}

export async function restoreAction(id: string): Promise<boolean> {
  const noteId = NoteIdSchema.parse(id)
  const ownerId = await getOwnerId()
  const row = await restoreFromTrash(ownerId, noteId)
  if (row) {
    expireListOf(ownerId, row.archived)
    updateTag(cacheTags.trash(ownerId))
    updateTag(cacheTags.tags(ownerId))
  }
  return row !== null
}

/** Deletes one trashed note for good. Unused tags go with it. */
export async function deleteForeverAction(id: string): Promise<boolean> {
  const noteId = NoteIdSchema.parse(id)
  const ownerId = await getOwnerId()
  const deleted = await deleteForever(ownerId, noteId)
  if (deleted) {
    updateTag(cacheTags.trash(ownerId))
    updateTag(cacheTags.tags(ownerId))
  }
  return deleted
}

export async function emptyTrashAction(): Promise<number> {
  const ownerId = await getOwnerId()
  const count = await emptyTrash(ownerId)
  if (count > 0) {
    updateTag(cacheTags.trash(ownerId))
    updateTag(cacheTags.tags(ownerId))
  }
  return count
}

// ---------------------------------------------------------------------------
// Reading the next page
// ---------------------------------------------------------------------------

/**
 * "Load more": the next page after `cursor`. A read, so nothing to
 * revalidate; listNotes() is cached, so a second click on the same page is
 * served from the cache.
 */
export async function loadMoreAction(cursor: string, tag: string | undefined): Promise<NotePage> {
  const validCursor = CursorStringSchema.parse(cursor)
  const validTag = tag === undefined ? undefined : TagNameSchema.parse(tag)
  const ownerId = await getOwnerId()
  return listNotes(ownerId, { cursor: validCursor, tag: validTag })
}
