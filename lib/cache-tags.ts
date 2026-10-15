// CACHE TAGS: names stuck onto cached query results (cacheTag in
// lib/notes.ts) so a Server Action can expire exactly the results a write
// affected (updateTag in app/(app)/actions.ts). Every tag includes the owner
// or note ID, so one person's edit never expires anyone else's cache.

export const cacheTags = {
  /** One note, as the editor reads it. */
  note: (noteId: string) => `note:${noteId}`,
  /** The main list, its "Load more" pages, search results and tag filters. */
  list: (ownerId: string) => `notes:${ownerId}`,
  archive: (ownerId: string) => `archive:${ownerId}`,
  trash: (ownerId: string) => `trash:${ownerId}`,
  /** Tag names and per-tag note counts (/tags and the filter chips). */
  tags: (ownerId: string) => `tags:${ownerId}`,
}
