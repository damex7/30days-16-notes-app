// /notes/[id] : the editor, with the list beside it on wide screens.
//
// A malformed id ("/notes/hello") or an unknown one gives a 404. The id is
// checked with Zod BEFORE any query: PostgreSQL would reject "hello" as a
// uuid with an error, and an error page is not what a bad link deserves.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { NoteEditor } from '@/components/notes/note-editor'
import { NotesListPane } from '@/components/notes/notes-list-pane'
import { NotesShell } from '@/components/notes/notes-shell'
import { TrashedNote } from '@/components/notes/trashed-note'
import { EditorSkeleton } from '@/components/ui/skeletons'
import { listQueryString } from '@/lib/list-url'
import { getNote, listTagsWithCounts } from '@/lib/notes'
import { getOwnerId } from '@/lib/owner'
import { ListQuerySchema, NoteIdSchema } from '@/lib/schema/note'

export const metadata: Metadata = { title: 'Note' }

export default function NotePage({ params, searchParams }: PageProps<'/notes/[id]'>) {
  const id = params.then((p) => p.id)
  return (
    <NotesShell pane="editor" list={<NotesListPane searchParams={searchParams} activeId={id} />}>
      <Suspense fallback={<EditorSkeleton />}>
        <EditorSection id={id} searchParams={searchParams} />
      </Suspense>
    </NotesShell>
  )
}

async function EditorSection({ id, searchParams }: { id: Promise<string>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsedId = NoteIdSchema.safeParse(await id)
  if (!parsedId.success) notFound()

  const ownerId = await getOwnerId()
  const [note, tags, raw] = await Promise.all([getNote(ownerId, parsedId.data), listTagsWithCounts(ownerId), searchParams])
  if (!note) notFound()

  if (note.deletedAt) return <TrashedNote note={note} />

  return (
    <NoteEditor
      // key: opening another note mounts a fresh editor with that note's
      // state, instead of reusing this one's.
      key={note.id}
      note={note}
      tagSuggestions={tags.map((t) => t.name)}
      backHref={`/${listQueryString(ListQuerySchema.parse(raw))}`}
    />
  )
}
